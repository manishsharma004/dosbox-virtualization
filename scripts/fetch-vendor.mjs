// Downloads the freeware DOS applications and lays them out under vendor/ so
// build-bundle.mjs can pack them into public/msdos.jsdos.
//
// Nothing here is committed to git (vendor/ is gitignored). Both apps are
// fetched from stable archives; URLs are overridable via env vars:
//   TC_URL    - Turbo C++ 1.01 antique freeware zip (Borland/Embarcadero museum)
//   DAVE_URL  - Original Dangerous Dave freeware zip (Internet Archive)
//
// The vintage 1991 Turbo C++ archives use the ZIP "implode" method, so we shell
// out to the Info-ZIP `unzip` binary (handles store/deflate/implode) rather than
// a pure-JS unzipper. See NOTICE.md for the freeware/provenance basis.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VENDOR = path.join(ROOT, "vendor");

const TC_URL =
  process.env.TC_URL ??
  "https://altd.embarcadero.com/download/museum/tcpp101.zip";
const DAVE_URL =
  process.env.DAVE_URL ??
  "https://archive.org/download/dangerous_dave_1990/dangerous_dave.zip";

// Which inner Turbo C++ archive goes into which C:\TC subdirectory.
const TC_LAYOUT = {
  BIN: ["BIN1.ZIP", "BIN2.ZIP", "TC.ZIP", "TCC.ZIP", "HELP.ZIP"],
  INCLUDE: ["INCLUDE.ZIP", "CLASSINC.ZIP"],
  LIB: [
    "CLIB.ZIP",
    "SLIB.ZIP",
    "MLIB.ZIP",
    "LLIB.ZIP",
    "HLIB.ZIP",
    "XLIB.ZIP",
    "CLASSLIB.ZIP",
    "STARTUP.ZIP",
  ],
  BGI: ["BGI.ZIP"],
};

function requireUnzip() {
  try {
    execFileSync("unzip", ["-v"], { stdio: "ignore" });
  } catch {
    throw new Error(
      "`unzip` is required (the 1991 Turbo C++ archives use ZIP implode). " +
        "Install it: `sudo apt-get install unzip` (ubuntu) / `brew install unzip`.",
    );
  }
}

