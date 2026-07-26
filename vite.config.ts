import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

// GitHub Pages project site is served from a sub-path. Use it for production
// builds only so the local dev server stays at the root.
const REPO_BASE = "/dosbox-virtualization/";

// js-dos ships as a UMD script plus a ~20MB `emulators/` folder of wasm files.
// Rather than committing those binaries, we serve them from the installed npm
// package under `/vendor/js-dos/` (in dev and in the production build).
export default defineConfig(({ command }) => ({
  base: command === "build" ? REPO_BASE : "/",
  plugins: [
    viteStaticCopy({
      targets: [
        { src: "node_modules/js-dos/dist/js-dos.js", dest: "vendor/js-dos" },
        { src: "node_modules/js-dos/dist/js-dos.css", dest: "vendor/js-dos" },
        { src: "node_modules/js-dos/dist/emulators", dest: "vendor/js-dos" },
      ],
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
}));
