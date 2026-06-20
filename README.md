# Ink Prototype

A stylus planning tool — write with the pen, box a section to give it its own
page, and dig deeper from there. Built as an installable PWA for the tablet.

What it does:

- Pen draws, **one finger scrolls** (vertical only), the way Samsung Notes works
- Four pens — cream (header), white (script), blue (link), pink (border)
- Pressure-sensitive line width
- Stroke eraser (removes whole strokes you touch), undo, clear
- **Edit / View modes** (toggle, bottom-right of the toolbar)
- **Linking** — in Edit, pick the Link tool and drag a box around some writing.
  That spawns a child page and pulls the boxed writing in as its header. In
  View, tap a box to open its page. Back button (top-left) returns you up a level.
- **Deleting a link** — with the Link tool, tap an existing box. A two-step
  confirm warns you it will delete that page and everything beneath it, then
  cascade-deletes the whole subtree.
- Pages nest as deep as you like; each box opens its own page
- Autosaves locally and restores the whole page graph on relaunch (IndexedDB)
- Long scrolling page (vector strokes, camera over the data — no giant bitmap)
- Diagnostics toggle (`i`) shows input type, pressure, mode, and stroke/link/page
  counts — use it to confirm the S Pen is seen as `pen` with live pressure

How the tools sit:

- **Edit** holds the four pens, eraser, **Link**, undo, clear.
  - Link tool: *drag a box* to create a link; *tap an existing box* to delete it
    (with a two-step confirm that cascade-deletes the page and its sub-pages).
- **View** hides the pens. Pen or finger both scroll on a drag; a tap opens a
  link. Links stay inert while you're editing, so you can't trip one by accident.

Still to come (refinements, not blockers): pinned/sticky headers, renaming
pages, and export.

## Standalone app (APK)

The PWA installs as a launchable app already. For a fully standalone package with
no hosted-page dependency, `BUILD-APK.md` walks through wrapping it with Capacitor
into an installable APK — the web files get bundled inside, so it runs offline.

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
page growth, overscroll, and the `link` block (box min size, header margins,
divider colour, view/edit link styling). The four CSS `--vars` in the `<style>`
mirror the swatch colours; change both if you re-theme.

## Dev files (optional, not needed on the tablet)

- `make_icons.py` — regenerates the icons (needs `pillow`). Edit the palette /
  stroke and re-run if you want a different mark.
- `test_app.js` — headless behaviour check (real app + stubbed globals + synthetic
  pen/touch events). `node test_app.js`. 13 checks: draw/commit, pressure→width,
  scroll direction, eraser removal, undo, clear, colour switch.
- `test_links.js` — pages + linking + cascade delete: create a link box, navigate
  in (View), confirm the pulled header carries the captured ink, Back returns to
  root, the two-step confirm cancels on No, and Yes/Yes cascade-deletes a subtree
  (incl. a 3-level root->A->B case). `node test_links.js`. 16 checks.
- `test_persistence.js` — runs the app twice against one in-memory IndexedDB:
  draw + background, relaunch and confirm strokes restore (and a cleared page
  stays cleared). 3 checks.
- `test_graph_persist.js` — same idea for the page graph: build a link, relaunch,
  confirm 2 pages + 1 link restored and the child is still navigable with its
  header. 5 checks.

The IndexedDB tests need `npm i fake-indexeddb` first, then `node <file>`.

## Storage note

Autosave uses IndexedDB, which needs a secure context — so it works on the
installed PWA (https) but may not persist if you open `index.html` straight off
file://. The app still runs there for feel-testing; it just won't save.
