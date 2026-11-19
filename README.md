# Emu

Seven-system retro emulator shelf. It opens with an empty library; add games using the ROM, ZIP, or folder import buttons. Imported games are stored locally in that browser.

- Games appear as one simple alphabetical list, with console tabs available for filtering.
- Bundled game catalogs and ROM manifests are empty by default. To add codebase ROMs, place files under roms/<system>, update games.json and roms/manifest.json, and add any catalog entries to game-catalog.json.
- Emulator settings are available from the gear button; Super Eagle is the default video filter.
- Each game has a ZIP export action for its source ROM and recognizable embedded/archived resources. NES iNES CHR tiles are exported as a PNG atlas; many other game asset formats require title-specific decoders.
- Game Gear uses EmulatorJS's genesis_plus_gx core.
