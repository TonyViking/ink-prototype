# Ink Prototype

A feel-test for the stylus planning tool — **not** the full app. It exists to
answer one question before we build the rest: does writing on a web canvas with
your S Pen feel good enough on the tablet?

What it does:

- Pen draws, **one finger scrolls** (vertical only), the way Samsung Notes works
- Four pens — cream (header), white (script), blue (link), pink (border)
- Pressure-sensitive line width
- Stroke eraser (removes whole strokes you touch), undo, clear
- Autosaves locally and restores your page on relaunch (IndexedDB)
- Long scrolling page (vector strokes, camera over the data — no giant bitmap)
- Diagnostics toggle (`i`) shows input type, pressure, stroke count, DPR — use it
  to confirm the S Pen is detected as `pen` and pressure is actually arriving

What it deliberately does **not** do yet: linking, sub-pages, pulled headers.
Saving is now in. That's the next build once the ink feels right.

---

## Install on the tablet (GitHub Pages — recommended)

A PWA needs HTTPS to install and run its service worker, so file:// won't offer
"Add to Home screen". GitHub Pages gives you HTTPS for free and matches how you
deploy your other apps.

1. Make a new repo (e.g. `ink-prototype`) under `tonyviking` and upload these
   files to the **root**:
   `index.html`, `manifest.webmanifest`, `service-worker.js`,
   `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`.
2. Repo **Settings → Pages → Build and deployment**: Source = *Deploy from a
   branch*, Branch = `main`, folder = `/ (root)`. Save.
3. Wait ~1 min, then open the URL it gives you
   (`https://tonyviking.github.io/ink-prototype/`) in **Chrome on the tablet**.
4. Chrome menu (⋮) → **Add to Home screen** / **Install app**. It opens
   fullscreen, black, offline-capable.

All paths in the app are relative, so it works fine under that `/ink-prototype/`
subpath. If you change any file later, bump `CACHE` in `service-worker.js`
(e.g. `ink-proto-v1` → `v2`) so the tablet re-fetches instead of serving the
cached old copy.

## Quick test without installing

Just want to scribble and check the feel? Open `index.html` directly in Chrome
on the tablet (via a file manager). Drawing, colours, eraser and scroll all
work — you just don't get the installed-app shell or offline caching, since the
service worker won't register off file://.

---

## Re-theming / tuning

Everything lives in the `CONFIG` block at the top of the `<script>` in
`index.html` — colours, pen min/max width, default pressure, eraser radius,
page growth, overscroll. The four CSS `--vars` in the `<style>` mirror the
swatch colours; change both if you re-theme.

## Dev files (optional, not needed on the tablet)

- `make_icons.py` — regenerates the icons (needs `pillow`). Edit the palette /
  stroke and re-run if you want a different mark.
- `test_app.js` — a headless behaviour check that loads the real app with
  stubbed browser globals and fires synthetic pen/touch events. Run with
  `node test_app.js`. 13 checks: draw/commit, pressure→width, scroll direction,
  eraser removal, undo, clear, colour switch.
- `test_persistence.js` — runs the real app twice against one in-memory
  IndexedDB: draw + background, then relaunch and confirm the strokes restore
  (and that a cleared page stays cleared). Needs `npm i fake-indexeddb` first,
  then `node test_persistence.js`.

## Storage note

Autosave uses IndexedDB, which needs a secure context — so it works on the
installed PWA (https) but may not persist if you open `index.html` straight off
file://. The app still runs there for feel-testing; it just won't save.
