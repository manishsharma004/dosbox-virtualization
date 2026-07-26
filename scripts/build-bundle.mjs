// Packs the DOS config + vendored apps into public/msdos.jsdos (a js-dos
// bundle == a ZIP whose root becomes the C: drive).
//
// We build a staging tree and zip it with Info-ZIP `zip`, which writes standard
// local headers + directory entries. (A pure-JS streaming zipper like yazl emits
// data descriptors with zero-size local headers, which js-dos's in-wasm
// extractor mis-parses -> "TC/BGI: No such file or directory".)
//
// Usage:
//   node scripts/build-bundle.mjs             # always rebuild
//   node scripts/build-bundle.mjs --if-needed # skip if bundle already exists

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VENDOR = path.join(ROOT, "vendor");
const ASSETS = path.join(__dirname, "bundle-assets");
const OUT = path.join(ROOT, "public", "msdos.jsdos");

const IF_NEEDED = process.argv.includes("--if-needed");

function fail(msg) {
  console.error(`\nbuild-bundle failed: ${msg}`);
  console.error("Run `npm run vendor` first to fetch the DOS applications.");
  process.exit(1);
}

function requireZip() {
  try {
    execFileSync("zip", ["-v"], { stdio: "ignore" });
  } catch {
    fail("`zip` (Info-ZIP) is required. Install it: `sudo apt-get install zip`.");
  }
}

function main() {
  if (IF_NEEDED && fs.existsSync(OUT)) {
    console.log(`msdos.jsdos already present -> ${path.relative(ROOT, OUT)}`);
    return;
  }
  requireZip();

  const tcRoot = path.join(VENDOR, "TC");
  const daveRoot = path.join(VENDOR, "DAVE");
  if (!fs.existsSync(path.join(tcRoot, "BIN", "TC.EXE"))) {
    fail("vendor/TC/BIN/TC.EXE not found");
  }
  if (!fs.existsSync(path.join(daveRoot, "DAVE.EXE"))) {
    fail("vendor/DAVE/DAVE.EXE not found");
  }

  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "dosbundle-"));
  try {
    // C: drive layout inside the bundle root.
    fs.mkdirSync(path.join(stage, ".jsdos"), { recursive: true });
    fs.copyFileSync(
      path.join(ASSETS, "dosbox.conf"),
      path.join(stage, ".jsdos", "dosbox.conf"),
    );
    const rootFiles = [
      "MENU.BAT",
      "TC.BAT",
      "DAVE.BAT",
      "HELLO.BAT",
      "HELLO.C",
      "TURBOC.CFG",
    ];
    for (const f of rootFiles) {
      fs.copyFileSync(path.join(ASSETS, f), path.join(stage, f));
    }
    fs.cpSync(tcRoot, path.join(stage, "TC"), { recursive: true });
    fs.cpSync(daveRoot, path.join(stage, "DAVE"), { recursive: true });

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.rmSync(OUT, { force: true });

    // -r recursive, -q quiet, -X drop extra attrs. Run from the stage so paths
    // are relative to the bundle root.
    execFileSync("zip", ["-r", "-q", "-X", OUT, "."], { cwd: stage });

    const countFiles = (dir) =>
      fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => {
        const full = path.join(dir, e.name);
        return n + (e.isDirectory() ? countFiles(full) : 1);
      }, 0);
    const fileCount = countFiles(stage);
    const size = (fs.statSync(OUT).size / (1024 * 1024)).toFixed(1);
    console.log(
      `Packed ${fileCount} files -> ${path.relative(ROOT, OUT)} (${size} MB)`,
    );
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

main();
