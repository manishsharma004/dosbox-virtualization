# AGENTS.md

Project: **MS-DOS in the Browser** — a static Vite + TypeScript SPA that runs
DOSBox in the browser via [js-dos] with pre-installed freeware **Turbo C++ 1.01**
and the original **Dangerous Dave**, deployed to GitHub Pages.

Standard commands, scripts, and the local setup flow are documented in
[`README.md`](README.md). The section below is only the non-obvious context.

## Cursor Cloud specific instructions

### Environment / running
- Node: the repo targets **Node 24** (`.nvmrc`, `engines`, CI). The VM's default
  `node` may be v22; run `nvm use` to match 24. The app also runs on 22, but use
  24 for parity with CI.
- The startup update script only runs `npm install`. The DOS apps are **not**
  committed — `vendor/` and `public/msdos.jsdos` are gitignored build artifacts.
  `npm run dev` (and `npm run build`) auto-fetch the apps and build the bundle on
  first run via the `predev`/`prebuild` hook (`scripts/prepare-dos.mjs`), so the
  first `npm run dev` after a fresh clone/pod "just works" (needs network for the
  one-time download). To force a rebuild: `npm run prepare:dos`.
- System tools **`unzip` and `zip` (Info-ZIP)** must be on `PATH`; the vendor
  fetch/bundle build shells out to them (the 1991 Turbo C++ archives use ZIP
  *implode*, which pure-JS unzippers can't decode).
- Dev server: `npm run dev` (Vite, port 5173). It is a long-running process —
  start it in tmux, don't block on it.

### Non-obvious gotchas (important)
- **js-dos backend must be `dosboxX`** (see `src/dos/player.ts`). The classic
  `wdosbox` build traps with "memory access out of bounds" when running the Turbo
  C++ IDE.
- **The bundle must be built with Info-ZIP `zip`** (standard local headers), not
  a streaming JS zipper. yazl-style *data descriptors* (zero-size local headers)
  make js-dos's in-wasm extractor fail with `TC/BGI: No such file or directory`.
  See `scripts/build-bundle.mjs`.
- **js-dos persists the C: drive to OPFS**, keyed by the bundle URL. After you
  change `public/msdos.jsdos`, a stale OPFS copy can cause boot/extraction errors
  or old behavior. If the emulator misbehaves after a bundle change, clear site
  data (DevTools → Application → Clear site data, i.e. OPFS + IndexedDB) and hard
  reload. A first-load boot also fails silently if the browser holds a broken
  cached extraction — clearing storage fixes it.
- **On-screen keys drive games via `ci.sendKeyEvent` with typematic auto-repeat
  plus mouse/touch/pointer handlers** (`src/ui/modifier-bar.ts`). A single
  key-down is not enough for action games (e.g. Dave) — the key must be re-sent
  while held, exactly like a physical key's auto-repeat.
- The DOS canvas is sized by js-dos itself (keeps 4:3 and scales to fill). Do not
  force `width/height`/`object-fit` on the `<canvas>`; just let the wrapper fill
  the area (`src/ui/shell.css`).
- Turbo C++ IDE defaults expect `C:\TC\INCLUDE` and `C:\TC\LIB` (the bundle
  layout). A `C:\TURBOC.CFG` lets the command-line `TCC` find them; `HELLO.BAT`
  compiles/runs the sample `C:\HELLO.C`.

### Testing
- Testing is manual/GUI via the browser (js-dos runs DOSBox in a Web Worker).
  When a change touches the bundle, clear OPFS/site-data before verifying.
- The DOSBox stderr (e.g. extraction errors) is logged from the **worker**, so a
  main-thread `console.error` override won't capture it. Force render-thread mode
  with `localStorage.setItem("worker","false")` to debug extraction on the main
  thread.

[js-dos]: https://js-dos.com
