// Packs the DOS config + vendored apps into public/msdos.jsdos (a js-dos
// bundle == a ZIP whose root becomes the C: drive).
//
// Usage:
//   node scripts/build-bundle.mjs            # always rebuild
//   node scripts/build-bundle.mjs --if-needed # skip if bundle already exists

import yazl from "yazl";
import fs from "node:fs";
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

function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push({ full, rel: path.relative(base, full) });
  }
  return out;
}

function main() {
  if (IF_NEEDED && fs.existsSync(OUT)) {
    console.log(`msdos.jsdos already present -> ${path.relative(ROOT, OUT)}`);
    return;
  }

  const tcRoot = path.join(VENDOR, "TC");
  const daveRoot = path.join(VENDOR, "DAVE");
  if (!fs.existsSync(path.join(tcRoot, "BIN", "TC.EXE"))) {
    fail("vendor/TC/BIN/TC.EXE not found");
  }
  if (!fs.existsSync(path.join(daveRoot, "DAVE.EXE"))) {
    fail("vendor/DAVE/DAVE.EXE not found");
  }

  const zip = new yazl.ZipFile();

  // 1) js-dos config (mounts the bundle root as C: and shows the menu).
  zip.addFile(path.join(ASSETS, "dosbox.conf"), ".jsdos/dosbox.conf");

  // 2) Menu + launcher batch files at C:\.
  for (const bat of ["MENU.BAT", "TC.BAT", "DAVE.BAT"]) {
    zip.addFile(path.join(ASSETS, bat), bat);
  }

  // 3) Turbo C++ 1.01 -> C:\TC   and original Dangerous Dave -> C:\DAVE
  let count = 0;
  for (const { full, rel } of walk(tcRoot)) {
    zip.addFile(full, `TC/${rel.split(path.sep).join("/")}`);
    count++;
  }
  for (const { full, rel } of walk(daveRoot)) {
    zip.addFile(full, `DAVE/${rel.split(path.sep).join("/")}`);
    count++;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const stream = fs.createWriteStream(OUT);
  zip.outputStream.pipe(stream).on("close", () => {
    const size = (fs.statSync(OUT).size / (1024 * 1024)).toFixed(1);
    console.log(
      `Packed ${count + 4} files -> ${path.relative(ROOT, OUT)} (${size} MB)`,
    );
  });
  zip.end();
}

main();
