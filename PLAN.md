# Light Switch: Plan for a Light/Dark Mode Browser Extension

*Written for someone who has never built software. No prior knowledge assumed.*

---

## 1. The short answer

**Yes, you can build this.** It's one of the easiest kinds of software to make:

- **Chrome and Arc both run on the same engine (Chromium).** One extension works in both, so you build it once.
- **You don't need servers, accounts, hosting or money** to use it yourself. It's a small folder of files on your Mac.
- **The core of it is about 100–200 lines of code.** Claude can write all of it. Your part is testing and saying what looks wrong.
- **Rough time:** an afternoon for a working first version, then a few short sessions to polish it.

**Worth knowing before you start:** free extensions like this already exist. The best known is *Dark Reader*. Building your own still makes sense if you want something simpler, private (no third-party code reading your pages), or made exactly to your taste. Try Dark Reader on agentsview.io for 2 minutes first. If it already does what you want, you may not need to build anything.

---

## 2. What a browser extension actually is

A browser extension is **a folder of text files** that you tell the browser to load. Inside that folder:

| File | What it does, in plain English |
|---|---|
| `manifest.json` | The **ID card**. It holds the extension's name, version, which websites it may touch and which other files it uses. The browser reads this first. |
| `content.js` | The **worker**. It runs inside each web page you visit and changes how the page looks. |
| `dark.css` | The **paint**. It holds the styling rules that turn light colours dark (or dark colours light). |
| `popup.html` + `popup.js` | The **little window** that opens when you click the extension's icon in the toolbar. This is where your on/off switch lives. |
| `icons/` | The small pictures shown in the toolbar (16, 48 and 128 pixels). |

You don't have to publish it anywhere. You can load it straight from your Desktop folder (see Step 4).

---

## 3. How "make a site dark" works, and how to avoid distorting information

You care most about not distorting information, so this decision matters most. There are three common techniques:

### Option A: "Invert everything" (simplest, riskiest)
Flips every colour on the page: white becomes black, black becomes white.
- ✅ Takes about 5 lines of code and works on almost any site.
- ❌ **It distorts things.** Photos look like film negatives, logos change colour, and **charts and graphs get the wrong colours** (red becomes cyan, green becomes pink). If a chart uses colour to mean something ("red = error"), that meaning is lost.

### Option B: "Invert, then un-invert the media" (the smart version of A)
Inverts the page, then flips images, videos, charts and canvases **back** so they look normal.
- ✅ Still simple, and text and backgrounds go dark properly.
- ✅ Photos, logos and most charts keep their true colours.
- ⚠️ Accent colours on buttons and labels still shift slightly in hue. A small tweak (`hue-rotate(180deg)`) fixes most of that.
- **This is the recommended starting point.**

### Option C: "Smart recolouring" (what Dark Reader does)
Reads every colour on the page and works out a matching dark version one by one.
- ✅ Gives the best-looking result.
- ❌ Much more complex: thousands of lines of code. Not a beginner project.

### Rules to protect information (whichever option you pick)
1. **Never touch images, videos, `<canvas>` and `<svg>` charts.** Leave their colours as they are.
2. **Keep contrast readable.** Use soft dark grey (`#1e1e1e`), not pure black, and off-white text, not pure white. This is easier on the eyes and nothing "vanishes".
3. **Make it per-site and off by default.** It only runs on sites you switch on, so it can never break a site you didn't choose.
4. **Allow a one-click "off".** If something looks wrong, you can see the original instantly.
5. **Check the colour-meaning test:** with the extension on, confirm red, green and yellow labels still read as red, green and yellow.

---

## 4. Step-by-step build plan

### Phase 0: Setup (10 minutes, one time only)
- [ ] Make sure you have Chrome and/or Arc installed.
- [ ] Have a text editor. **VS Code** is free (code.visualstudio.com), or just let Claude create the files.
- [ ] Keep using this folder: `~/Desktop/Projects/light-switch`.
- [ ] Optional: install Dark Reader and try it on agentsview.io so you know what "good" looks like.

### Phase 1: Minimum working version (about 1 hour with Claude)
**Goal:** visit agentsview.io, click the icon, and the page turns dark.
- [ ] Create `manifest.json` (Manifest V3, the current format Chrome requires).
- [ ] Create `dark.css` with the Option B rules.
- [ ] Create `content.js`, which adds or removes the dark styling on the page.
- [ ] Create a basic `popup.html` with one toggle: "Dark mode on this site".
- [ ] Add placeholder icons.

