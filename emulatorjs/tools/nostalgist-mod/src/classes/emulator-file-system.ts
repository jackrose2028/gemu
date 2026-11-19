var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { checkIsAborted, delay } from "../libs/utils.ts";
import { vendors } from "../libs/vendors.ts";
import { ResolvableFile } from "./resolvable-file.ts";
const { ini, path } = vendors;
const userdataDirectory = "/home/web_user/retroarch/userdata";
const bundleDirectory = "/home/web_user/retroarch/bundle";
const contentDirectory = path.join(userdataDirectory, "content");
const systemDirectory = path.join(userdataDirectory, "system");
const configDirectory = path.join(userdataDirectory, "config");
const screenshotsDirectory = path.join(userdataDirectory, "screenshots");
const shaderDirectory = path.join(bundleDirectory, "shaders", "shaders_glsl");
const shaderAssetsDirectory = path.join(shaderDirectory, "shaders");
const configPath = path.join(userdataDirectory, "retroarch.cfg");
const coreConfigPath = path.join(userdataDirectory, "retroarch-core-options.cfg");
const _EmulatorFileSystem = class _EmulatorFileSystem {
  constructor({
    emscriptenModule,
    signal
  }) {
    __publicField(this, "emscriptenModule");
    __publicField(this, "signal");
    this.emscriptenModule = emscriptenModule;
    this.signal = signal;
  }
  get FS() {
    return this.emscriptenModule.FS;
  }
  static async create(...args) {
    const emulatorFileSystem = new _EmulatorFileSystem(...args);
    await emulatorFileSystem.prepare();
    return emulatorFileSystem;
  }
  mkdirTree(directory) {
    const { FS } = this;
    FS.mkdirTree(directory);
  }
  readdir(path2) {
    const { FS } = this;
    return FS.readdir(path2);
  }
  readFile(path2, encoding = "utf8") {
    const { FS } = this;
    return FS.readFile(path2, { encoding });
  }
  stat(path2) {
    const { FS } = this;
    try {
      return FS.stat(path2);
    } catch {
      return null;
    }
  }
  unlink(path2) {
    const { FS } = this;
    try {
      FS.unlink(path2);
    } catch {
    }
  }
  async waitForFile(fileName) {
    const maxRetries = 120;
    let lastSize = -1;
    let isFinished = false;
    let retryTimes = 0;
    while (retryTimes <= maxRetries && !isFinished) {
      const delayTime = Math.min(50 * 2 ** retryTimes, 500);
      await delay(delayTime);
      checkIsAborted(this.signal);
      const stats = this.stat(fileName);
      if (stats) {
        const currentSize = stats.size;
        if (lastSize > 0 && currentSize === lastSize) {
          isFinished = true;
        }
        lastSize = currentSize;
      }
      retryTimes += 1;
    }
    if (!isFinished) {
      throw new Error("fs timeout");
    }
    return this.readFile(fileName, "binary").buffer;
  }
  async writeFile(filePath, fileContent) {
    const { FS } = this;
    const directory = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const resolvable = await ResolvableFile.create(fileContent);
    const buffer = await resolvable.getUint8Array();
    FS.createDataFile("/", fileName, buffer, true, false);
    const encoding = "binary";
    const data = this.readFile(fileName, encoding);
    this.mkdirTree(directory);
    FS.writeFile(filePath, data, { encoding });
    this.unlink(fileName);
  }
  async writeIni(path2, config) {
    if (!config) {
      return;
    }
    const clonedConfig = {};
    for (const key in config) {
      clonedConfig[key] = `__${config[key]}__`;
    }
    const fileContent = ini.stringify(clonedConfig, { platform: "linux", whitespace: true }).replaceAll("__", '"');
    await this.writeFile(path2, fileContent);
  }
  async prepare() {
    const directories = [configDirectory, contentDirectory, shaderDirectory, shaderAssetsDirectory, systemDirectory];
    for (const directory of directories) {
      this.mkdirTree(directory);
    }
    const maxWaitTime = 100;
    let waitTime = 0;
    while (!this.emscriptenModule.asm && waitTime < maxWaitTime) {
      await delay(10);
      checkIsAborted(this.signal);
      waitTime += 5;
    }
  }
};
__publicField(_EmulatorFileSystem, "bundleDirectory", bundleDirectory);
__publicField(_EmulatorFileSystem, "configDirectory", configDirectory);
__publicField(_EmulatorFileSystem, "configPath", configPath);
__publicField(_EmulatorFileSystem, "contentDirectory", contentDirectory);
__publicField(_EmulatorFileSystem, "coreConfigPath", coreConfigPath);
__publicField(_EmulatorFileSystem, "screenshotsDirectory", screenshotsDirectory);
__publicField(_EmulatorFileSystem, "shaderDirectory", shaderDirectory);
__publicField(_EmulatorFileSystem, "systemDirectory", systemDirectory);
__publicField(_EmulatorFileSystem, "userdataDirectory", userdataDirectory);
let EmulatorFileSystem = _EmulatorFileSystem;
export {
  EmulatorFileSystem
};
