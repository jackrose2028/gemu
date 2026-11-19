var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { normalizeCheat } from "../libs/cheats.ts";
import { getGlobalOptions } from "../libs/options.ts";
import { generateValidFileName, getResult, merge } from "../libs/utils.ts";
import { ResolvableFile } from "./resolvable-file.ts";
function isPlainObject(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
}
function isValidCacheKey(cacheKey) {
  return typeof cacheKey === "string" || isPlainObject(cacheKey);
}
function getCacheStore() {
  return {
    bios: /* @__PURE__ */ new Map(),
    core: /* @__PURE__ */ new Map(),
    rom: /* @__PURE__ */ new Map(),
    shader: /* @__PURE__ */ new Map(),
    sram: /* @__PURE__ */ new Map(),
    state: /* @__PURE__ */ new Map()
  };
}
const _EmulatorOptions = class _EmulatorOptions {
  constructor(options) {
    __publicField(this, "beforeLaunch");
    __publicField(this, "bios", []);
    __publicField(this, "cache", { bios: false, core: false, rom: false, shader: false, sram: false, state: false });
    __publicField(this, "cheats", []);
    __publicField(this, "core", {});
    __publicField(this, "element");
    /**
     * An option to override the `Module` object for Emscripten. See [Module object](https://emscripten.org/docs/api_reference/module.html).
     *
     * This is a low level option and not well tested, so use it at your own risk.
     */
    __publicField(this, "emscriptenModule");
    __publicField(this, "onLog");
    __publicField(this, "respondToGlobalEvents");
    __publicField(this, "rom", []);
    __publicField(this, "shader", []);
    __publicField(this, "signal");
    /**
     *
     * The size of the canvas element.
     * If it's `'auto'`, the canvas element will keep its original size, or it's width and height will be updated as specified.
     */
    __publicField(this, "size");
    __publicField(this, "sram");
    __publicField(this, "sramType");
    __publicField(this, "state");
    __publicField(this, "multiDisc");
    __publicField(this, "multiDiscRom");
    __publicField(this, "multiDiscIndex");
    __publicField(this, "waitForInteraction");
    __publicField(this, "loadPromises", []);
    __publicField(this, "nostalgistOptions");
    this.nostalgistOptions = options;
    this.emscriptenModule = options.emscriptenModule ?? {};
    this.cheats = (options.cheats ?? []).map((cheat) => normalizeCheat(cheat));
    this.onLog = options.onLog;
    this.respondToGlobalEvents = options.respondToGlobalEvents ?? true;
    this.signal = options.signal;
    this.size = options.size ?? "auto";
    this.sramType = options.sramType ?? "srm";
    this.waitForInteraction = options.waitForInteraction;
    this.element = this.getElement();
    if (typeof options.cache === "boolean") {
      for (const key in this.cache) {
        this.cache[key] = options.cache;
      }
    } else {
      Object.assign(this.cache, options.cache);
    }
  }
  /**
   * RetroArch config.
   * Not all options can make effects in browser.
   */
  get retroarchConfig() {
    const options = {};
    merge(options, getGlobalOptions().retroarchConfig, this.nostalgistOptions.retroarchConfig);
    return options;
  }
  /**
   * RetroArch core config.
   * Not all options can make effects in browser.
   */
  get retroarchCoreConfig() {
    const options = {};
    merge(options, getGlobalOptions().retroarchCoreConfig, this.nostalgistOptions.retroarchCoreConfig);
    return options;
  }
  get style() {
    const { element, style } = this.nostalgistOptions;
    const defaultAppearanceStyle = {
      backgroundColor: "black",
      imageRendering: "pixelated"
    };
    if (element) {
      merge(defaultAppearanceStyle, style);
      return defaultAppearanceStyle;
    }
    const defaultLayoutStyle = {
      height: "100%",
      left: "0",
      position: "fixed",
      top: "0",
      width: "100%",
      zIndex: "1"
    };
    merge(defaultLayoutStyle, defaultAppearanceStyle, style);
    return defaultLayoutStyle;
  }
  static async create(options) {
    const emulatorOptions = new _EmulatorOptions(options);
    await emulatorOptions.load();
    return emulatorOptions;
  }
  static resetCacheStore() {
    Object.assign(_EmulatorOptions.cacheStorage, getCacheStore());
  }
  async load() {
    this.loadFromCache();
    await Promise.all(this.loadPromises);
    this.saveToCache();
  }
  loadFromCache() {
    const loadPromises = [];
    const loadMethodMap = {
      bios: this.updateBios,
      core: this.updateCore,
      rom: this.updateRom,
      shader: this.updateShader,
      sram: this.updateSRAM,
      state: this.updateState
    };
    for (const key in this.cache) {
      const field = key;
      if (this.cache[field]) {
        const cache = _EmulatorOptions.cacheStorage[field];
        const cacheKey = this.nostalgistOptions[field];
        if (isValidCacheKey(cacheKey)) {
          const cacheValue = cache.get(cacheKey);
          if (cacheValue) {
            this[field] = cacheValue;
            continue;
          }
        }
      }
      const method = loadMethodMap[field];
      const promise = method.call(this);
      loadPromises.push(promise);
    }
    this.loadPromises = loadPromises;
  }
  saveToCache() {
    for (const key in this.cache) {
      const field = key;
      if (this.cache[field]) {
        const cache = _EmulatorOptions.cacheStorage[field];
        const cacheKey = this.nostalgistOptions[field];
        const cacheValue = this[field];
        if (isValidCacheKey(cacheKey) && cacheValue) {
          cache.set(cacheKey, cacheValue);
        }
      }
    }
  }
  async updateSRAM() {
    if (this.nostalgistOptions.sram) {
      this.sram = await ResolvableFile.create(this.nostalgistOptions.sram);
    }
  }
  async updateState() {
    if (this.nostalgistOptions.state) {
      this.state = await ResolvableFile.create(this.nostalgistOptions.state);
    }
  }
  getElement() {
    if (typeof document !== "object") {
      throw new TypeError("document must be an object");
    }
    let { element } = this.nostalgistOptions;
    if (typeof element === "string" && element) {
      const canvas = document.body.querySelector(element);
      if (!canvas) {
        throw new Error(`can not find element "${element}"`);
      }
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new TypeError(`element "${element}" is not a canvas element`);
      }
      element = canvas;
    }
    if (!element) {
      element = document.createElement("canvas");
    }
    if (element instanceof HTMLCanvasElement) {
      element.id = "canvas";
      return element;
    }
    throw new TypeError("invalid element");
  }
  async updateBios() {
    const { resolveBios } = this.nostalgistOptions;
    let { bios } = this.nostalgistOptions;
    if (!bios) {
      return;
    }
    bios = await getResult(bios);
    if (!bios) {
      return;
    }
    const biosFiles = Array.isArray(bios) ? bios : [bios];
    this.bios = await Promise.all(
      biosFiles.map(
        (raw) => ResolvableFile.create(
          typeof raw === "string" ? { raw, signal: this.signal, urlResolver: () => resolveBios(raw, this.nostalgistOptions) } : { raw, signal: this.signal }
        )
      )
    );
  }
  async updateCore() {
    const { core, resolveCoreJs, resolveCoreWasm } = this.nostalgistOptions;
    if (typeof core === "object" && "js" in core && "name" in core && "wasm" in core) {
      const [js, wasm] = await Promise.all([ResolvableFile.create(core.js), ResolvableFile.create(core.wasm)]);
      this.core = { js, name: core.name, wasm };
      return;
    }
    const [coreResolvable, coreWasmResolvable] = await Promise.all(
      [resolveCoreJs, resolveCoreWasm].map(
        (resolver) => ResolvableFile.create({
          raw: core,
          signal: this.signal,
          urlResolver: () => resolver(core, this.nostalgistOptions)
        })
      )
    );
    const name = typeof core === "string" ? core : coreResolvable.name;
    this.core = { js: coreResolvable, name, wasm: coreWasmResolvable };
  }
  async updateRom() {
    let { rom } = this.nostalgistOptions;
    if (!rom) {
      return;
    }
    rom = await getResult(rom);
    if (!rom) {
      return;
    }
    const romFiles = Array.isArray(rom) ? rom : [rom];
    const firstFile = await this.createResolvableFile(romFiles[0]);
    this.multiDisc = firstFile.name.endsWith(".m3u");
    this.rom = [firstFile];
    if (this.multiDisc) {
      this.rom.push(await this.createResolvableFile(romFiles[1]));
      this.multiDiscRom = /* @__PURE__ */ new Map();
      for (const [index, file] of romFiles.slice(2).entries()) {
        this.multiDiscRom?.set(index + 2, file);
      }
      return;
    }
    this.rom.push(...await Promise.all(romFiles.slice(1).map((file) => this.createResolvableFile(file))));
  }
  async createResolvableFile(file) {
    const { resolveRom } = this.nostalgistOptions;
    const rom = await ResolvableFile.create(
      typeof file === "string" ? { raw: file, signal: this.signal, urlResolver: () => resolveRom(file, this.nostalgistOptions) } : { raw: file, signal: this.signal }
    );
    rom.name || (rom.name = generateValidFileName());
    return rom;
  }
  async updateShader() {
    const { resolveShader } = this.nostalgistOptions;
    let { shader } = this.nostalgistOptions;
    if (!shader) {
      return;
    }
    shader = await getResult(shader);
    if (!shader) {
      return;
    }
    let rawShaderFile = await resolveShader(shader, this.nostalgistOptions);
    if (!rawShaderFile) {
      return;
    }
    rawShaderFile = await getResult(rawShaderFile);
    if (!rawShaderFile) {
      return;
    }
    const rawShaderFiles = Array.isArray(rawShaderFile) ? rawShaderFile : [rawShaderFile];
    this.shader = await Promise.all(
      rawShaderFiles.map((rawShaderFile2) => ResolvableFile.create({ raw: rawShaderFile2, signal: this.signal }))
    );
  }
};
__publicField(_EmulatorOptions, "cacheStorage", getCacheStore());
let EmulatorOptions = _EmulatorOptions;
export {
  EmulatorOptions
};
