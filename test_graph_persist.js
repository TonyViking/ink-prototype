/* Graph persistence: instance A draws + boxes a link + backgrounds; instance B
   relaunches from the same IndexedDB and must have the full graph (2 pages, 1
   link) and be able to navigate into the child and see its pulled header. */
require("fake-indexeddb/auto");
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const appSrc = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function recordingEl(extra) {
  const h = {};
  return Object.assign({
    _handlers: h,
    addEventListener(t, fn) { (h[t] = h[t] || []).push(fn); },
    removeEventListener(t, fn) { const a = h[t]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
    fire(t, ev) { (h[t] || []).slice().forEach(fn => fn(ev || {})); },
    setAttribute() {}, getAttribute() { return null; },
    classList: { toggle() {}, add() {}, remove() {} }, style: {}
  }, extra || {});
}

function makeInstance() {
  const ops = [];
  const ctx = new Proxy({}, {
    get(_, k) {
      if (["lineWidth","lineCap","lineJoin","fillStyle","strokeStyle"].includes(k)) return 1;
      return (...a) => { ops.push([k, ...a]); };
    }, set() { return true; }
  });
  const canvas = recordingEl({ width: 0, height: 0, getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 1200 }),
    setPointerCapture() {}, releasePointerCapture() {} });
  const swatches = ["cream","white","blue","pink"].map(c => recordingEl({ dataset: { color: c } }));
  const els = { board: canvas, info: recordingEl(), erase: recordingEl(), link: recordingEl(),
    undo: recordingEl(), clear: recordingEl(), diag: recordingEl(), back: recordingEl({ hidden: true }),
    editTools: recordingEl(), modeEdit: recordingEl(), modeView: recordingEl() };
  const win = { devicePixelRatio: 2, innerWidth: 800, innerHeight: 1200, isSecureContext: false,
    indexedDB: global.indexedDB, confirm: () => true,
    _h: {}, addEventListener(t, fn) { (win._h[t] = win._h[t] || []).push(fn); }, fire(t, e) { (win._h[t] || []).forEach(fn => fn(e || {})); } };
  const doc = { visibilityState: "visible", getElementById: id => (els[id] || (els[id] = recordingEl())),
    querySelectorAll: s => (s === ".swatch" ? swatches : []),
    _h: {}, addEventListener(t, fn) { (doc._h[t] = doc._h[t] || []).push(fn); }, fire(t, e) { (doc._h[t] || []).forEach(fn => fn(e || {})); } };
  class PE {} PE.prototype.getCoalescedEvents = function () { return []; };
  new Function("window","document","navigator","PointerEvent", appSrc)(win, doc, {}, PE);
  return { ops, canvas, win, els, ink: win.__ink };
}

const pen = (id, x, y, p, c) => ({ pointerId: id, pointerType: "pen", clientX: x, clientY: y, pressure: p || 0.5,
  getCoalescedEvents: () => c || [], preventDefault() {} });
const fireOn = (inst, t, ev) => (inst.canvas._handlers[t] || []).forEach(fn => fn(ev));
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (n, c) => { c ? (pass++, console.log("  ok  " + n)) : (fail++, console.log("FAIL  " + n)); };

(async () => {
  const A = makeInstance();
  await wait(60);
  // draw a stroke and box it as a link
  fireOn(A, "pointerdown", pen(1, 210, 310, 0.6));
  fireOn(A, "pointermove", pen(1, 240, 340, 0.6, [pen(1, 225, 325, 0.6), pen(1, 240, 340, 0.6)]));
  fireOn(A, "pointerup", pen(1, 240, 340, 0.6));
  A.els.link.fire("click");
  fireOn(A, "pointerdown", pen(2, 190, 290, 0.5));
  fireOn(A, "pointermove", pen(2, 270, 370, 0.5, [pen(2, 230, 330, 0.5), pen(2, 270, 370, 0.5)]));
  fireOn(A, "pointerup", pen(2, 270, 370, 0.5));
  check("A: graph built (2 pages, 1 link)", A.ink.pages() === 2 && A.ink.links() === 1);

  A.win.fire("pagehide");
  await wait(120);

  const B = makeInstance();
  await wait(160);
  check("B: graph restored (2 pages)", B.ink.pages() === 2);
  check("B: link restored on root", B.ink.links() === 1 && B.ink.page() === "root");

  // navigate into the restored link
  B.els.modeView.fire("click");
  fireOn(B, "pointerdown", pen(3, 230, 330, 0.5));
  fireOn(B, "pointerup", pen(3, 230, 330, 0.5));
  check("B: navigated into restored child", B.ink.page() !== "root");
  check("B: restored child has pulled header", B.ink.header() === true);

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
