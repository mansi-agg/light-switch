// The small window that opens from the toolbar icon. It saves the chosen
// mode for the current site; content.js on that page picks the change up.
const buttons = document.querySelectorAll('[data-mode]');
const siteEl = document.getElementById('site');
const hintEl = document.getElementById('hint');

function show(mode) {
  for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
}

function hint(text) {
  hintEl.textContent = text;
}

async function explain(tabId) {
  try {
    const s = await chrome.tabs.sendMessage(tabId, { type: 'light-switch:status' });
    if (s.mode !== 'off' && !s.flipped && s.pageIsDark !== null) {
      hint(`This site already looks ${s.mode}, so nothing needed changing.`);
    } else {
      hint('');
    }
  } catch {
    // The page was open before the extension was installed or reloaded.
    hint('Reload this page once so Light Switch can work on it.');
  }
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  let host = '';
  try {
    const url = new URL(tab.url);
    if (url.protocol === 'http:' || url.protocol === 'https:') host = url.hostname;
  } catch {}

  if (!host) {
    siteEl.textContent = 'This page';
    for (const b of buttons) b.disabled = true;
    hint("Browsers don't let extensions change this kind of page.");
    return;
  }

  siteEl.textContent = host;
  const key = `mode:${host}`;
  const saved = await chrome.storage.local.get(key);
  show(saved[key] ?? 'off');

  for (const b of buttons) {
    b.addEventListener('click', async () => {
      show(b.dataset.mode);
      await chrome.storage.local.set({ [key]: b.dataset.mode });
      setTimeout(() => explain(tab.id), 150);
    });
  }

  explain(tab.id);
}

init();
