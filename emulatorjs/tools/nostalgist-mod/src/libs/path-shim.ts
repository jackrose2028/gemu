function normalize(input) {
  const absolute = input.startsWith("/");
  const parts = [];
  for (const part of input.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length && parts.at(-1) !== "..") parts.pop();
      else if (!absolute) parts.push("..");
    } else {
      parts.push(part);
    }
  }
  const joined = parts.join("/");
  return (absolute ? "/" : "") + joined || (absolute ? "/" : ".");
}
function join(...segments) {
  const filtered = segments.filter((s) => typeof s === "string" && s.length > 0);
  return filtered.length ? normalize(filtered.join("/")) : ".";
}
function dirname(p) {
  const index = p.replace(/\/+$/, "").lastIndexOf("/");
  if (index < 0) return ".";
  if (index === 0) return "/";
  return p.slice(0, index);
}
function basename(p, ext) {
  const base = p.replace(/\/+$/, "").split("/").pop() || "";
  return ext && base.endsWith(ext) && base !== ext ? base.slice(0, -ext.length) : base;
}
function extname(p) {
  const base = basename(p);
  const index = base.lastIndexOf(".");
  return index <= 0 ? "" : base.slice(index);
}
function parse(p) {
  const root = p.startsWith("/") ? "/" : "";
  const base = basename(p);
  const ext = extname(p);
  const dir = p.includes("/") ? dirname(p) : "";
  return { base, dir, ext, name: ext ? base.slice(0, -ext.length) : base, root };
}
var stdin_default = { basename, dirname, extname, join, normalize, parse, sep: "/" };
export {
  stdin_default as default
};
