/* Headless behaviour test: load the REAL app IIFE with stubbed browser
   globals, dispatch synthetic pointer events at its own handlers, and assert
   on what the 2D context received. No source modification, no test hooks. */
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const appSrc = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// ---- mock 2D context: records ops + tracks lineWidth assignments ----
function makeCtx() {
  const ops = [];
  let _lineWidth = 1, _lineCap = "", _lineJoin = "", _fill = "", _stroke = "";
  let lastTransform = null;
  const lineWidths = [];
  const ctx = {
    get lineWidth() { return _lineWidth; },
    set lineWidth(v) { _lineWidth = v; lineWidths.push(v); },
    set lineCap(v) { _lineCap = v; }, get lineCap() { return _lineCap; },
    set lineJoin(v) { _lineJoin = v; }, get lineJoin() { return _lineJoin; },
    set fillStyle(v) { _fill = v; }, get fillStyle() { return _fill; },
    set strokeStyle(v) { _stroke = v; }, get strokeStyle() { return _stroke; },
    setTransform(a, b, c, d, e, f) { lastTransform = [a, b, c, d, e, f]; ops.push(["setTransform", a, f]); },
    fillRect() { ops.push(["fillRect"]); },
    clearRect() { ops.push(["clearRect"]); },
    beginPath() { ops.push(["beginPath"]); },
    moveTo() { ops.push(["moveTo"]); },
    lineTo() { ops.push(["lineTo"]); },
    arc() { ops.push(["arc"]); },
    arcTo() { ops.push(["arcTo"]); },
    closePath() { ops.push(["closePath"]); },
    stroke() { ops.push(["stroke"]); },
    fill() { ops.push(["fill"]); }
  };
  return { ctx, ops, lineWidths, getTransform: () => lastTransform };
}

function fakeEl(extra) {
  const handlers = {};
  return Object.assign({
    _handlers: handlers,
    addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
    setAttribute() {}, getAttribute() { return null; },
    classList: { toggle() {}, add() {}, remove() {} },
    style: {},
    fire(type, ev) { (handlers[type] || []).forEach(fn => fn(ev || {})); }
  }, extra || {});
}

const view = { w: 800, h: 1200, dpr: 2 };
const m = makeCtx();

const canvas = fakeEl({
  width: 0, height: 0, style: {},
  getContext: () => m.ctx,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: view.w, height: view.h }),
  setPointerCapture() {}, releasePointerCapture() {}
});

const swatchIds = ["cream", "white", "blue", "pink"];
const swatches = swatchIds.map(c => fakeEl({ dataset: { color: c } }));
const els = {
  board: canvas,
  info: fakeEl(),
  erase: fakeEl(),
  link: fakeEl(),
  undo: fakeEl(),
  clear: fakeEl(),
  diag: fakeEl(),
  back: fakeEl({ hidden: true }),
  editTools: fakeEl(),
  modeEdit: fakeEl(),
  modeView: fakeEl()
};

const documentStub = {
  getElementById: id => els[id],
  querySelectorAll: sel => (sel === ".swatch" ? swatches : []),
  addEventListener() {}
};
const windowStub = {
  devicePixelRatio: view.dpr,
  innerWidth: view.w, innerHeight: view.h,
  isSecureContext: false,
  addEventListener() {},
  confirm: () => true
};
class PointerEventStub {}
PointerEventStub.prototype.getCoalescedEvents = function () { return []; };
const navigatorStub = {};

// run the real IIFE with our stubs shadowing the browser globals
const runner = new Function(
  "window", "document", "navigator", "PointerEvent", "self", appSrc
);
runner(windowStub, documentStub, navigatorStub, PointerEventStub, undefined);

// ---- helpers to drive the canvas's own handlers ----
const fire = (type, ev) => (canvas._handlers[type] || []).forEach(fn => fn(ev));
function penEvent(id, x, y, p, coalesced) {
  return {
    pointerId: id, pointerType: "pen", clientX: x, clientY: y, pressure: p,
    getCoalescedEvents: () => coalesced || [],
    preventDefault() {}
  };
}
function touchEvent(id, x, y) {
  return { pointerId: id, pointerType: "touch", clientX: x, clientY: y, pressure: 0, preventDefault() {} };
}
const countAfter = (i, name) => m.ops.slice(i).filter(o => o[0] === name).length;

let pass = 0, fail = 0;
const check = (name, cond) => { (cond ? (pass++, console.log("  ok  " + name)) : (fail++, console.log("FAIL  " + name))); };

