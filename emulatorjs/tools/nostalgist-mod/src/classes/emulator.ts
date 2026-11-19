var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { coreInfoMap } from "../constants/core-info.ts";
import { keyboardCodeMap } from "../constants/keyboard-code-map.ts";
import { normalizeCheat, resolveCheatTargets } from "../libs/cheats.ts";
import { getEmscriptenModuleOverrides } from "../libs/emscripten.ts";
import { importCoreJsAsESM } from "../libs/emulator-utils.ts";
import {
  checkIsAborted,
  delay,
  installSetImmediatePolyfill,
  padZero,
  textEncoder,
  uninstallSetImmediatePolyfill,
  updateStyle
} from "../libs/utils.ts";
import { vendors } from "../libs/vendors.ts";
import { EjsInputBridge } from "./ejs-input-bridge.ts";
import { EmulatorFileSystem } from "./emulator-file-system.ts";
const { ini, path } = vendors;
const interactableElements = [
  globalThis.HTMLAnchorElement,
  globalThis.HTMLButtonElement,
  globalThis.HTMLDetailsElement,
  globalThis.HTMLInputElement,
  globalThis.HTMLSelectElement,
  globalThis.HTMLTextAreaElement
].filter(Boolean);
function isInteractable(element) {
  return element && interactableElements.some((clazz) => element instanceof clazz);
}
const EJS_STATE_PATH = "/nostalgist-mod.state";
const EJS_SCREENSHOT_PATH = "/screenshot.png";
class Emulator {
  constructor(options) {
    __publicField(this, "blobUrlJs");
    __publicField(this, "blobUrlWasm");
    __publicField(this, "cachedKeyboardCodes", null);
    __publicField(this, "cachedRetroarchConfigMtime", 0);
    __publicField(this, "canvasInitialSize", { height: 0, width: 0 });
    __publicField(this, "emscripten");
    __publicField(this, "eventListeners", {
      beforeLaunch: [],
      onLaunch: []
    });
    __publicField(this, "fileSystem");
    __publicField(this, "gameStatus", "initial");
    __publicField(this, "inputBridge");
    __publicField(this, "globalDOMEventListeners", /* @__PURE__ */ new Map());
    __publicField(this, "messageQueue", []);
    __publicField(this, "options");
    __publicField(this, "ejsExports");
    this.options = options;
  }
  get coreFullName() {
    const { core } = this.options;
    const coreFullName = coreInfoMap[core.name]?.corename || core.name;
    if (!coreFullName) {
      throw new Error(`invalid core name: ${core.name}`);
    }
    return coreFullName;
  }
  get enabledCheats() {
    return this.options.cheats.filter(({ enabled }) => enabled);
  }
  get fs() {
    if (!this.fileSystem) {
      throw new Error("fileSystem is not ready");
    }
    return this.fileSystem;
  }
  get romBaseName() {
    const {
      rom: [{ baseName }]
    } = this.options;
    return baseName;
  }
  get sramFileDirectory() {
    return path.join(EmulatorFileSystem.userdataDirectory, "saves", this.coreFullName);
  }
  get sramFilePath() {
    return path.join(this.sramFileDirectory, `${this.romBaseName}.${this.sramFileType}`);
  }
  get sramFileType() {
    return this.options.sramType;
  }
  get stateFileDirectory() {
    return path.join(EmulatorFileSystem.userdataDirectory, "states", this.coreFullName);
  }
  get stateFilePath() {
    return path.join(this.stateFileDirectory, `${this.romBaseName}.state`);
  }
  get stateThumbnailFilePath() {
    return `${this.stateFilePath}.png`;
  }
  addCheat(cheat) {
    this.options.cheats.push(normalizeCheat(cheat));
    return this.syncCheats();
  }
  callCommand(command) {
    const { Module } = this.getEmscripten();
    Module[command]?.();
  }
  clearCheats() {
    return this.setCheats([]);
  }
  disableCheat(target) {
    return this.setCheatsEnabled(target, false);
  }
  enableCheat(target) {
    return this.setCheatsEnabled(target, true);
  }
  exit(statusCode = 0) {
    this.inputBridge?.destroy();
    this.inputBridge = void 0;
    const { exit, JSEvents } = this.getEmscripten();
    try {
      exit(statusCode);
    } catch {
    }
    JSEvents.removeAllEventListeners();
    this.removeGlobalDOMEventListeners();
    if (this.blobUrlWasm !== void 0) {
      URL.revokeObjectURL(this.blobUrlWasm);
      this.blobUrlWasm = void 0;
    }
    if (this.blobUrlJs !== void 0) {
      URL.revokeObjectURL(this.blobUrlJs);
      this.blobUrlJs = void 0;
    }
    uninstallSetImmediatePolyfill();
    this.gameStatus = "terminated";
  }
  getCheats() {
    return this.options.cheats.map((cheat) => ({ ...cheat }));
  }
  getEmscripten() {
    if (!this.emscripten) {
      throw new Error("emulator is not ready");
    }
    return this.emscripten;
  }
  getOptions() {
    return this.options;
  }
  getStatus() {
    return this.gameStatus;
  }
  async launch() {
    const { element, respondToGlobalEvents, signal, style, waitForInteraction } = this.options;
    updateStyle(element, style);
    const removeProperty = element.style.removeProperty.bind(element.style);
    element.style.removeProperty = (property) => {
      if (property !== "width" && property !== "height") {
        return removeProperty(property);
      }
      return element.style[property];
    };
    if (!element.isConnected) {
      document.body.append(element);
      signal?.addEventListener("abort", () => {
        element?.remove();
      });
    }
    this.canvasInitialSize = this.getElementSize();
    if (!respondToGlobalEvents) {
      if (!element.tabIndex || element.tabIndex === -1) {
        element.tabIndex = 0;
      }
      const { activeElement } = document;
      element.focus();
      signal?.addEventListener("abort", () => {
        if (activeElement instanceof HTMLElement) {
          activeElement.focus();
        }
      });
    }
    await this.runEventListeners("beforeLaunch");
    if (waitForInteraction) {
      waitForInteraction({
        done: async () => {
          this.runMain();
          await this.runEventListeners("onLaunch");
        }
      });
    } else {
      this.runMain();
      await this.runEventListeners("onLaunch");
    }
  }
  async loadState(state) {
    const ejs = this.getEjsExports();
    if (ejs.loadState) {
      const bytes = new Uint8Array(await state.getArrayBuffer());
      try {
        this.getEmscripten().Module.FS.unlink(EJS_STATE_PATH);
      } catch {
      }
      this.getEmscripten().Module.FS.writeFile(EJS_STATE_PATH, bytes);
      ejs.loadState(EJS_STATE_PATH, 0);
      return;
    }
    this.clearStateFile();
    await this.fs.writeFile(this.stateFilePath, state);
    await this.fs.waitForFile(this.stateFilePath);
    this.sendCommand("LOAD_STATE");
  }
  on(event, callback) {
    this.eventListeners[event].push(callback);
    return this;
  }
  pause() {
    if (this.gameStatus === "running") {
      this.sendCommand("PAUSE_TOGGLE");
    }
    this.gameStatus = "paused";
  }
  async press(button, player = 1, time = 100) {
    if (this.inputBridge?.setButton(button, player, true)) {
      await delay(time);
      this.inputBridge.setButton(button, player, false);
      return;
    }
    const code = this.getKeyboardCode(button, player);
    if (code) {
      await this.keyboardPress(code, time);
    }
  }
  pressDown(button, player = 1) {
    if (this.inputBridge?.setButton(button, player, true)) return;
    const code = this.getKeyboardCode(button, player);
    if (code) {
      this.keyboardDown(code);
    }
  }
  pressUp(button, player = 1) {
    if (this.inputBridge?.setButton(button, player, false)) return;
    const code = this.getKeyboardCode(button, player);
    if (code) {
      this.keyboardUp(code);
    }
  }
  resize({ height, width }) {
    const { Module } = this.getEmscripten();
    if (typeof width === "number" && typeof height === "number") {
      try {
        Module.setCanvasSize(width, height);
      } catch (error) {
        if (error instanceof DOMException) {
          Module.canvas.setAttribute("width", width.toString());
          Module.canvas.setAttribute("height", height.toString());
        } else {
          throw error;
        }
      }
    }
  }
  restart() {
    this.sendCommand("RESET");
    this.resume();
  }
  resume() {
    if (this.gameStatus === "paused") {
      this.sendCommand("PAUSE_TOGGLE");
    }
    this.gameStatus = "running";
  }
  async saveSRAM() {
    this.fs.unlink(this.sramFilePath);
    this.callCommand("_cmd_savefiles");
    const buffer = await this.fs.waitForFile(this.sramFilePath);
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    return blob;
  }
  async saveState() {
    const ejs = this.getEjsExports();
    if (ejs.saveStateInfo) {
      const [size, pointer, ok] = ejs.saveStateInfo().split("|");
      if (ok !== "1") {
        throw new Error(`failed to save state: ${size}`);
      }
      const { Module } = this.getEmscripten();
      const start = Number.parseInt(pointer, 10);
      const copy = Module.HEAPU8.slice(start, start + Number.parseInt(size, 10));
      const state2 = new Blob([copy], { type: "application/octet-stream" });
      const { multiDiscIndex: multiDiscIndex2 } = this.options;
      return { state: state2, thumbnail: void 0, ...multiDiscIndex2 !== void 0 && { multiDiscIndex: multiDiscIndex2 } };
    }
    this.clearStateFile();
    this.sendCommand("SAVE_STATE");
    const savestateThumbnailEnable = this.options.retroarchConfig.savestate_thumbnail_enable;
    let stateBuffer;
    let stateThumbnailBuffer;
    if (savestateThumbnailEnable) {
      ;
      [stateBuffer, stateThumbnailBuffer] = await Promise.all([
        this.fs.waitForFile(this.stateFilePath),
        this.fs.waitForFile(this.stateThumbnailFilePath)
      ]);
    } else {
      stateBuffer = await this.fs.waitForFile(this.stateFilePath);
    }
    this.clearStateFile();
    const state = new Blob([stateBuffer], { type: "application/octet-stream" });
    const thumbnail = stateThumbnailBuffer ? new Blob([stateThumbnailBuffer], { type: "image/png" }) : void 0;
    const { multiDiscIndex } = this.options;
    return { state, thumbnail, ...multiDiscIndex !== void 0 && { multiDiscIndex } };
  }
  async screenshot() {
    if (this.getEjsExports().isEjsBuild) {
      try {
        this.fs.unlink(EJS_SCREENSHOT_PATH);
      } catch {
      }
      this.callCommand("_cmd_take_screenshot");
      const buffer2 = await this.fs.waitForFile(EJS_SCREENSHOT_PATH);
      this.fs.unlink(EJS_SCREENSHOT_PATH);
      return new Blob([buffer2], { type: "image/png" });
    }
    this.sendCommand("SCREENSHOT");
    const screenshotFileName = this.guessScreenshotFileName();
    const screenshotPath = path.join(EmulatorFileSystem.screenshotsDirectory, screenshotFileName);
    const buffer = await this.fs.waitForFile(screenshotPath);
    this.fs.unlink(screenshotPath);
    return new Blob([buffer], { type: "image/png" });
  }
  sendCommand(msg) {
    const exportedCommand = {
      LOAD_STATE: "_cmd_load_state",
      PAUSE_TOGGLE: "_cmd_toggle_pause",
      RESET: "_cmd_reset",
      SAVE_STATE: "_cmd_save_state",
      SCREENSHOT: "_cmd_take_screenshot"
    };
    const { Module } = this.getEmscripten();
    if (exportedCommand[msg] && exportedCommand[msg] in Module) {
      this.callCommand(exportedCommand[msg]);
    } else if ("EmscriptenSendCommand" in Module) {
      Module.EmscriptenSendCommand?.(msg);
    } else {
      const bytes = textEncoder.encode(`${msg}
`);
      this.messageQueue.push([bytes, 0]);
    }
  }
  setCheats(cheats) {
    this.options.cheats = cheats.map((cheat) => normalizeCheat(cheat));
    return this.syncCheats();
  }
  async setup() {
    await this.setupEmscripten();
    await this.setupFileSystem();
  }
  async switchDisc(index) {
    const { multiDiscRom } = this.options;
    if (!multiDiscRom) {
      return;
    }
    let delta = this.options.multiDiscIndex ? index - this.options.multiDiscIndex : 0;
    if (delta === 0) {
      return;
    }
    const requestedRom = multiDiscRom.get(index);
    if (requestedRom) {
      const requestedResolvableFile = await this.options.createResolvableFile(requestedRom);
      if (!requestedResolvableFile) {
        return;
      }
      await this.fs.writeFile(
        path.join(EmulatorFileSystem.contentDirectory, requestedResolvableFile.name),
        requestedResolvableFile
      );
      multiDiscRom.delete(index);
    }
    this.sendCommand("DISK_EJECT_TOGGLE");
    while (delta !== 0) {
      if (delta > 0) {
        this.sendCommand("DISK_NEXT");
        delta -= 1;
      } else {
        this.sendCommand("DISK_PREV");
        delta += 1;
      }
    }
    this.sendCommand("DISK_EJECT_TOGGLE");
    this.options.multiDiscIndex = index;
  }
  /** Functions only EmulatorJS core builds export; empty for regular RetroArch builds. */
  getEjsExports() {
    if (!this.ejsExports) {
      const Module = this.getEmscripten().Module;
      const cwrap = Module.cwrap;
      const isEjsBuild = typeof Module._simulate_input === "function";
      this.ejsExports = { isEjsBuild };
      if (isEjsBuild && typeof cwrap === "function") {
        if (typeof Module._save_state_info === "function") this.ejsExports.saveStateInfo = cwrap("save_state_info", "string", []);
        if (typeof Module._load_state === "function") this.ejsExports.loadState = cwrap("load_state", "number", ["string", "number"]);
      }
    }
    return this.ejsExports;
  }
  clearStateFile() {
    try {
      this.fs.unlink(this.stateFilePath);
      this.fs.unlink(this.stateThumbnailFilePath);
    } catch {
    }
  }
  fireKeyboardEvent(type, code) {
    const { JSEvents } = this.getEmscripten();
    for (const { eventListenerFunc, eventTypeString } of JSEvents.eventHandlers) {
      if (eventTypeString === type) {
        try {
          eventListenerFunc({ code, target: this.options.element });
        } catch {
        }
      }
    }
  }
  getCurrentRetroarchConfig() {
    const configContent = this.fs.readFile(EmulatorFileSystem.configPath);
    return ini.parse(configContent);
  }
  getElementSize() {
    const { element, size } = this.options;
    return !size || size === "auto" ? { height: element.offsetHeight, width: element.offsetWidth } : size;
  }
  getKeyboardCode(button, player = 1) {
    const stats = this.fs.stat(EmulatorFileSystem.configPath);
    const currentMtime = stats ? stats.mtime.getTime() : 0;
    if (!this.cachedKeyboardCodes || currentMtime > this.cachedRetroarchConfigMtime) {
      const config = this.getCurrentRetroarchConfig();
      this.cachedKeyboardCodes = /* @__PURE__ */ new Map();
      this.cachedRetroarchConfigMtime = currentMtime;
      for (const configKey in config) {
        if (configKey.startsWith("input_player")) {
          this.cachedKeyboardCodes.set(configKey, config[configKey]);
        }
      }
    }
    const configName = `input_player${player}_${button}`;
    const key = this.cachedKeyboardCodes.get(configName);
    if (!key || key === "nul") {
      return;
    }
    const { length } = key;
    if (length === 1) {
      return `Key${key.toUpperCase()}`;
    }
    if (key.startsWith("f") && (length === 2 || length === 3)) {
      return key.toUpperCase();
    }
    if (length === 4 && key.startsWith("num")) {
      return `Numpad${key.at(-1)}`;
    }
    if (length === 7 && key.startsWith("keypad")) {
      return `Digit${key.at(-1)}`;
    }
    return keyboardCodeMap[key] || "";
  }
  guessScreenshotFileName() {
    const date = /* @__PURE__ */ new Date();
    const year = date.getFullYear() % 1e3;
    const month = padZero(date.getMonth() + 1);
    const day = padZero(date.getDate());
    const hour = padZero(date.getHours());
    const minute = padZero(date.getMinutes());
    const second = padZero(date.getSeconds());
    const dateString = `${year}${month}${day}-${hour}${minute}${second}`;
    const baseName = this.romBaseName;
    return `${baseName}-${dateString}.png`;
  }
  keyboardDown(code) {
    this.fireKeyboardEvent("keydown", code);
  }
  async keyboardPress(code, time = 100) {
    this.keyboardDown(code);
    await delay(time);
    this.keyboardUp(code);
  }
  keyboardUp(code) {
    this.fireKeyboardEvent("keyup", code);
  }
  postRun() {
    this.resize(this.canvasInitialSize);
    for (const gamepad of navigator.getGamepads?.() ?? []) {
      if (gamepad) {
        globalThis.dispatchEvent(new GamepadEvent("gamepadconnected", { gamepad }));
      }
    }
    this.updateKeyboardEventHandlers();
    const { Module } = this.getEmscripten();
    const simulate = Module._simulate_input;
    if (typeof simulate === "function" && !this.inputBridge) {
      const { element, respondToGlobalEvents } = this.options;
      this.inputBridge = new EjsInputBridge(
        (player, index, value) => simulate(player, index, value),
        (button, player) => this.getKeyboardCode(button, player),
        respondToGlobalEvents ? document : element,
        element,
        respondToGlobalEvents
      );
    }
    if (this.enabledCheats.length > 0) {
      this.syncCheats();
    }
  }
  recordGlobalDOMEventListeners() {
    for (const eventTarget of [globalThis, document]) {
      eventTarget.addEventListener = (...args) => {
        const [type, listener] = args;
        const value = this.globalDOMEventListeners.get(eventTarget) || {};
        value[type] = listener;
        this.globalDOMEventListeners.set(eventTarget, value);
        return EventTarget.prototype.addEventListener.apply(eventTarget, args);
      };
    }
  }
  removeGlobalDOMEventListeners() {
    for (const [eventTarget, eventListeners] of this.globalDOMEventListeners) {
      for (const eventType in eventListeners) {
        const listener = eventListeners[eventType];
        eventTarget.removeEventListener(eventType, listener);
      }
    }
  }
  async runEventListeners(event) {
    const { [event]: eventListeners } = this.eventListeners;
    for (const eventListener of eventListeners) {
      await eventListener();
    }
  }
  runMain() {
    checkIsAborted(this.options.signal);
    const { Module } = this.getEmscripten();
    const raArgs = Module.arguments || [];
    const { rom, signal } = this.options;
    if (!Module.arguments && rom.length > 0) {
      const [{ name }] = rom;
      raArgs.push(path.join(EmulatorFileSystem.contentDirectory, name));
    }
    raArgs.push("-c", EmulatorFileSystem.configPath);
    installSetImmediatePolyfill();
    this.recordGlobalDOMEventListeners();
    if (this.options.multiDisc) {
      this.options.multiDiscIndex = 1;
    }
    Module.callMain(raArgs);
    for (const [eventTarget] of this.globalDOMEventListeners) {
      delete eventTarget.addEventListener;
    }
    signal?.addEventListener("abort", () => {
      this.exit();
    });
    this.gameStatus = "running";
    this.postRun();
  }
  setCheatsEnabled(target, enabled) {
    const indexes = resolveCheatTargets(this.options.cheats, target);
    if (indexes.length === 0) {
      return false;
    }
    for (const index of indexes) {
      this.options.cheats[index].enabled = enabled;
    }
    return this.syncCheats();
  }
  async setupEmscripten() {
    const { core, element, emscriptenModule, onLog } = this.options;
    const { js, name, wasm } = core;
    const { locateFile } = emscriptenModule;
    const blobJs = (() => {
      try {
        return js.getBlob();
      } catch {
      }
    })();
    const blobWasm = (() => {
      try {
        return wasm.getBlob();
      } catch {
      }
    })();
    if (blobJs !== void 0 && this.blobUrlJs === void 0) {
      this.blobUrlJs = URL.createObjectURL(blobJs);
    }
    if (blobWasm !== void 0 && this.blobUrlWasm === void 0) {
      this.blobUrlWasm = URL.createObjectURL(blobWasm);
    }
    const moduleOptions = {
      canvas: element,
      // NostalgistMod: EmulatorJS core builds bind keyboard events to Module.parent ("!parent")
      parent: element.parentElement || document.body,
      preRun: [],
      wasmBinary: await wasm.getArrayBuffer(),
      ...blobJs === void 0 ? {} : { mainScriptUrlOrBlob: blobJs },
      ...emscriptenModule,
      locateFile: (url, scriptDirectory) => {
        if (this.blobUrlJs !== void 0 && url === `${name}_libretro.js`) {
          return this.blobUrlJs;
        }
        if (this.blobUrlWasm !== void 0 && url === `${name}_libretro.wasm`) {
          return this.blobUrlWasm;
        }
        if (typeof locateFile === "function") {
          return locateFile(url, scriptDirectory);
        }
        return scriptDirectory + url;
      }
    };
    const initialModule = getEmscriptenModuleOverrides(moduleOptions, { onLog });
    initialModule.preRun?.push(() => {
      if (typeof initialModule.FS.init === "function") {
        initialModule.FS.init(() => this.stdin());
      }
    });
    const { getEmscripten } = await importCoreJsAsESM(core);
    checkIsAborted(this.options.signal);
    const emscripten = await getEmscripten({ Module: initialModule });
    checkIsAborted(this.options.signal);
    const Module = emscripten.Module ?? emscripten;
    this.emscripten = { ...emscripten, Module };
    await Module.monitorRunDependencies();
    checkIsAborted(this.options.signal);
  }
  async setupFileSystem() {
    const { Module } = this.getEmscripten();
    const { bios, rom, signal, sram, state } = this.options;
    for (const { name } of bios) {
      if (!name) {
        throw new Error("file name is required for bios");
      }
    }
    const fileSystem = await EmulatorFileSystem.create({ emscriptenModule: Module, signal });
    this.fileSystem = fileSystem;
    if (state) {
      this.fs.mkdirTree(this.stateFileDirectory);
    }
    if (sram) {
      this.fs.mkdirTree(this.sramFileDirectory);
    }
    const filePromises = [
      ...rom.map((file) => this.fs.writeFile(path.join(EmulatorFileSystem.contentDirectory, file.name), file)),
      ...bios.map((file) => this.fs.writeFile(path.join(EmulatorFileSystem.systemDirectory, file.name), file))
    ];
    if (state) {
      filePromises.push(this.fs.writeFile(`${this.stateFilePath}.auto`, state));
    }
    if (sram) {
      filePromises.push(this.fs.writeFile(this.sramFilePath, sram));
    }
    await Promise.all(filePromises);
    checkIsAborted(signal);
    await this.setupRaConfigFiles();
    checkIsAborted(this.options.signal);
  }
  async setupRaConfigFiles() {
    await this.fs.writeIni(EmulatorFileSystem.configPath, this.options.retroarchConfig);
    await this.fs.writeIni(EmulatorFileSystem.coreConfigPath, this.options.retroarchCoreConfig);
    await this.setupRaShaderFiles();
  }
  async setupRaShaderFiles() {
    const { shader } = this.options;
    if (shader.length === 0) {
      return;
    }
    const glslpFiles = shader.filter((file) => file.name.endsWith(".glslp"));
    if (glslpFiles.length === 0) {
      return;
    }
    for (const { name } of shader) {
      if (!name) {
        throw new Error("file name is required for shader");
      }
    }
    const globalGlslpContent = glslpFiles.map((file) => `#reference "${path.join(EmulatorFileSystem.shaderDirectory, file.name)}"`).join("\n");
    await this.fs.writeFile(path.join(EmulatorFileSystem.configDirectory, "global.glslp"), globalGlslpContent);
    await Promise.all(
      shader.map(async (resolvable) => {
        const directory = resolvable.extension === ".glslp" ? EmulatorFileSystem.shaderDirectory : path.join(EmulatorFileSystem.shaderDirectory, "shaders");
        await this.fs.writeFile(path.join(directory, resolvable.name), resolvable);
      })
    );
  }
  // copied from https://github.com/libretro/RetroArch/pull/15017
  stdin() {
    const { messageQueue } = this;
    while (messageQueue.length > 0) {
      const msg = messageQueue[0][0];
      const index = messageQueue[0][1];
      if (index >= msg.length) {
        messageQueue.shift();
      } else {
        messageQueue[0][1] = index + 1;
        return msg[index];
      }
    }
    return null;
  }
  /**
   * Rebuilds RetroArch's cheat list so that it contains exactly the enabled cheats.
   * Rebuilding, instead of toggling individual cheats, keeps `this.options.cheats` the only source of truth,
   * and avoids `cmd_cheat_toggle_index`, which flips a cheat's state rather than setting it.
   */
  syncCheats() {
    const { Module } = this.getEmscripten();
    if (!("_cmd_cheat_realloc" in Module)) {
      return false;
    }
    if (this.gameStatus === "initial") {
      return true;
    }
    const {
      _cmd_cheat_apply_cheats: applyCheats,
      _cmd_cheat_realloc: realloc,
      _cmd_cheat_set_code: setCode,
      _free: free
    } = Module;
    const { enabledCheats } = this;
    realloc(0);
    realloc(Math.max(enabledCheats.length, 1));
    for (const [index, { code }] of enabledCheats.entries()) {
      const pointer = Module.stringToNewUTF8(code);
      setCode(index, pointer);
      free(pointer);
    }
    applyCheats();
    if (enabledCheats.length === 0) {
      realloc(0);
    }
    return true;
  }
  updateKeyboardEventHandlers() {
    const { JSEvents } = this.getEmscripten();
    const { element, respondToGlobalEvents } = this.options;
    if (!respondToGlobalEvents) {
      if (!element.getAttribute("tabindex")) {
        element.tabIndex = -1;
      }
      element.focus();
      element.addEventListener("click", () => {
        element.focus();
      });
    }
    const keyboardEvents = /* @__PURE__ */ new Set(["keydown", "keypress", "keyup"]);
    const globalKeyboardEventHandlers = JSEvents.eventHandlers.filter(
      ({ eventTypeString, target }) => keyboardEvents.has(eventTypeString) && (target === document || target === element)
    );
    for (const globalKeyboardEventHandler of globalKeyboardEventHandlers) {
      const { eventTypeString, handlerFunc, target } = globalKeyboardEventHandler;
      JSEvents.registerOrRemoveHandler({ eventTypeString, target });
      JSEvents.registerOrRemoveHandler({
        ...globalKeyboardEventHandler,
        handlerFunc: (...args) => {
          const [event] = args;
          const target2 = event?.target;
          const isValidEmulatorInput = respondToGlobalEvents ? !isInteractable(target2) : target2 === element;
          if (isValidEmulatorInput) {
            handlerFunc(...args);
          }
        },
        target: respondToGlobalEvents ? document : element
      });
    }
  }
}
export {
  Emulator
};
