/* Linking + pages: drive the REAL app through create-link, navigate-in,
   pulled-header render, back, and link removal. Asserts via the read-only
   window.__ink seam and the rendered header ink. No IndexedDB needed. */
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

const ops = [];
const ctx = new Proxy({}, {
  get(_, k) {
    if (["lineWidth","lineCap","lineJoin","fillStyle","strokeStyle"].includes(k)) return 1;
    if (k === "setLineDash") return () => {};
    if (k === "save" || k === "restore" || k === "clip" || k === "rect") return () => { ops.push([k]); };
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
const swatches = ["cream","white","blue","pink"].map(c => recordingEl({ dataset: { color: c } }));
const els = { board: canvas, info: recordingEl(), erase: recordingEl(), link: recordingEl(),
  undo: recordingEl(), clear: recordingEl(), diag: recordingEl(), back: recordingEl({ hidden: true }),
  editTools: recordingEl(), modeEdit: recordingEl(), modeView: recordingEl() };

const win = { devicePixelRatio: 2, innerWidth: 800, innerHeight: 1200, isSecureContext: false,
  confirm: () => true, addEventListener() {} };
const doc = { visibilityState: "visible", getElementById: id => els[id],
  querySelectorAll: sel => (sel === ".swatch" ? swatches : []), addEventListener() {} };
class PE {} PE.prototype.getCoalescedEvents = function () { return []; };

new Function("window","document","navigator","PointerEvent", appSrc)(win, doc, {}, PE);
const ink = win.__ink;

const pen = (id, x, y, p, c) => ({ pointerId: id, pointerType: "pen", clientX: x, clientY: y, pressure: p || 0.5,
  getCoalescedEvents: () => c || [], preventDefault() {} });
const fire = (t, ev) => (canvas._handlers[t] || []).forEach(fn => fn(ev));
const inkLineTosSince = i => ops.slice(i).filter(o => o[0] === "lineTo").length;

let pass = 0, fail = 0;
const check = (n, c) => { c ? (pass++, console.log("  ok  " + n)) : (fail++, console.log("FAIL  " + n)); };

// 1) draw a body stroke inside the area we'll box
fire("pointerdown", pen(1, 210, 310, 0.6));
fire("pointermove", pen(1, 240, 340, 0.6, [pen(1, 225, 325, 0.6), pen(1, 240, 340, 0.6)]));
fire("pointerup", pen(1, 240, 340, 0.6));
check("start: one stroke, one page, no links", ink.strokes() === 1 && ink.pages() === 1 && ink.links() === 0);

// 2) link tool: drag a box around the stroke -> child page + link + header snapshot
els.link.fire("click");
fire("pointerdown", pen(2, 190, 290, 0.5));
fire("pointermove", pen(2, 270, 370, 0.5, [pen(2, 230, 330, 0.5), pen(2, 270, 370, 0.5)]));
fire("pointerup", pen(2, 270, 370, 0.5));
check("link: child page created", ink.pages() === 2);
check("link: link added to current page", ink.links() === 1);
check("link: still on root", ink.page() === "root");

// 3) view mode: tap inside the box -> navigate into the child
els.modeView.fire("click");
check("mode: switched to view", ink.mode() === "view");
const beforeNav = ops.length;
fire("pointerdown", pen(3, 230, 330, 0.5));
fire("pointerup", pen(3, 230, 330, 0.5));      // no movement => tap
check("nav: moved off root into child", ink.page() !== "root");
check("nav: child body is empty", ink.strokes() === 0);
check("nav: child has a pulled header", ink.header() === true);
check("nav: pulled header rendered captured ink", inkLineTosSince(beforeNav) >= 1);

// 4) back to root
els.back.fire("click");
check("back: returned to root", ink.page() === "root");
check("back: root has no header", ink.header() === false);

// 5) link removal: edit mode, deterministically select the link tool, then
//    tap (no drag) on the existing box to remove it.
els.modeEdit.fire("click");
swatches[0].fire("click");                       // known state: tool = draw
els.link.fire("click");                          // tool = link
fire("pointerdown", pen(4, 230, 330, 0.5));
fire("pointerup", pen(4, 230, 330, 0.5));        // tap on the box -> remove link
check("remove: link tapped away", ink.links() === 0);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
