var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const ejsButtonIndex = {
  b: 0,
  y: 1,
  select: 2,
  start: 3,
  up: 4,
  down: 5,
  left: 6,
  right: 7,
  a: 8,
  x: 9,
  l: 10,
  r: 11,
  l2: 12,
  r2: 13,
  l3: 14,
  r3: 15
};
const standardPadToRetro = [0, 8, 1, 9, 10, 11, 12, 13, 2, 3, 14, 15, 4, 5, 6, 7];
const ANALOG = 32767;
const isInteractable = (target) => target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement || target instanceof HTMLElement && target.isContentEditable;
class EjsInputBridge {
  constructor(simulate, lookup, target, element, global) {
    this.simulate = simulate;
    this.lookup = lookup;
    this.target = target;
    this.element = element;
    this.global = global;
    __publicField(this, "held", /* @__PURE__ */ new Set());
    __publicField(this, "keyMap", /* @__PURE__ */ new Map());
    __publicField(this, "frame", 0);
    __publicField(this, "padState", /* @__PURE__ */ new Map());
    __publicField(this, "listeners", []);
    __publicField(this, "stopped", false);
    this.rebuildKeyMap();
    const onKey = (event) => this.onKey(event);
    this.listen(this.target, "keydown", onKey);
    this.listen(this.target, "keyup", onKey);
    this.listen(globalThis, "blur", () => this.releaseAll());
    this.listen(document, "visibilitychange", () => document.hidden && this.releaseAll());
    this.pollGamepads = this.pollGamepads.bind(this);
    this.frame = requestAnimationFrame(this.pollGamepads);
  }
  /** Sets a RetroPad button by Nostalgist name ("a", "start", "up" …) for a 1-based player. */
  setButton(button, player, pressed) {
    const index = ejsButtonIndex[button.toLowerCase()];
    if (index === void 0) return false;
    this.send(player - 1, index, pressed ? 1 : 0);
    return true;
  }
  rebuildKeyMap() {
    this.keyMap = /* @__PURE__ */ new Map();
    for (let player = 1; player <= 4; player++) {
      for (const button of Object.keys(ejsButtonIndex)) {
        const code = this.lookup(button, player);
        if (!code) continue;
        const list = this.keyMap.get(code) || [];
        list.push([player - 1, ejsButtonIndex[button]]);
        this.keyMap.set(code, list);
      }
    }
  }
  destroy() {
    this.stopped = true;
    cancelAnimationFrame(this.frame);
    this.releaseAll();
    for (const [target, type, listener] of this.listeners) target.removeEventListener(type, listener);
    this.listeners.length = 0;
  }
  listen(target, type, listener) {
    target.addEventListener(type, listener);
    this.listeners.push([target, type, listener]);
  }
  send(player, index, value) {
    const key = `${player}:${index}`;
    if (value) this.held.add(key);
    else this.held.delete(key);
    this.simulate(player, index, value);
  }
  releaseAll() {
    for (const key of Array.from(this.held)) {
      const [player, index] = key.split(":").map(Number);
      this.held.delete(key);
      this.simulate(player, index, 0);
    }
    this.padState.clear();
  }
  onKey(event) {
    if (this.global ? isInteractable(event.target) : event.target !== this.element) return;
    const targets = this.keyMap.get(event.code);
    if (!targets) return;
    event.preventDefault();
    if (event.repeat) return;
    for (const [player, index] of targets) this.send(player, index, event.type === "keydown" ? 1 : 0);
  }
  pollGamepads() {
    if (this.stopped) return;
    const pads = (navigator.getGamepads?.() ?? []).filter(Boolean);
    pads.forEach((pad, slot) => {
      if (slot > 3) return;
      const previous = this.padState.get(pad.index) || [];
      const next = [];
      for (let i = 0; i < standardPadToRetro.length; i++) {
        const button = pad.buttons[i];
        next[standardPadToRetro[i]] = button && (button.pressed || button.value > 0.5) ? 1 : 0;
      }
      const [lx = 0, ly = 0, rx = 0, ry = 0] = pad.axes;
      if (lx < -0.5) next[6] = 1;
      if (lx > 0.5) next[7] = 1;
      if (ly < -0.5) next[4] = 1;
      if (ly > 0.5) next[5] = 1;
      const analog = (value) => Math.abs(value) < 0.1 ? 0 : Math.round(Math.abs(value) * ANALOG);
      next[16] = lx > 0 ? analog(lx) : 0;
      next[17] = lx < 0 ? analog(lx) : 0;
      next[18] = ly > 0 ? analog(ly) : 0;
      next[19] = ly < 0 ? analog(ly) : 0;
      next[20] = rx > 0 ? analog(rx) : 0;
      next[21] = rx < 0 ? analog(rx) : 0;
      next[22] = ry > 0 ? analog(ry) : 0;
      next[23] = ry < 0 ? analog(ry) : 0;
      for (let index = 0; index < 24; index++) {
        const value = next[index] || 0;
        if ((previous[index] || 0) !== value) this.send(slot, index, value);
      }
      this.padState.set(pad.index, next);
    });
    this.frame = requestAnimationFrame(this.pollGamepads);
  }
}
export {
  EjsInputBridge,
  ejsButtonIndex
};
