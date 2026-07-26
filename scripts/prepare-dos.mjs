// Ensures the DOS bundle (public/msdos.jsdos) exists before `vite dev`/`build`.
// Runs automatically via the predev/prebuild npm hooks. It fetches the freeware
// DOS apps only if they are missing, then builds the bundle if missing — so the
// startup update script can stay minimal (`npm install`) and the first
// `npm run dev` "just works".

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BUNDLE = path.join(ROOT, "public", "msdos.jsdos");
const TC_EXE = path.join(ROOT, "vendor", "TC", "BIN", "TC.EXE");
const DAVE_EXE = path.join(ROOT, "vendor", "DAVE", "DAVE.EXE");

function run(script) {
  const res = spawnSync(process.execPath, [path.join(__dirname, script)], {
    stdio: "inherit",
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

if (fs.existsSync(BUNDLE)) {
  console.log("msdos.jsdos present — skipping DOS prepare.");
  process.exit(0);
}

if (!fs.existsSync(TC_EXE) || !fs.existsSync(DAVE_EXE)) {
  console.log("Fetching freeware DOS apps (Turbo C++ 1.01 + Dangerous Dave)...");
  run("fetch-vendor.mjs");
}

console.log("Building msdos.jsdos bundle...");
run("build-bundle.mjs");
