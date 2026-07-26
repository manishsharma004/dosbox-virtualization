# NOTICE — third-party software & provenance

This project is an **emulator shell**. It ships no proprietary binaries in git;
the DOS applications below are **fetched at build time** by
`scripts/fetch-vendor.mjs` into the gitignored `vendor/` directory and packed
into `public/msdos.jsdos`.

The applications are included on a **freeware / rights-holder-blessed** basis —
**not** because their copyright has expired. Under U.S. law, corporate works are
protected for roughly **95 years from publication**, so these 1990–1991 titles
remain under copyright well into the 2080s.

## Turbo C++ 1.01 (Borland, 1991)

- **Basis:** Released by Borland — and later by Embarcadero Technologies, the
  current owner of Borland's developer tools — as **"Antique Software"** free
  downloads.
- **Default source:** `https://altd.embarcadero.com/download/museum/tcpp101.zip`
  (`tcpp101.zip`, the official Borland/Embarcadero museum archive). Overridable
  via the `TC_URL` environment variable.
- **Note:** We deliberately ship **1.01** (the freely redistributable antique
  release), **not** Turbo C++ 3.0, which was never released as freeware.
- Turbo C++ and Borland are trademarks of Embarcadero Technologies, Inc.

## Dangerous Dave (John Romero / Softdisk, 1990)

- **Title:** The **original** *Dangerous Dave in the Deserted Pirate's Hideout!*
  (`DAVE.EXE` + game data) — the same game and experience, not a remake.
- **Basis:** Originally published by Softdisk on a freely distributable
  "Gamer's Edge" sampler; John Romero has publicly blessed free distribution of
  the original game. Copyright history traces to Softdisk / John Romero.
- **Default source:** Internet Archive item `dangerous_dave_1990`
  (`https://archive.org/download/dangerous_dave_1990/dangerous_dave.zip`).
  Overridable via the `DAVE_URL` environment variable.

## Emulator

- **js-dos** (v8) and the underlying **DOSBox** WebAssembly emulator —
  GPL/MIT-licensed open source. See https://js-dos.com and
  https://github.com/caiiiycuk/js-dos.

---

If you are a rights holder and want a title removed or a source changed, please
open an issue.
