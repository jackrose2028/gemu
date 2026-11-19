var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import {
  extractValidFileName,
  generateValidFileName,
  getResult,
  isNil,
  isResolvableFileContent,
  isZip
} from "../libs/utils.ts";
import { vendors } from "../libs/vendors.ts";
const { path } = vendors;
const fileNameHeaderRegex = /filename[^;=\n]*=(?<filename>(?<quote>['"]).*?\k<quote>|[^;\n]*)/u;
const urlSegmentSeparator = /[?/#]/u;
function isURLStringLike(value) {
  if (typeof value !== "string") {
    return false;
  }
  const prefixes = ["http://", "https://", "data:", "blob:", "./", "../"];
  if (prefixes.some((absolutePrefix) => value.startsWith(absolutePrefix))) {
    return true;
  }
  if (["#", "{"].some((char) => value.startsWith(char))) {
    return false;
  }
  if (value.includes("\n")) {
    return false;
  }
  const segments = value.split(urlSegmentSeparator);
  if (segments.length < 2) {
    return false;
  }
  return segments.every((segment) => segment.length < 100);
}
function isURL(value) {
  return typeof globalThis.URL === "function" && value instanceof globalThis.URL;
}
function isRequest(value) {
  return typeof globalThis.Request === "function" && value instanceof globalThis.Request;
}
function isResponse(value) {
  return typeof globalThis.Response === "function" && value instanceof globalThis.Response;
}
function isArrayBuffer(value) {
  return typeof globalThis.ArrayBuffer === "function" && value instanceof globalThis.ArrayBuffer;
}
function isUint8Array(value) {
  return typeof globalThis.Uint8Array === "function" && value instanceof globalThis.Uint8Array;
}
function isBlob(value) {
  return typeof globalThis.Blob === "function" && value instanceof globalThis.Blob;
}
function isFileSystemFileHandle(value) {
  return typeof globalThis.FileSystemFileHandle === "function" && value instanceof globalThis.FileSystemFileHandle;
}
function isFetchable(value) {
  return isURLStringLike(value) || isURL(value) || isRequest(value);
}
class ResolvableFile {
  constructor({ blobType, name, raw, signal, urlResolver }) {
    __publicField(this, "name", "");
    __publicField(this, "arrayBuffer");
    __publicField(this, "blob");
    __publicField(this, "blobType", "application/octet-stream");
    __publicField(this, "objectUrl");
    __publicField(this, "raw");
    __publicField(this, "signal");
    __publicField(this, "text");
    __publicField(this, "uint8Array");
    __publicField(this, "urlResolver");
    this.raw = raw;
    if (signal) {
      this.signal = signal;
    }
    if (urlResolver) {
      this.urlResolver = urlResolver;
    }
    if (blobType) {
      this.blobType = blobType;
    }
    if (name) {
      this.name = extractValidFileName(name);
    }
  }
  /** The base name of the file, without its extension. */
  get baseName() {
    return path.parse(this.name).name;
  }
  /** The extension name of the file, with a leading ".". */
  get extension() {
    return path.parse(this.name).ext;
  }
  static async create(rawOrOption) {
    if (isNil(rawOrOption)) {
      throw new Error("parameter is not valid");
    }
    if (rawOrOption instanceof ResolvableFile) {
      return rawOrOption;
    }
    const option = typeof rawOrOption === "object" && "raw" in rawOrOption ? rawOrOption : { raw: rawOrOption };
    const resolvableFile = new ResolvableFile(option);
    await resolvableFile.load();
    return resolvableFile;
  }
  dispose() {
    if (typeof this.objectUrl === "string") {
      URL.revokeObjectURL(this.objectUrl);
    }
  }
  async getArrayBuffer() {
    if (this.arrayBuffer) {
      return this.arrayBuffer;
    }
    this.arrayBuffer = await this.getBlob().arrayBuffer();
    return this.arrayBuffer;
  }
  getBlob() {
    if (!this.blob) {
      throw new Error("blob is not available");
    }
    return this.blob;
  }
  getObjectUrl() {
    if (this.objectUrl) {
      return this.objectUrl;
    }
    this.objectUrl = URL.createObjectURL(this.getBlob());
    return this.objectUrl;
  }
  async getText() {
    if (this.text !== void 0) {
      return this.text;
    }
    this.text = await this.getBlob().text();
    return this.text;
  }
  async getUint8Array() {
    if (this.uint8Array) {
      return this.uint8Array;
    }
    const arrayBuffer = await this.getArrayBuffer();
    this.uint8Array = new Uint8Array(arrayBuffer);
    return this.uint8Array;
  }
  async load() {
    const result = await getResult(this.urlResolver ? this.urlResolver(this) : this.raw);
    if (typeof result === "object" && "fileContent" in result && "fileName" in result) {
      const [fileName, fileContent] = await Promise.all([getResult(result.fileName), getResult(result.fileContent)]);
      await this.loadContent({ fileContent, fileName });
    } else {
      await this.loadContent(result);
    }
  }
  loadArrayBuffer(arrayBuffer) {
    this.arrayBuffer = arrayBuffer;
    this.blob = new Blob([arrayBuffer], { type: this.blobType });
  }
  async loadContent(content) {
    if (isBlob(content)) {
      this.blob = content;
      if (!this.name && typeof File !== "undefined" && content instanceof File && content.name) {
        this.name = extractValidFileName(content.name);
      }
    } else if (isFetchable(content)) {
      await this.loadFetchable(content);
    } else if (typeof content === "string") {
      this.loadPlainText(content);
    } else if (isResolvableFileContent(content?.fileContent)) {
      await this.loadObject(content);
    } else if (isArrayBuffer(content)) {
      this.loadArrayBuffer(content);
    } else if (isUint8Array(content)) {
      this.loadUint8Array(content);
    } else if (isResponse(content)) {
      await this.loadResponse(content);
    } else if (isFileSystemFileHandle(content)) {
      await this.loadFileSystemFileHandle(content);
    } else {
      throw new TypeError("failed to resolve the file, file content:", content);
    }
    const uint8Array = await this.getUint8Array();
    const extention = isZip(uint8Array) ? "zip" : "bin";
    this.name || (this.name = generateValidFileName(extention));
  }
  async loadFetchable(fetchable) {
    if (isRequest(fetchable)) {
      this.name || (this.name = extractValidFileName(fetchable.url));
    } else if (isURL(fetchable)) {
      this.name || (this.name = extractValidFileName(fetchable.href));
    } else {
      this.name || (this.name = extractValidFileName(fetchable));
    }
    const response = await fetch(fetchable, { signal: this.signal || null });
    await this.loadResponse(response);
  }
  async loadFileSystemFileHandle(fileSystemFileHandle) {
    const file = await fileSystemFileHandle.getFile();
    this.blob = file;
    this.name = extractValidFileName(file.name);
  }
  async loadObject(object) {
    const [fileName, fileContent] = await Promise.all([getResult(object.fileName), getResult(object.fileContent)]);
    this.name || (this.name = extractValidFileName(fileName));
    await this.loadContent(fileContent);
  }
  loadPlainText(text) {
    this.blob = new Blob([text], { type: this.blobType });
  }
  async loadResponse(response) {
    const header = response.headers.get("Content-Disposition");
    if (header) {
      const extracted = fileNameHeaderRegex.exec(header)?.groups?.filename?.replaceAll(/['"]/gu, "");
      if (extracted) {
        this.name || (this.name = extractValidFileName(extracted));
      }
    }
    if (!response.ok) {
      throw new Error("Failed to load response", { cause: response });
    }
    this.blob = await response.blob();
    this.name || (this.name = extractValidFileName(response.url));
  }
  loadUint8Array(uint8Array) {
    this.uint8Array = uint8Array;
    this.blob = new Blob([uint8Array], { type: this.blobType });
  }
}
export {
  ResolvableFile
};
