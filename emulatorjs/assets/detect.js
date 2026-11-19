// System detection for local ROM files: extension table, header magic bytes and zip contents.

// [EJS system id, label, extensions]. Extensions shared by several systems trigger header sniffing, then the picker.
export const SYSTEMS = [
    ["nes", "Nintendo Entertainment System", ["nes", "fds", "unif", "unf"]],
    ["snes", "Super Nintendo", ["smc", "sfc", "fig", "swc", "gd3", "gd7", "dx2", "bsx", "bs", "st"]],
    ["gb", "Game Boy / Color", ["gb", "gbc", "dmg"]],
    ["gba", "Game Boy Advance", ["gba"]],
    ["n64", "Nintendo 64", ["n64", "z64", "v64", "u1", "ndd"]],
    ["nds", "Nintendo DS", ["nds"]],
    ["vb", "Virtual Boy", ["vb", "vboy"]],
    ["segaMS", "Sega Master System", ["sms"]],
    ["segaMD", "Sega Genesis / Mega Drive", ["md", "smd", "gen", "mdx", "sg", "68k", "sgd", "bms", "bin"]],
    ["segaGG", "Sega Game Gear", ["gg"]],
    ["sega32x", "Sega 32X", ["32x"]],
    ["segaCD", "Sega CD", ["cue", "iso", "chd"]],
    ["segaSaturn", "Sega Saturn", ["cue", "iso", "chd", "ccd", "mds"]],
    ["psx", "PlayStation", ["cue", "bin", "iso", "img", "chd", "pbp", "m3u", "ccd", "toc", "exe", "mdf", "cbn"]],
    ["psp", "PlayStation Portable", ["iso", "cso", "pbp", "elf", "prx"]],
    ["pce", "TurboGrafx-16 / PC Engine", ["pce", "cue", "ccd", "chd"]],
    ["pcfx", "NEC PC-FX", ["cue", "ccd", "toc", "chd"]],
    ["ngp", "Neo Geo Pocket", ["ngp", "ngc"]],
    ["ws", "WonderSwan", ["ws", "wsc", "pc2"]],
    ["coleco", "ColecoVision", ["col", "cv"]],
    ["atari2600", "Atari 2600", ["a26", "bin"]],
    ["atari5200", "Atari 5200", ["a52"]],
    ["atari7800", "Atari 7800", ["a78"]],
    ["lynx", "Atari Lynx", ["lnx"]],
    ["jaguar", "Atari Jaguar", ["j64", "jag", "abs", "cof"]],
    ["3do", "3DO", ["iso", "cue", "chd"]],
    ["arcade", "Arcade (FinalBurn Neo)", ["zip", "7z"]],
    ["mame", "Arcade (MAME 2003)", ["zip"]],
    ["amiga", "Amiga", ["adf", "adz", "dms", "ipf", "hdf", "hdz", "lha", "uae", "fdi"]],
    ["c64", "Commodore 64", ["d64", "t64", "prg", "crt", "x64", "p00", "nib", "g64", "tcrt", "vsf"]],
    ["c128", "Commodore 128", ["d71", "d81", "d80", "d82"]],
    ["vic20", "Commodore VIC-20", ["20", "40", "60", "a0", "b0"]],
    ["plus4", "Commodore Plus/4", []],
    ["pet", "Commodore PET", []],
    ["cap32", "Amstrad CPC", ["dsk", "sna", "cdt", "voc", "cpr"]],
    ["fuse", "ZX Spectrum", ["tzx", "z80", "rzx", "scl", "trd", "tap"]],
    ["81", "ZX81", ["p", "t81"]],
    ["prboom", "Doom", ["wad", "iwad", "pwad"]],
    ["dos", "DOS (DOSBox Pure)", ["conf", "zip"]]
];

export const PATCH_EXTENSIONS = ["ips", "bps", "ups"];
const BIOS_NAME = /(bios|scph\d|syscard|disksys|firmware|kick\d|kickstart|dc_boot|neogeo\.zip|gba_bios|bios7|bios9)/i;

export const extensionOf = (name) => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");
export const labelFor = (system) => (SYSTEMS.find(([id]) => id === system) || [system, system])[1];

/** Systems (limited to `available`) that claim this extension. */
export function systemsForExtension(ext, available) {
    return available.filter(([, , exts]) => exts.includes(ext)).map(([id]) => id);
}

/** Splits dropped files into ROM, BIOS and patch. The largest remaining file is the ROM. */
export function classifyFiles(files) {
    const result = { rom: null, bios: null, patch: null };
    const rest = [];
    for (const file of files) {
        const ext = extensionOf(file.name);
        if (PATCH_EXTENSIONS.includes(ext) && !result.patch) result.patch = file;
        else if (BIOS_NAME.test(file.name) && files.length > 1 && !result.bios) result.bios = file;
        else rest.push(file);
    }
    rest.sort((a, b) => b.size - a.size);
    result.rom = rest[0] || null;
    if (!result.rom && result.bios) {
        result.rom = result.bios;
        result.bios = null;
    }
    return result;
}

