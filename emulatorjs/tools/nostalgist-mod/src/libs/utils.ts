import { uninstallSetImmediatePolyfill } from "./set-immediate-polyfill.ts";
import { vendors } from "./vendors.ts";
import { installSetImmediatePolyfill, uninstallSetImmediatePolyfill as uninstallSetImmediatePolyfill2 } from "./set-immediate-polyfill.ts";
const { path } = vendors;
const textEncoder = new TextEncoder();
function urlBaseName(url) {
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
  }
  const name = path.basename(pathname);
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}
let i = 0;
function id() {
  i += 1;
  return i;
}
function generateValidFileName(extension = "bin") {
  return `data${id()}.${extension}`;
}
function extractValidFileName(url) {
  let baseName = urlBaseName(url) || "";
  baseName = baseName.replaceAll(/["%*/:<>?\\|]/gu, "-");
  const extractedExtension = path.parse(baseName).ext;
  if (extractedExtension) {
    return baseName;
  }
  return "";
}
function isAbsoluteUrl(string) {
  if (!string) {
    return false;
  }
  if (typeof string !== "string") {
    return false;
  }
  const absolutePrefixes = ["http://", "https://", "//", "data:", "blob:"];
  return absolutePrefixes.some((absolutePrefix) => string.startsWith(absolutePrefix));
}
function updateStyle(element, style) {
  if (!element) {
    return;
  }
  for (const rule in style) {
    const value = style[rule];
    element.style[rule] = value || null;
  }
}
function delay(time) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}
function isNil(obj) {
  return obj === void 0 || obj === null;
}
function isPlainObject(obj) {
  if (isNil(obj)) {
    return false;
  }
  return obj.constructor === Object || !obj.constructor;
}
function mergeProperty(target, source, key) {
  const targetValue = target[key];
  const sourceValue = source[key];
  if (isNil(targetValue)) {
    target[key] = sourceValue;
  } else if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
    target[key] = [...targetValue, ...sourceValue];
  } else if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
    target[key] = isPlainObject(targetValue) ? target[key] : {};
    merge(target[key], sourceValue);
  } else {
    target[key] = sourceValue;
  }
}
function merge(target, ...sources) {
  if (sources.length === 1) {
    const [source] = sources;
    for (const key in source) {
      mergeProperty(target, source, key);
    }
  } else {
    for (const source of sources) {
      merge(target, source);
    }
  }
}
function checkIsAborted(signal) {
  if (signal?.aborted) {
    uninstallSetImmediatePolyfill();
    throw new Error("Launch aborted");
  }
}
function padZero(number) {
  return (number < 10 ? "0" : "") + number;
}
async function getResult(value) {
  if (!value) {
    return value;
  }
  if (typeof value?.then === "function") {
    return getResult(await value);
  }
  if (typeof value === "function") {
    return getResult(value());
  }
  return value;
}
function isResolvableFileContent(value) {
  if (typeof value === "string") {
    return true;
  }
  const resolvableClasses = [
    globalThis.Response,
    globalThis.Uint8Array,
    globalThis.URL,
    globalThis.Request,
    globalThis.Response,
    globalThis.FileSystemFileHandle,
    globalThis.Blob
  ];
  return resolvableClasses.some((clazz) => clazz && value instanceof clazz);
}
function isResolvableFileInput(value) {
  if (typeof value === "string") {
    return true;
  }
  if ("fileContent" in value) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((item) => isResolvableFileInput(item));
  }
  return isResolvableFileContent(value);
}
function isZip(uint8Array) {
  return uint8Array[0] === 80 && uint8Array[1] === 75 && (uint8Array[2] === 3 || uint8Array[2] === 5 || uint8Array[2] === 7) && (uint8Array[3] === 4 || uint8Array[3] === 6 || uint8Array[3] === 8);
}
export {
  checkIsAborted,
  delay,
  extractValidFileName,
  generateValidFileName,
  getResult,
  installSetImmediatePolyfill,
  isAbsoluteUrl,
  isNil,
  isResolvableFileContent,
  isResolvableFileInput,
  isZip,
  merge,
  padZero,
  textEncoder,
  uninstallSetImmediatePolyfill2 as uninstallSetImmediatePolyfill,
  updateStyle,
  urlBaseName
};
