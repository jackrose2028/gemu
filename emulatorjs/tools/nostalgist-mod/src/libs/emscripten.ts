const logTagPattern = /^\[(?<core>libretro )?(?<level>DEBUG|ERROR|INFO|WARN)\] ?/u;
function parseLogLine(raw, stream) {
  const tag = logTagPattern.exec(raw);
  if (!tag?.groups) {
    return { level: stream === "stderr" ? "error" : "info", message: raw, source: "frontend" };
  }
  const { core, level } = tag.groups;
  return {
    level: level.toLowerCase(),
    message: raw.slice(tag[0].length),
    source: core ? "core" : "frontend"
  };
}
function logToConsole({ level, message, source }) {
  console[level](source === "core" ? `[libretro] ${message}` : message);
}
function emitLog(onLog, args, stream) {
  try {
    onLog(parseLogLine(args.map(String).join(" "), stream));
  } catch (error) {
    console.error(error);
  }
}
function getEmscriptenModuleOverrides(overrides, { onLog } = {}) {
  let resolveRunDependenciesPromise;
  const runDependenciesPromise = new Promise((resolve) => {
    resolveRunDependenciesPromise = resolve;
  });
  const handleLog = onLog ?? logToConsole;
  const emscriptenModuleOverrides = {
    noExitRuntime: false,
    noInitialRun: true,
    locateFile(file) {
      return file;
    },
    // the return value of `monitorRunDependencies` seems to be misused here, but it works for now
    async monitorRunDependencies(left) {
      if (left === 0) {
        resolveRunDependenciesPromise();
      }
      return await runDependenciesPromise;
    },
    print(...args) {
      emitLog(handleLog, args, "stdout");
    },
    printErr(...args) {
      emitLog(handleLog, args, "stderr");
    },
    // @ts-expect-error do not throw error when exit
    quit(status, toThrow) {
      if (status) {
        console.info(status, toThrow);
      }
    },
    ...overrides
  };
  return emscriptenModuleOverrides;
}
export {
  getEmscriptenModuleOverrides,
  parseLogLine
};
