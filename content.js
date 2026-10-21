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
  const MEDIA_ATTR = 'data-light-switch-media';

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

  function toRgba(color) {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = 'transparent';
    probe.fillStyle = color;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: a / 255 };
  }

  function luminance({ r, g, b }) {
    const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  const isDark = (c) => luminance(c) < 0.2;
  const css = ({ r, g, b }) => `rgb(${r}, ${g}, ${b})`;

  // The first solid background colour behind an element, ignoring images and charts.
  function backgroundBehind(el) {
    const media = el.closest('svg, picture, video, img, canvas, iframe, embed, object');
    for (let node = media ? media.parentElement : el; node; node = node.parentElement) {
      const c = toRgba(getComputedStyle(node).backgroundColor);
      if (c.a >= 0.5) return c;
    }
    return null;
  }

  function detectLook() {
    if (!document.body) return null;

    // The browser's own page colour, used when the site doesn't set one.
    const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
    const schemeDark = getComputedStyle(root).colorScheme.includes('dark') &&
      (prefersDark || !getComputedStyle(root).colorScheme.includes('light'));
    const page = backgroundBehind(document.body) ??
      (schemeDark ? { r: 18, g: 18, b: 18 } : { r: 255, g: 255, b: 255 });

    // Sample a few spots across the screen and take a majority vote.
    const samples = [];
    for (const [x, y] of [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8], [0.5, 0.05]]) {
      const el = document.elementFromPoint(innerWidth * x, innerHeight * y);
      const c = el && backgroundBehind(el);
      if (c) samples.push(c);
    }
    if (!samples.length) samples.push(page);

    const dark = samples.filter(isDark).length > samples.length / 2;
    const base = isDark(page) === dark ? page : samples.find((c) => isDark(c) === dark);
    return { dark, base: css(base) };
  }

  // ---------- Keeping photos, charts and background pictures un-flipped ----------

  function tagMedia() {
    const vw = innerWidth;
    const vh = innerHeight;

    // Large drawings (charts, diagrams, illustrations). Small icons flip with the text.
    for (const svg of document.querySelectorAll(`svg:not(svg svg):not([${MEDIA_ATTR}])`)) {
      const r = svg.getBoundingClientRect();
      if (r.width >= 150 && r.height >= 100) svg.setAttribute(MEDIA_ATTR, '');
    }

    // Elements that show a picture as their background, except page-sized wrappers.
    const all = document.body.getElementsByTagName('*');
    for (let i = 0; i < Math.min(all.length, 5000); i++) {
      const el = all[i];
      if (el.hasAttribute(MEDIA_ATTR)) continue;
      if (!getComputedStyle(el).backgroundImage.includes('url(')) continue;
      const r = el.getBoundingClientRect();
      if (r.width >= vw * 0.9 && r.height >= vh * 0.9) continue;
      el.setAttribute(MEDIA_ATTR, '');
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
