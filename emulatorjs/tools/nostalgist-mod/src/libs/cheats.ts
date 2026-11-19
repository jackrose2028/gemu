import { vendors } from "./vendors.ts";
const { ini } = vendors;
const retroArchHandledCheat = 1;
function normalizeCheat(cheat) {
  const { code, description, enabled } = typeof cheat === "string" ? { code: cheat } : cheat;
  return { code, ...description ? { description } : {}, enabled: enabled === true };
}
function parseCheatFile(content) {
  const parsed = ini.parse(content);
  if (!("cheats" in parsed)) {
    throw new Error("the content does not look like a RetroArch cheat file");
  }
  const count = Number(parsed.cheats);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`the cheat file declares an invalid number of cheats: ${parsed.cheats}`);
  }
  const cheats = [];
  for (let index = 0; index < count; index += 1) {
    const code = parsed[`cheat${index}_code`];
    if (!code || Number(parsed[`cheat${index}_handler`]) === retroArchHandledCheat) {
      continue;
    }
    cheats.push(
      normalizeCheat({
        code,
        description: parsed[`cheat${index}_desc`],
        enabled: parsed[`cheat${index}_enable`] === true
      })
    );
  }
  return cheats;
}
function resolveCheatTargets(cheats, target) {
  if (typeof target === "number") {
    return Number.isInteger(target) && target >= 0 && target < cheats.length ? [target] : [];
  }
  const byDescription = cheats.flatMap((cheat, index) => cheat.description === target ? [index] : []);
  if (byDescription.length > 0) {
    return byDescription;
  }
  return cheats.flatMap((cheat, index) => cheat.code === target ? [index] : []);
}
export {
  normalizeCheat,
  parseCheatFile,
  resolveCheatTargets
};