### Phase 2: Load it into the browser (5 minutes)
**Chrome:**
1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (switch in the top-right corner).
3. Click **Load unpacked** and pick the `light-switch` folder.
4. Pin it with the puzzle-piece icon in the toolbar.

**Arc:**
1. Go to `arc://extensions` (or Arc menu → Extensions).
2. Follow the same steps: Developer mode → Load unpacked → pick the folder.

> After any file changes, press the **↻ reload** button on the extensions page, then refresh the website.

### Phase 3: Remember your choices (about 30 minutes)
- [ ] Save each site's on/off setting so agentsview.io stays dark the next time you visit.
  (This uses `chrome.storage`, the extension's own small notebook kept on your computer.)
- [ ] Make the dark styling apply **instantly** when the page loads, so there's no white flash first.

### Phase 4: Make it nicer (optional, pick what you like)
- [ ] **Three-way switch:** Off / Dark / Light. The "Light" mode lets you brighten sites that are dark only.
- [ ] **Follow my Mac:** automatically match macOS light/dark appearance.
- [ ] **Brightness/contrast slider** in the popup.
- [ ] **Keyboard shortcut**, e.g. `Alt+Shift+D`, to toggle without clicking.
- [ ] **Exception list:** right-click an element and choose "don't change this part".

### Phase 5: Testing checklist (do this every time something changes)
Test on at least 5 different sites: agentsview.io, a news site, Wikipedia, a site with charts and a site with lots of photos.
- [ ] Is all text still readable? Nothing invisible, nothing too faint?
- [ ] Do photos and logos look normal (not like negatives)?
- [ ] Do charts and graphs keep their original colours?
- [ ] Do status colours (red/green/yellow) still mean the same thing?
- [ ] Do dropdowns, pop-ups and menus turn dark as well?
- [ ] Does turning it off restore the page exactly?
- [ ] Does it remember the setting after closing and reopening the browser?
- [ ] Does it work in **both** Chrome and Arc?

### Phase 6: Sharing (only if you want to)
- **Just for you:** you're done after Phase 3. Keep loading it as an unpacked extension.
- **Sharing with colleagues:** zip the folder. They load it the same way (Developer mode → Load unpacked).
- **Chrome Web Store:** a one-time $5 developer fee, a privacy description, screenshots and a review that takes a few days. Arc users can install from the Chrome Web Store too.

---

## 5. Words you'll run into

| Term | Meaning |
|---|---|
| **Chromium** | The open-source engine that Chrome, Arc, Edge and Brave are built on. This is why one extension works in all of them. |
| **Manifest V3** | The current version of the extension "ID card" format. Older tutorials use V2, which no longer works. |
| **CSS** | The language that controls how web pages *look* (colours, fonts, spacing). |
| **JavaScript (JS)** | The language that makes web pages *do* things. Your extension uses a little of it. |
| **Content script** | Code from your extension that runs inside the web page you're viewing. |
| **Filter / invert** | A CSS instruction that flips colours, like a photo negative. |
| **Unpacked extension** | An extension loaded straight from a folder instead of installed from the store. |
| **Permissions** | What the extension is allowed to do. Ask for as little as possible (just "read and change the sites I turn it on for"). |

---

## 6. Risks and limitations (being honest)

- **Some sites will look imperfect.** Every website is built differently. Option B covers about 90% of sites well; a few will need small per-site fixes.
- **Sites inside frames** (embedded maps, some comment sections) may not change.
- **Browser internal pages** (`chrome://`, the Chrome Web Store, `arc://`) can't be changed by any extension. That's a browser rule.
- **Developer-mode warning:** Chrome may sometimes show a banner saying "Disable developer mode extensions". That's normal for home-made extensions; just dismiss it.
- **Privacy:** your own extension sends nothing anywhere. That's an advantage over third-party ones.

---

## 7. Suggested next step

Ask Claude (in this folder):

> "Build Phase 1 and Phase 3 of PLAN.md using Option B, then tell me exactly how to load it in Arc."

Then follow Phase 2 to load it, open agentsview.io, and report back anything that looks off. Screenshots help.