// 1) boot painted a background and set a transform
check("boot: background painted", m.ops.some(o => o[0] === "fillRect"));
check("boot: transform set", m.ops.some(o => o[0] === "setTransform"));

// 2) pen stroke commits and draws segments
let mark = m.ops.length;
fire("pointerdown", penEvent(1, 100, 200, 0.5));
fire("pointermove", penEvent(1, 140, 230, 0.7, [
  penEvent(1, 110, 208, 0.55), penEvent(1, 125, 218, 0.62), penEvent(1, 140, 230, 0.7)
]));
const lwDuring = m.lineWidths.slice();
fire("pointermove", penEvent(1, 200, 300, 0.9, [penEvent(1, 200, 300, 0.9)]));
mark = m.ops.length;             // mark before commit render
fire("pointerup", penEvent(1, 200, 300, 0.9));
check("pen: stroke renders after commit (lineTo present)", countAfter(mark, "lineTo") >= 1);
check("pen: pressure varied the line width", new Set(lwDuring).size > 1);
check("pen: widths within configured band",
  m.lineWidths.every(w => w >= 1.5 && w <= 5.5));

// 3) single tap commits a dot
mark = m.ops.length;
fire("pointerdown", penEvent(2, 400, 500, 0.5));
fire("pointerup", penEvent(2, 400, 500, 0.5));
check("tap: dot rendered (arc + fill)", countAfter(mark, "arc") >= 1);

// 4) finger scroll moves the camera (page transform translate changes)
//    the page transform is the setTransform where a === dpr; the scrollbar
//    resets to identity afterwards, so read the last *page* transform.
const lastPageF = () => {
  for (let i = m.ops.length - 1; i >= 0; i--) {
    if (m.ops[i][0] === "setTransform" && m.ops[i][1] === view.dpr) return m.ops[i][2];
  }
  return null;
};
const tBefore = lastPageF();        // f = -cameraY*dpr
fire("pointerdown", touchEvent(9, 400, 900));
fire("pointermove", touchEvent(9, 400, 700));   // finger up 200px -> scroll down
const tAfter = lastPageF();
check("scroll: camera translate changed", tBefore !== tAfter);
check("scroll: direction is down (cameraY increased)", tAfter < tBefore); // f = -cameraY*dpr
fire("pointerup", touchEvent(9, 400, 700));

// 5) undo removes the most recent stroke
//    (clear the camera back to top first so geometry is simple)
mark = m.ops.length;
els.undo.fire("click");
const inkAfterUndo = countAfter(mark, "lineTo") + countAfter(mark, "arc");
// undo triggers a render; we only assert it ran without throwing and redrew
check("undo: re-rendered without error", countAfter(mark, "fillRect") >= 1);

// 6) eraser deletes a stroke under the pen — proven from a clean state.
//    Clear first (also exercises the Clear control), draw exactly one stroke,
//    confirm it paints ink, erase on it, confirm the next render paints none.
els.clear.fire("click");                         // confirm stub returns true
let baseMark = m.ops.length;
fire("pointerdown", penEvent(3, 300, 400, 0.6));
fire("pointermove", penEvent(3, 320, 420, 0.6, [penEvent(3, 320, 420, 0.6)]));
fire("pointerup", penEvent(3, 320, 420, 0.6));
const inkOneStroke = countAfter(baseMark, "lineTo");
check("erase setup: single stroke paints ink", inkOneStroke >= 1);

els.erase.fire("click");                          // tool -> erase
mark = m.ops.length;
fire("pointerdown", penEvent(4, 310, 410, 0.6));  // within eraser radius of the stroke
fire("pointerup", penEvent(4, 310, 410, 0.6));
check("erase: removal re-rendered", countAfter(mark, "fillRect") >= 1);
check("erase: zero ink remains after removal",
  countAfter(mark, "lineTo") === 0 && countAfter(mark, "arc") === 0);
els.erase.fire("click");                          // back to draw

// 7) colour switch updates active pen without throwing
els.erase.fire("click"); // back to draw
swatches[2].fire("click"); // blue
mark = m.ops.length;
fire("pointerdown", penEvent(5, 150, 150, 0.5));
fire("pointermove", penEvent(5, 170, 170, 0.5, [penEvent(5, 170, 170, 0.5)]));
fire("pointerup", penEvent(5, 170, 170, 0.5));
check("colour: blue stroke committed", countAfter(mark, "lineTo") >= 1);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