function text(bytes, offset, length) {
    let out = "";
    for (let i = offset; i < offset + length && i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return out;
}

/** Identifies a system from the first 64 KB of a file, or returns null. */
export function sniffHeader(h) {
    if (h.length < 16) return null;
    const head4 = text(h, 0, 4);
    if (head4 === "NES\x1a" || head4 === "FDS\x1a" || text(h, 1, 13) === "*NINTENDO-HVC") return "nes";
    const be = ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0;
    if (be === 0x80371240 || be === 0x37804012 || be === 0x40123780) return "n64";
    if (head4 === "LYNX") return "lynx";
    if (text(h, 1, 9) === "ATARI7800") return "atari7800";
    // Disc images: Sega boot sectors, 3DO volume header, ISO9660 system identifier
    for (const o of [0, 16]) {
        const boot = text(h, o, 16);
        if (boot.startsWith("SEGA SEGASATURN")) return "segaSaturn";
        if (boot.startsWith("SEGADISCSYSTEM")) return "segaCD";
    }
    if (h[0] === 1 && h[1] === 0x5a && h[2] === 0x5a && h[3] === 0x5a && h[4] === 0x5a && h[5] === 0x5a && h[6] === 1) return "3do";
    for (const o of [0x8000, 16 * 2352 + 16, 16 * 2352 + 24]) {
        if (text(h, o + 1, 5) === "CD001") {
            const id = text(h, o + 8, 32);
            if (id.includes("PLAYSTATION")) return "psx";
            if (id.includes("PSP GAME")) return "psp";
        }
    }
    // Cartridges
    if (h.length > 0x150 && h[0x104] === 0xce && h[0x105] === 0xed && h[0x106] === 0x66 && h[0x107] === 0x66) return "gb";
    if (h.length > 0xc0 && h[4] === 0x24 && h[5] === 0xff && h[6] === 0xae && h[7] === 0x51 && h[0xb2] === 0x96) return "gba";
    if (h.length > 0xc4 && h[0xc0] === 0x24 && h[0xc1] === 0xff && h[0xc2] === 0xae && h[0xc3] === 0x51) return "nds";
    const sega = text(h, 0x100, 16);
    if (sega.startsWith("SEGA 32X")) return "sega32x";
    if (/^ ?SEGA/.test(sega)) return "segaMD";
    for (const o of [0x7ff0, 0x3ff0, 0x1ff0]) {
        if (text(h, o, 8) === "TMR SEGA") {
            const region = h[o + 15] >> 4;
            return region >= 5 && region <= 7 ? "segaGG" : "segaMS";
        }
    }
    return null;
}

/** Lists the file names stored in a zip's central directory (no decompression). */
export async function zipEntries(file) {
    const tailSize = Math.min(file.size, 66000);
    const tail = new Uint8Array(await file.slice(file.size - tailSize).arrayBuffer());
    const view = new DataView(tail.buffer);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0) return [];
    const size = view.getUint32(eocd + 12, true);
    const offset = view.getUint32(eocd + 16, true);
    if (offset + size > file.size) return [];
    const dir = new Uint8Array(await file.slice(offset, offset + size).arrayBuffer());
    const dv = new DataView(dir.buffer);
    const names = [];
    const decoder = new TextDecoder();
    for (let p = 0; p + 46 <= dir.length && dv.getUint32(p, true) === 0x02014b50;) {
        const nameLength = dv.getUint16(p + 28, true);
        const extra = dv.getUint16(p + 30, true);
        const comment = dv.getUint16(p + 32, true);
        names.push(decoder.decode(dir.subarray(p + 46, p + 46 + nameLength)));
        p += 46 + nameLength + extra + comment;
    }
    return names;
}

/** Picks a system from the files inside a zip, when they all point the same way. */
export async function sniffZip(file, available) {
    let names;
    try { names = await zipEntries(file); } catch (e) { return null; }
    const files = names.filter((n) => !n.endsWith("/"));
    if (!files.length) return null;
    const ids = available.map(([id]) => id);
    if (ids.includes("dos") && files.some((n) => /\.(exe|com|bat)$/i.test(n))) return "dos";
    let found = null;
    for (const name of files) {
        const matches = systemsForExtension(extensionOf(name), available).filter((s) => !["arcade", "mame", "dos"].includes(s));
        if (matches.length !== 1) continue;
        if (found && found !== matches[0]) return null;
        found = matches[0];
    }
    return found;
}

/**
 * Resolves the system for a ROM: unique extension, then header bytes, then zip contents.
 * Returns { system, candidates } where system may be null and candidates feed the picker.
 */
export async function detectSystem(file, available) {
    const ext = extensionOf(file.name);
    const candidates = systemsForExtension(ext, available);
    if (candidates.length === 1) return { system: candidates[0], candidates };
    const ids = available.map(([id]) => id);
    try {
        const head = new Uint8Array(await file.slice(0, 0x10000).arrayBuffer());
        const sniffed = sniffHeader(head);
        if (sniffed && ids.includes(sniffed)) return { system: sniffed, candidates };
    } catch (e) { /* unreadable */ }
    if (ext === "zip") {
        const fromZip = await sniffZip(file, available);
        if (fromZip) return { system: fromZip, candidates };
    }
    return { system: null, candidates };
}
