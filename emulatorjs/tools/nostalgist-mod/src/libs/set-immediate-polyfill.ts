const originalSetImmediate = globalThis.setImmediate;
let setImmediateChannel = null;
const setImmediateQueue = [];
function immediatePolyfill(callback, ...args) {
  if (typeof originalSetImmediate === "function") {
    return originalSetImmediate(callback, ...args);
  }
  if (typeof MessageChannel !== "undefined") {
    if (!setImmediateChannel) {
      setImmediateChannel = new MessageChannel();
      setImmediateChannel.port1.addEventListener("message", () => {
        const fn = setImmediateQueue.shift();
        if (fn) {
          try {
            fn();
          } catch {
          }
        }
      });
      setImmediateChannel.port1.start();
    }
    setImmediateQueue.push(() => callback(...args));
    setImmediateChannel.port2.postMessage(0);
    return 0;
  }
  return setTimeout(() => callback(...args), 0);
}
function installSetImmediatePolyfill() {
  if (typeof globalThis.setImmediate === "function") {
    return;
  }
  ;
  globalThis.setImmediate = immediatePolyfill;
}
function uninstallSetImmediatePolyfill() {
  if (globalThis.setImmediate === immediatePolyfill) {
    delete globalThis.setImmediate;
  }
}
export {
  installSetImmediatePolyfill,
  uninstallSetImmediatePolyfill
};