async function download(url, destFile) {
  const attempts = 4;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      fs.writeFileSync(destFile, Buffer.from(await res.arrayBuffer()));
      return;
    } catch (err) {
      if (i === attempts) throw err;
      const wait = 2 ** i * 1000;
      console.warn(`  fetch failed (${err.message}); retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

// Extract, junking any stored paths (-j) so files land flat in destDir.
function unzipFlat(archive, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  execFileSync("unzip", ["-o", "-j", "-qq", archive, "-d", destDir]);
}

// Extract preserving names into destDir (used for the outer archive).
function unzipInto(archive, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  execFileSync("unzip", ["-o", "-qq", archive, "-d", destDir]);
}

// Borland split a too-large .ZIP across floppies as NAME.CA1 / NAME.CA2 / ...
// Each volume is prefixed with a 4-byte header; strip it and concatenate.
function reassembleSplitZips(dir) {
  const groups = new Map();
  for (const f of fs.readdirSync(dir)) {
    const m = /^(.*)\.CA(\d+)$/i.exec(f);
    if (!m) continue;
    if (!groups.has(m[1])) groups.set(m[1], []);
    groups.get(m[1]).push({ file: f, part: Number(m[2]) });
  }
  for (const [base, parts] of groups) {
    parts.sort((a, b) => a.part - b.part);
    const chunks = parts.map((p) =>
      fs.readFileSync(path.join(dir, p.file)).subarray(4),
    );
    fs.writeFileSync(path.join(dir, `${base}.ZIP`), Buffer.concat(chunks));
  }
}

async function installTurboCpp(scratchBase) {
  console.log(`Turbo C++ 1.01  <-  ${TC_URL}`);
  const scratch = fs.mkdirSync(path.join(scratchBase, "tc"), {
    recursive: true,
  });
  const outer = path.join(scratchBase, "tcpp101.zip");
  await download(TC_URL, outer);
  unzipInto(outer, scratch);
  reassembleSplitZips(scratch);

  const tcRoot = path.join(VENDOR, "TC");
  fs.rmSync(tcRoot, { recursive: true, force: true });

  for (const [subdir, archives] of Object.entries(TC_LAYOUT)) {
    const dest = path.join(tcRoot, subdir);
    for (const archive of archives) {
      const archivePath = path.join(scratch, archive);
      if (!fs.existsSync(archivePath)) {
        throw new Error(`Expected ${archive} inside Turbo C++ archive`);
      }
      unzipFlat(archivePath, dest);
    }
  }

  const tcExe = path.join(tcRoot, "BIN", "TC.EXE");
  if (!fs.existsSync(tcExe)) {
    throw new Error("Turbo C++ install failed: TC.EXE missing");
  }
  // The museum freeware binary ships with Options/Directories baked in as
  // C:\TCLITE\..., but we lay the tree out under C:\TC (matching TURBOC.CFG,
  // PATH, and TC.BAT). Patch the null-padded string buffers in place.
  patchTcIdeDirectories(tcExe);
  console.log(`  installed -> ${path.relative(ROOT, tcExe)}`);
}

// Replace fixed-buffer path defaults inside TC.EXE (null-terminated, padded).
function patchTcIdeDirectories(tcExe) {
  const replacements = [
    ["C:\\TCLITE\\INCLUDE", "C:\\TC\\INCLUDE"],
    ["C:\\TCLITE\\LIB", "C:\\TC\\LIB"],
  ];
  let buf = fs.readFileSync(tcExe);
  for (const [from, to] of replacements) {
    if (to.length > from.length) {
      throw new Error(`Cannot patch ${from} -> ${to}: replacement longer`);
    }
    const fromBuf = Buffer.from(from, "ascii");
    const toBuf = Buffer.from(to, "ascii");
    let idx = 0;
    let hits = 0;
    while ((idx = buf.indexOf(fromBuf, idx)) !== -1) {
      toBuf.copy(buf, idx);
      buf.fill(0, idx + toBuf.length, idx + fromBuf.length);
      hits++;
      idx += fromBuf.length;
    }
    if (hits === 0) {
      throw new Error(
        `Turbo C++ directory patch failed: ${from} not found in TC.EXE`,
      );
    }
  }
  fs.writeFileSync(tcExe, buf);
  console.log("  patched IDE defaults: C:\\TC\\INCLUDE, C:\\TC\\LIB");
}

async function installDave(scratchBase) {
  console.log(`Dangerous Dave  <-  ${DAVE_URL}`);
  const daveZip = path.join(scratchBase, "dave.zip");
  await download(DAVE_URL, daveZip);

  const daveRoot = path.join(VENDOR, "DAVE");
  fs.rmSync(daveRoot, { recursive: true, force: true });
  unzipFlat(daveZip, daveRoot);

  const daveExe = path.join(daveRoot, "DAVE.EXE");
  if (!fs.existsSync(daveExe)) {
    throw new Error("Dangerous Dave install failed: DAVE.EXE missing");
  }
  console.log(`  installed -> ${path.relative(ROOT, daveExe)}`);
}

async function main() {
  requireUnzip();
  fs.mkdirSync(VENDOR, { recursive: true });
  const scratchBase = fs.mkdtempSync(path.join(os.tmpdir(), "dosvendor-"));
  try {
    await installTurboCpp(scratchBase);
    await installDave(scratchBase);
  } finally {
    fs.rmSync(scratchBase, { recursive: true, force: true });
  }
  console.log("\nVendor apps ready. Run `npm run bundle` to pack msdos.jsdos.");
}

main().catch((err) => {
  console.error(`\nfetch-vendor failed: ${err.message}`);
  process.exitCode = 1;
});
