import { ResolvableFile } from "../classes/resolvable-file.ts";
function isGlobalScript(js) {
  return js.startsWith("var Module");
}
function isEsmScript(js) {
  return js.includes("import.meta.url");
}
function isEmulatorJsScript(js) {
  return js.includes("var EJS_Runtime");
}
async function patchCoreJs({ js, name }) {
  let jsContent = await js.getText();
  name = name.replaceAll("-", "_");
  if (isGlobalScript(jsContent)) {
    jsContent = `export function getEmscripten({ Module }) {
        ${jsContent};
        Module.FS = FS;
        Module.PATH = PATH;
        Module.ERRNO_CODES = ERRNO_CODES;
        return {
          AL: typeof AL === 'undefined' ? null: AL,
          Browser: typeof Browser === 'undefined' ? null: Browser,
          JSEvents,
          Module,
          exit: _emscripten_force_exit
         }
      }`;
  } else if (isEmulatorJsScript(jsContent)) {
    const internals = `{
          AL: typeof AL === 'undefined' ? null: AL,
          Browser: typeof Browser === 'undefined' ? null: Browser,
          JSEvents,
          Module,
          exit: _emscripten_force_exit
        }`;
    jsContent = `${jsContent.replace("var setImmediate;", "").replace("readyPromiseResolve(Module)", `readyPromiseResolve(${internals})`)};
    export function getEmscripten({ Module }) {
      return EJS_Runtime(Module)
    }
    `;
  } else if (isEsmScript(jsContent)) {
    jsContent = `${jsContent.replace("var setImmediate", "").replace(
      "readyPromiseResolve(Module)",
      `readyPromiseResolve({
          AL: typeof AL === 'undefined' ? null: AL,
          Browser: typeof Browser === 'undefined' ? null: Browser,
          JSEvents,
          Module,
          exit: _emscripten_force_exit
        })`
    ).replace(
      "return moduleRtn;",
      `return moduleRtn.then((Module) => ({
          AL: typeof AL === 'undefined' ? null: AL,
          Browser: typeof Browser === 'undefined' ? null: Browser,
          JSEvents,
          exit: _emscripten_force_exit,
          ...Module,
        }));`
    )};
    export function getEmscripten({ Module }) {
      const fnA = (typeof libretro_${name} === "function") ? libretro_${name} : null;
      const fnB = (typeof ${name} === "function") ? ${name} : null;

      const factory = fnA || fnB;

      return factory ? factory(Module) : null;
    }
    `;
  }
  return jsContent;
}
async function importCoreJsAsESM({ js, name }) {
  const jsContent = await patchCoreJs({ js, name });
  const jsResolvable = await ResolvableFile.create({ blobType: "application/javascript", raw: jsContent });
  const jsObjectUrl = jsResolvable.getObjectUrl();
  try {
    return await import(
      /* @vite-ignore */
      /* webpackIgnore: true */
      jsObjectUrl
    );
  } catch {
    return await new Function(`return import('${jsObjectUrl}')`)();
  } finally {
    jsResolvable.dispose();
  }
}
export {
  importCoreJsAsESM
};
