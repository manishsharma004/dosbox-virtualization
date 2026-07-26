# MS-DOS in the Browser

Full **MS-DOS virtualization in the browser** — a real filesystem, desktop and
mobile support, and pre-installed freeware apps — powered by
[js-dos](https://js-dos.com) (DOSBox compiled to WebAssembly) and deployed to
**GitHub Pages**.

Boots straight into a DOS prompt with two apps ready to run:

| Menu          | Command | What it is                                                   |
| ------------- | ------- | ------------------------------------------------------------ |
| Turbo C++     | `TC`    | Borland **Turbo C++ 1.01** IDE (freeware antique release)    |
| Dangerous Dave| `DAVE`  | The **original** *Dangerous Dave* (John Romero / Softdisk)   |
| DOS prompt    | —       | A normal `C:\>` prompt; type `MENU` to redisplay the menu    |

> The app is an emulator shell. DOS binaries are **not** committed to git; they
> are fetched at build time (see [`NOTICE.md`](NOTICE.md) for the freeware basis).

## Requirements

- **Node.js 24** (see [`.nvmrc`](.nvmrc); `nvm use` to select it)
- **`unzip`** on `PATH` — the 1991 Turbo C++ archives use the ZIP *implode*
  method, which the fetch script extracts via Info-ZIP `unzip`.

## Local development

```bash
nvm use                 # Node 24
npm install
npm run prepare:dos     # fetch Turbo C++ 1.01 + Dangerous Dave, pack msdos.jsdos
npm run dev             # http://localhost:5173
```

`npm run dev` / `npm run build` also auto-build the bundle if it is missing
(`build-bundle --if-needed`), but the first run needs `npm run vendor` to
download the apps into `vendor/`.

### Scripts

| Script                | Purpose                                                        |
| --------------------- | ------------------------------------------------------------- |
| `npm run vendor`      | Download DOS apps into `vendor/` (override with `TC_URL`/`DAVE_URL`) |
| `npm run bundle`      | Pack `vendor/` + config into `public/msdos.jsdos`             |
| `npm run prepare:dos` | `vendor` + `bundle`                                           |
| `npm run dev`         | Vite dev server                                              |
| `npm run build`       | Type-check + production build to `dist/`                      |
| `npm run lint`        | ESLint + `tsc --noEmit`                                       |

## How it works

- **`src/dos/player.ts`** loads the self-hosted js-dos runtime and boots the
  `msdos.jsdos` bundle. Emulator wasm is served from `/vendor/js-dos/` (copied
  from the npm package by `vite-plugin-static-copy`), so there is no CDN
  dependency at runtime.
- **`scripts/bundle-assets/dosbox.conf`** mounts the bundle root as `C:` and its
  `[autoexec]` shows the menu (`MENU.BAT`). `TC.BAT` / `DAVE.BAT` launch the apps.
- **`src/ui/modifier-bar.ts`** renders on-screen **Ctrl / Alt / Shift** (sticky)
  plus Tab/Esc/Enter/arrows/function keys for mobile, and the layout tracks
  `visualViewport` so the keys stay visible when the device keyboard opens.

## Deploying to GitHub Pages

Pushing to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
on Node 24: it fetches the apps, builds the bundle, runs `vite build`, and
publishes `dist/`. Enable **Settings → Pages → Source: GitHub Actions** once.

The production base path is `/dosbox-virtualization/` (Vite `base`); adjust it in
[`vite.config.ts`](vite.config.ts) if your repository name differs.
