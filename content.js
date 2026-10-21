// Light Switch: runs inside every page you visit.
//
// For each website you can pick Off, Dark or Light (saved per site).
// If the page already looks the way you asked, nothing changes. Otherwise
// the page's colours are flipped (see switch.css), and photos, videos and
// charts are flipped back so they keep their real colours.
(() => {
  const host = location.hostname;
  if (!host) return;

  const root = document.documentElement;
  const MODE_KEY = `mode:${host}`; // 'off' | 'dark' | 'light', set by the popup
  const LOOK_KEY = `look:${host}`; // how the page looks on its own, remembered between visits
  const FLIP_ATTR = 'data-light-switch';
  const MEDIA_ATTR = 'data-light-switch-media'; // keep original colours
  const PAGE_ATTR = 'data-light-switch-page'; // inside a kept area, but follows the page

  let mode = 'off';
  let look = null; // { dark: boolean, base: 'rgb(r, g, b)' }
  let flipped = false;
  let loaded = document.readyState === 'complete';

  // ---------- Flipping ----------

  function apply() {
    flipped = mode !== 'off' && look !== null && (mode === 'dark') !== look.dark;
    if (flipped) {
      root.setAttribute(FLIP_ATTR, 'flip');
      root.style.setProperty('--light-switch-base', look.base);
    } else {
      root.removeAttribute(FLIP_ATTR);
      root.style.removeProperty('--light-switch-base');
    }
  }

  // Some sites rewrite the <html> tag's attributes; put our marker back if so.
  new MutationObserver(() => {
    const missing = root.getAttribute(FLIP_ATTR) !== 'flip' ||
      !root.style.getPropertyValue('--light-switch-base');
    if (flipped && missing) apply();
  }).observe(root, { attributes: true, attributeFilter: [FLIP_ATTR, 'style'] });

  // ---------- Working out whether the page looks dark ----------

  // A 1x1 canvas turns any CSS colour (rgb, hex, oklch, ...) into plain numbers.
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  probe.canvas.width = probe.canvas.height = 1;

  const colorCache = new Map();
  function toRgba(color) {
    if (colorCache.has(color)) return colorCache.get(color);
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = 'transparent';
    probe.fillStyle = color;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
    const rgba = { r, g, b, a: a / 255 };
    colorCache.set(color, rgba);
    return rgba;
  }

  function luminance({ r, g, b }) {
    const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  const isDark = (c) => luminance(c) < 0.2;
  const css = ({ r, g, b }) => `rgb(${r}, ${g}, ${b})`;

  // Covers the whole page (not just one panel or banner on it).
  function isPageSized(el) {
    if (el === document.body || el === root) return true;
    const r = el.getBoundingClientRect();
    const pageHeight = Math.max(root.scrollHeight, innerHeight);
    return r.width >= innerWidth * 0.9 && r.height >= pageHeight * 0.8;
  }

  // How the page looks comes from its own background: the first solid colour on
  // something page-sized behind the middle of the screen. Panels and banners
  // (like a dark hero section on a white site) don't count, so the answer
  // doesn't change as you scroll.
  function detectLook() {
    if (!document.body) return null;

    const start = document.elementFromPoint(innerWidth / 2, innerHeight / 2) ?? document.body;
    for (let node = start; node; node = node.parentElement) {
      const c = toRgba(getComputedStyle(node).backgroundColor);
      if (c.a >= 0.5 && isPageSized(node)) return { dark: isDark(c), base: css(c) };
    }

    // The site sets no background, so the browser's own page colour shows.
    const scheme = getComputedStyle(root).colorScheme;
    const dark = scheme.includes('dark') &&
      (!scheme.includes('light') || matchMedia('(prefers-color-scheme: dark)').matches);
    return { dark, base: dark ? 'rgb(18, 18, 18)' : 'rgb(255, 255, 255)' };
  }

  // ---------- Keeping some parts of the page un-flipped ----------
  //
  // Everything tagged with MEDIA_ATTR is flipped back to its original colours:
  // photos, charts, background pictures, and panels that already have the
  // colour you asked for (a dark banner stays dark when you pick Dark).

  function tagMedia() {
    // Large drawings (charts, diagrams, illustrations). Small icons flip with the text.
    for (const svg of document.querySelectorAll(`svg:not(svg svg):not([${MEDIA_ATTR}])`)) {
      const r = svg.getBoundingClientRect();
      if (r.width >= 150 && r.height >= 100) svg.setAttribute(MEDIA_ATTR, '');
    }

    const pageLum = luminance(toRgba(look.base));
    const all = document.body.getElementsByTagName('*');
    for (let i = 0; i < Math.min(all.length, 5000); i++) {
      const el = all[i];
      if (el.hasAttribute(MEDIA_ATTR) || el.hasAttribute(PAGE_ATTR)) continue;
      const style = getComputedStyle(el);

      const bg = toRgba(style.backgroundColor);
      const lum = bg.a >= 0.5 ? luminance(bg) : null;

      // Inside a kept panel, shapes painted the page's own colour (like a curved
      // edge blending the panel into the page) still need to follow the page.
      if (lum !== null && Math.abs(lum - pageLum) < 0.03 && el.parentElement?.closest(`[${MEDIA_ATTR}]`)) {
        el.setAttribute(PAGE_ATTR, '');
        continue;
      }

      const hasPicture = style.backgroundImage.includes('url(');
      const alreadyMatches = lum !== null && (look.dark ? lum > 0.5 : lum < 0.1);
      if ((hasPicture || alreadyMatches) && !isPageSized(el)) el.setAttribute(MEDIA_ATTR, '');
    }
  }

  function untagMedia() {
    for (const el of document.querySelectorAll(`[${MEDIA_ATTR}], [${PAGE_ATTR}]`)) {
      el.removeAttribute(MEDIA_ATTR);
      el.removeAttribute(PAGE_ATTR);
    }
  }

  // ---------- Re-checking as the page loads and changes ----------

  let scanTimer = 0;
  function scheduleScan() {
    if (!scanTimer) scanTimer = setTimeout(scan, 400);
  }

  function scan() {
    clearTimeout(scanTimer);
    scanTimer = 0;
    if (mode === 'off' || !document.body) return;

    // Until the page has fully loaded its styles, trust what we remembered from last time.
    if (loaded || !look) {
      const fresh = detectLook();
      if (fresh && (!look || fresh.dark !== look.dark || fresh.base !== look.base)) {
        if (look && fresh.dark !== look.dark) untagMedia();
        look = fresh;
        chrome.storage.local.set({ [LOOK_KEY]: look });
        apply();
      }
    }
    if (flipped) tagMedia();
  }

  const pageObserver = new MutationObserver(scheduleScan);
  let watching = false;

  function setMode(next) {
    mode = next;
    apply(); // instant, using last visit's look, so there's no white flash
    if (mode === 'off') {
      pageObserver.disconnect();
      watching = false;
      return;
    }
    if (!watching) {
      pageObserver.observe(root, { childList: true, subtree: true });
      watching = true;
    }
    if (document.readyState !== 'loading') scan();
  }

  document.addEventListener('DOMContentLoaded', scan, { once: true });
  addEventListener('load', () => { loaded = true; scan(); }, { once: true });

  // ---------- Talking to the popup ----------

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && MODE_KEY in changes) setMode(changes[MODE_KEY].newValue ?? 'off');
  });

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg?.type === 'light-switch:status') {
      reply({ mode, flipped, pageIsDark: look ? look.dark : null });
    }
  });

  chrome.storage.local.get([MODE_KEY, LOOK_KEY]).then((saved) => {
    look = saved[LOOK_KEY] ?? null;
    setMode(saved[MODE_KEY] ?? 'off');
  });
})();
