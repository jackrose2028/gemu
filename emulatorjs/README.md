# EmulatorJS (local build)

A separate local EmulatorJS build, added alongside the existing Emu game shelf. Its files live under `emulatorjs/`, and its Links page points back to the original Emu project.

This attached archive does not include the core `.7z` binaries. To run games here, add the core archives you are licensed to distribute to `data/cores/` and refresh the manifest. EmulatorJS core files are not interchangeable with the Emu project's older `.data` files.

## Quick start

1. Add core archives (`*.7z`, unchanged) to `data/cores/`. This attached archive does not include them.
2. Refresh the core list with `node tools/generate-core-manifest.mjs`.
3. Serve the folder with a local web server: on Windows double-click `start-windows.bat`; elsewhere run
   `python3 serve.py 8000` and open `http://localhost:8000`. Both need Python installed.

Opening `index.html` straight from disk (`file://`) does not work: browsers block ES modules there.

## Publish on GitHub Pages

1. Commit everything, including `data/cores/*.7z` (largest archive is about 8 MB; the whole set is about 284 MB).
2. In the repository: **Settings -> Pages -> Deploy from a branch -> `main` / root**.
3. Open `https://<user>.github.io/<repo>/`.

All paths are relative, so it works in a sub-folder. `.nojekyll` is included so GitHub serves every file as-is.

## Links page and Emu

`links.html` lists this EmulatorJS build and links back to the existing Emu retro game shelf at the project root.

## Phones and iPhone

On phones and small tablets the site switches to a touch layout that follows rotation: portrait puts the game on top
and the controls below, landscape gives the game the whole screen between the controls. The menu button (or the handle
at the top in landscape) opens saves, game choice, engine and on-screen controls. On iPhone, Share > Add to Home Screen
opens the site full screen. Browser mode in the home page options (or `?view=phone|desktop|auto`) forces a layout.

## Reference docs

`reference.html` (Reference docs on the home page and the Links page) shows the documents in `reference-docs/`: one page
per project file, an overview and an asset index, with a filter box. After adding or renaming documents run
`node tools/generate-reference-index.mjs` (the GitHub workflow does it on push).

## Engines

When the site opens you choose the emulation engine (asked once per browser session unless you tick "Remember"):

| | EmulatorJSMod | NostalgistMod |
| --- | --- | --- |
| Code | `engines/EmulatorJSMod.js` → `data/loader.js`, `data/src` | `engines/NostalgistMod.js` (Nostalgist.js, MIT) |
| Interface | EmulatorJS menu bar, settings, touch gamepad, cheats, netplay, F1 hotkey panel | Minimal canvas with a toolbar |
| Systems | Every installed core, threaded ones too (PSP, DOS) | Single-threaded cores only |
| Saves | IndexedDB (`/data/saves`, `EmulatorJS-states`) | IndexedDB (`NostalgistMod-saves`) |

Both use the same `.7z` cores in `data/cores`. Switch with **Change** on the home page or the **Engine** dropdown on the
game page. To rebuild NostalgistMod after editing `tools/nostalgist-mod/src`: `npm i -D esbuild ini` then
`node tools/nostalgist-mod/build.mjs`.

## Game library

Put ROMs or zips in the platform folders inside `data/`:

| Folder | Platform |
| --- | --- |
| `data/A2600` | Atari 2600 |
| `data/GB` | Game Boy |
| `data/GBC` | Game Boy Color |
| `data/GG` | Sega Game Gear |
| `data/NES` | Nintendo Entertainment System |
| `data/SNES` | Super Nintendo |
| `data/N64` | Nintendo 64 |

The home page lists them once the cores have loaded. GitHub Pages cannot list folders, so each folder has an
`index.json`: on GitHub the workflow in `.github/workflows/update-indexes.yml` rebuilds it after every push
(Settings → Actions → General must allow workflows to run). Locally, `start-windows.bat` / `serve.py` show new files
straight away; otherwise run `node tools/generate-rom-index.mjs`. Add more platforms in `data/platforms.json`.
Only add games you have the right to share: the site is public.

## Using it

- Click a game in the library, a recent game, or drop a ROM on the page (a BIOS and an IPS/BPS/UPS patch can be
  dropped with it). Games open on `play.html`, which has a **Home** link and **Platform** / **Game** dropdowns to
  switch games.
- The system is found from the folder, the extension, the file header, or the names inside a zip.
- Hover any option (or tap its **?**) for a short explanation. **What's changed from the original EmulatorJS** opens
  `ENHANCEMENTS.txt` with every change.
- In game, press **F1** for hotkeys and options: F2 save, F4 load, F3 slot, F5 pause, F6 fast forward,
  F8 screenshot, Shift+F2 save slots with pictures, F9 mute, Shift+F9 performance mode, F10 FPS, Shift+F10 performance stats, F11 fullscreen. On a controller, hold Select and press R1/L1/R2/L2/Start.
- **Options → Export backup** saves all in-game saves, save states and settings to one file.
- `play.html` on its own is the game library inside the player (either engine): every ROM and zip in the folders,
  one click to play. `play.html?folder=NES` shows one folder, `&autoplay=1` starts its first game.
- Performance (EmulatorJSMod, F1 panel): performance mode, render resolution, audio latency, run-ahead, low-latency
  canvas, a picture-sized render buffer (draws only the game picture, 26–65% fewer pixels), audio suspended while paused or in the background, a lean opaque game
  surface (no blending with the page, no unused depth/stencil buffers on 2D systems) and a low-battery
  power saver, saved per game. See the addenda in ENHANCEMENTS.txt.
- Links: `play.html?folder=NES&file=Game.nes`, `play.html?url=roms/game.nes&core=nes`; old `index.html?rom=`
  links still work.

## Threads

Threaded cores require `SharedArrayBuffer` and cross-origin isolation. Service-worker setup is disabled in this static combined project, so threaded cores are unavailable here unless the host supplies the required isolation headers.

## Cores

Core archives are used exactly as built: `<core>[-thread][-legacy]-wasm.7z`. The loader picks the best
variant that exists (threaded if enabled, WebGL2 or legacy WebGL1) and falls back to a variant that is present.
Run `node tools/generate-core-manifest.mjs` whenever cores are added, removed or updated; the file sizes in the
manifest are used as cache-busting versions.

## Optional: minified build

`npm install && npm run minify` writes `data/emulator.min.js` and `.css`. Set `window.EJS_useMinified = true`
before loading `data/loader.js` to use them.

## License

EmulatorJS is licensed under GPL-3.0 (see `LICENSE`). Keep that file and the license notices when you publish
a copy. Cores are built from other projects under their own licenses (each archive contains `license.txt`).
Only host ROMs and BIOS files you have the right to share.
