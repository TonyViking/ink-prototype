/* Persistence round-trip: run the REAL app twice against one shared
   (fake) IndexedDB. Instance A draws + backgrounds; instance B boots and must
   restore and repaint the strokes. Proves autosave + restore end-to-end. */
require("fake-indexeddb/auto");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const appSrc = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function recordingEl(extra) {
  const h = {};
  return Object.assign({
    _handlers: h,
    addEventListener(t, fn) { (h[t] = h[t] || []).push(fn); },
    fire(t, ev) { (h[t] || []).forEach(fn => fn(ev || {})); },
    setAttribute() {}, getAttribute() { return null; },
    classList: { toggle() {}, add() {}, remove() {} }, style: {}
  }, extra || {});
}

function makeInstance() {
  const ops = [];
  const ctx = new Proxy({}, {
    get(_, k) {
      if (k === "lineWidth" || k === "lineCap" || k === "lineJoin" ||
          k === "fillStyle" || k === "strokeStyle") return 1;
      return (...a) => { ops.push([k, ...a]); };
    },
    set() { return true; }
  });

  const canvas = recordingEl({
    width: 0, height: 0,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 1200 }),
    setPointerCapture() {}, releasePointerCapture() {}
  });
  const swatches = ["cream", "white", "blue", "pink"].map(c => recordingEl({ dataset: { color: c } }));
  const els = { board: canvas, info: recordingEl(), erase: recordingEl(),
    undo: recordingEl(), clear: recordingEl(), diag: recordingEl() };

  const win = {
    devicePixelRatio: 2, innerWidth: 800, innerHeight: 1200, isSecureContext: false,
    indexedDB: global.indexedDB,                 // shared store across instances
    confirm: () => true,
    _h: {}, addEventListener(t, fn) { (win._h[t] = win._h[t] || []).push(fn); },
    fire(t, ev) { (win._h[t] || []).forEach(fn => fn(ev || {})); }
  };
  const doc = {
    visibilityState: "visible",
    getElementById: id => els[id],
    querySelectorAll: sel => (sel === ".swatch" ? swatches : []),
    _h: {}, addEventListener(t, fn) { (doc._h[t] = doc._h[t] || []).push(fn); },
    fire(t, ev) { (doc._h[t] || []).forEach(fn => fn(ev || {})); }
  };
  class PE {}
  PE.prototype.getCoalescedEvents = function () { return []; };

  new Function("window", "document", "navigator", "PointerEvent", appSrc)(win, doc, {}, PE);
  return { ops, canvas, win, doc, els };
}

const pen = (id, x, y, p, coalesced) => ({
  pointerId: id, pointerType: "pen", clientX: x, clientY: y, pressure: p,
  getCoalescedEvents: () => coalesced || [], preventDefault() {}
});
const fire = (el, t, ev) => (el._handlers[t] || []).forEach(fn => fn(ev));
const wait = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (n, c) => { c ? (pass++, console.log("  ok  " + n)) : (fail++, console.log("FAIL  " + n)); };

(async () => {
  // ---- Instance A: draw a stroke, then background the app ----
  const A = makeInstance();
  await wait(60);                                  // let A open the DB
  fire(A.canvas, "pointerdown", pen(1, 120, 220, 0.6));
  fire(A.canvas, "pointermove", pen(1, 160, 260, 0.7, [pen(1, 140, 240, 0.65), pen(1, 160, 260, 0.7)]));
  fire(A.canvas, "pointerup", pen(1, 160, 260, 0.7));
  const drewInA = A.ops.filter(o => o[0] === "lineTo").length >= 1;
  check("A: stroke drawn", drewInA);

  A.win.fire("pagehide");                           // triggers immediate flushSave
  await wait(120);                                  // let the IDB put transaction complete

  // ---- Instance B: fresh app, same DB — must restore ----
  const B = makeInstance();
  await wait(150);                                  // let B open DB, read, applyDoc, render
  const restored = B.ops.filter(o => o[0] === "lineTo").length >= 1;
  check("B: restored stroke repainted after relaunch", restored);

  // ---- Instance B clears, backgrounds; Instance C must restore EMPTY ----
  fire(B.els.clear, "click");                       // confirm stub returns true -> flushSave
  await wait(120);
  const C = makeInstance();
  await wait(150);
  const emptyAfterClear = C.ops.filter(o => o[0] === "lineTo").length === 0;
  check("C: cleared page persists as empty after relaunch", emptyAfterClear);

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
