import type { CommandInterface } from "../dos/jsdos";
import { KBD, type KbdKey, charToKeyCode } from "../dos/keyCodes";
import {
  createDeviceKeyboard,
  type DeviceKeyboard,
} from "./device-keyboard";

type GetCi = () => CommandInterface | null;

export type KeyboardMode = "controls" | "onscreen" | "device";

interface KeyDef {
  key: KbdKey;
  label: string;
  cls?: string;
}

const MODIFIERS: KeyDef[] = [
  { key: "leftctrl", label: "Ctrl" },
  { key: "leftalt", label: "Alt" },
  { key: "leftshift", label: "Shift" },
];

const EDIT: KeyDef[] = [
  { key: "tab", label: "Tab" },
  { key: "esc", label: "Esc" },
  { key: "enter", label: "Enter" },
];

const ARROWS: KeyDef[] = [
  { key: "up", label: "\u25B2" },
  { key: "left", label: "\u25C0" },
  { key: "down", label: "\u25BC" },
  { key: "right", label: "\u25B6" },
];

const FKEYS: KbdKey[] = [
  "f1",
  "f2",
  "f3",
  "f4",
  "f5",
  "f6",
  "f7",
  "f8",
  "f9",
  "f10",
];

// Compact QWERTY for the on-screen typing layer (mobile-friendly).
const ALPHA_ROWS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const SYMBOL_ROWS: string[][] = [
  ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
  ["-", "_", "=", "+", "[", "]", "{", "}", "\\", "|"],
  [";", ":", "'", '"', ",", ".", "<", ">", "/", "?"],
  ["`", "~", "@", "#", "$", "%", "^", "&"],
];

export interface ModifierBar {
  element: HTMLElement;
  setVisible(visible: boolean): void;
  getMode(): KeyboardMode;
  setMode(mode: KeyboardMode): void;
  isDeviceKeyboardOpen(): boolean;
  openDeviceKeyboard(): void;
  closeDeviceKeyboard(): void;
  onDeviceKeyboardChange(cb: (open: boolean) => void): () => void;
  onModeChange(cb: (mode: KeyboardMode) => void): () => void;
}

export function createModifierBar(getCi: GetCi): ModifierBar {
  const root = document.createElement("div");
  root.className = "vkeys";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "DOS control pad");

  const deviceKb: DeviceKeyboard = createDeviceKeyboard(getCi);
  const modeListeners = new Set<(mode: KeyboardMode) => void>();

  const latched = new Set<KbdKey>();
  const latchedButtons = new Map<KbdKey, HTMLButtonElement>();
  let fnVisible = false;
  let symbols = false;
  let mode: KeyboardMode = "controls";

  const releaseLatched = () => {
    const ci = getCi();
    if (latched.size === 0) return;
    for (const k of latched) {
      ci?.sendKeyEvent(KBD[k], false);
      latchedButtons.get(k)?.classList.remove("vkey--active");
      latchedButtons.get(k)?.setAttribute("aria-pressed", "false");
    }
    latched.clear();
  };

  const shiftLatched = () => latched.has("leftshift");

  const keepDeviceFocus = () => {
    if (mode === "device" && deviceKb.isOpen()) deviceKb.open();
  };

  const makeButton = (
    label: string,
    extraCls: string,
    aria?: string,
  ): HTMLButtonElement => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `vkey ${extraCls}`.trim();
    btn.textContent = label;
    btn.setAttribute("aria-label", aria ?? label);
    return btn;
  };

  const addModifier = (def: KeyDef) => {
    const btn = makeButton(def.label, "vkey--mod");
    btn.setAttribute("aria-pressed", "false");
    latchedButtons.set(def.key, btn);
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      keepDeviceFocus();
      const ci = getCi();
      if (!ci) return;
      if (latched.has(def.key)) {
        latched.delete(def.key);
        ci.sendKeyEvent(KBD[def.key], false);
        btn.classList.remove("vkey--active");
        btn.setAttribute("aria-pressed", "false");
      } else {
        latched.add(def.key);
        ci.sendKeyEvent(KBD[def.key], true);
        btn.classList.add("vkey--active");
        btn.setAttribute("aria-pressed", "true");
      }
      // Refresh letter case labels when Shift latches.
      if (def.key === "leftshift") renderAlpha();
    });
    return btn;
  };

  const addMomentary = (def: KeyDef, extraCls: string) => {
    const btn = makeButton(def.label, `${extraCls} ${def.cls ?? ""}`.trim());
    const code = KBD[def.key];
    let held = false;
    let repeatTimer: number | null = null;

    const stopRepeat = () => {
      if (repeatTimer !== null) {
        window.clearInterval(repeatTimer);
        repeatTimer = null;
      }
    };

    const press = (e: Event) => {
      e.preventDefault();
      if (held) return;
      held = true;
      keepDeviceFocus();
      getCi()?.sendKeyEvent(code, true);
      stopRepeat();
      repeatTimer = window.setInterval(() => getCi()?.sendKeyEvent(code, true), 60);
      btn.classList.add("vkey--down");
      const pid = (e as PointerEvent).pointerId;
      if (pid !== undefined) {
        try {
          btn.setPointerCapture(pid);
        } catch {
          /* ignore */
        }
      }
    };

    const release = (e?: Event) => {
      e?.preventDefault();
      if (!held) return;
      held = false;
      stopRepeat();
      getCi()?.sendKeyEvent(code, false);
      btn.classList.remove("vkey--down");
      releaseLatched();
      if (def.key !== "leftshift") renderAlpha();
      keepDeviceFocus();
    };

    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("lostpointercapture", release);
    btn.addEventListener("mousedown", press);
    btn.addEventListener("mouseup", release);
    btn.addEventListener("mouseleave", release);
    btn.addEventListener("touchstart", press, { passive: false });
    btn.addEventListener("touchend", release);
    btn.addEventListener("touchcancel", release);
    window.addEventListener("blur", () => release());
    return btn;
  };

  const tapChar = (ch: string) => {
    const ci = getCi();
    if (!ci) return;
    const code = charToKeyCode(ch);
    if (code === null) return;

    // Letters use uppercase scancodes; hold Shift for capitals when it is not
    // already latched via the sticky Shift key.
    const wantsUpper = ch >= "A" && ch <= "Z";
    const addShift = wantsUpper && !shiftLatched();
    if (addShift) ci.sendKeyEvent(KBD.leftshift, true);
    ci.sendKeyEvent(code, true);
    ci.sendKeyEvent(code, false);
    if (addShift) ci.sendKeyEvent(KBD.leftshift, false);

    // One-shot sticky Shift: release after a letter (phone-keyboard feel).
    if (shiftLatched() && /[a-z]/i.test(ch)) {
      latched.delete("leftshift");
      ci.sendKeyEvent(KBD.leftshift, false);
      latchedButtons.get("leftshift")?.classList.remove("vkey--active");
      latchedButtons.get("leftshift")?.setAttribute("aria-pressed", "false");
      renderAlpha();
    }
  };

  // --- Mode switch --------------------------------------------------------
  const toolbar = document.createElement("div");
  toolbar.className = "vkeys__toolbar";

  const modeGroup = document.createElement("div");
  modeGroup.className = "vkeys__modes";
  modeGroup.setAttribute("role", "radiogroup");
  modeGroup.setAttribute("aria-label", "Keyboard mode");

  const mkModeBtn = (id: KeyboardMode, label: string) => {
    const btn = makeButton(label, "vkey vkey--mode");
    btn.dataset.mode = id;
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", "false");
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      setMode(id);
    });
    return btn;
  };

  const btnModeControls = mkModeBtn("controls", "Controls");
  const btnModeOnscreen = mkModeBtn("onscreen", "On-screen KB");
  const btnModeDevice = mkModeBtn("device", "Device KB");
  modeGroup.append(btnModeControls, btnModeOnscreen, btnModeDevice);

  const btnFn = makeButton("Fn", "vkey vkey--tool");
  btnFn.setAttribute("aria-pressed", "false");
  btnFn.title = "Show function keys (F1–F10)";

  toolbar.append(modeGroup, btnFn);

  // --- Shared modifiers + edit + dpad -------------------------------------
  const rowMain = document.createElement("div");
  rowMain.className = "vkeys__row vkeys__row--main";

  const keyBlock = document.createElement("div");
  keyBlock.className = "vkeys__keys";

  const rowMods = document.createElement("div");
  rowMods.className = "vkeys__row vkeys__row--mods";
  MODIFIERS.forEach((d) => rowMods.appendChild(addModifier(d)));
  EDIT.forEach((d) => rowMods.appendChild(addMomentary(d, "")));
  rowMods.appendChild(
    addMomentary({ key: "backspace", label: "Bksp" }, "vkey--bksp"),
  );

  keyBlock.append(rowMods);

  const dpad = document.createElement("div");
  dpad.className = "vkeys__dpad";
  dpad.setAttribute("aria-label", "Arrow keys");
  const arrowBtns: Record<string, HTMLButtonElement> = {};
  for (const d of ARROWS) {
    arrowBtns[d.key] = addMomentary(d, `vkey--arrow vkey--arrow-${d.key}`);
  }
  dpad.append(arrowBtns.up, arrowBtns.left, arrowBtns.down, arrowBtns.right);
  rowMain.append(keyBlock, dpad);

  // --- On-screen QWERTY ---------------------------------------------------
  const alpha = document.createElement("div");
  alpha.className = "vkeys__alpha";
  alpha.hidden = true;

  const renderAlpha = () => {
    alpha.replaceChildren();
    const rows = symbols ? SYMBOL_ROWS : ALPHA_ROWS;
    const shifted = shiftLatched();

    for (const row of rows) {
      const rowEl = document.createElement("div");
      rowEl.className = "vkeys__alpha-row";
      for (const ch of row) {
        const label = !symbols && shifted ? ch.toUpperCase() : ch;
        const btn = makeButton(label, "vkey vkey--char", label);
        btn.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          tapChar(symbols ? ch : shifted ? ch.toUpperCase() : ch);
        });
        rowEl.appendChild(btn);
      }
      alpha.appendChild(rowEl);
    }

    const bottom = document.createElement("div");
    bottom.className = "vkeys__alpha-row vkeys__alpha-row--bottom";

    const btnSym = makeButton(symbols ? "ABC" : "?123", "vkey vkey--tool");
    btnSym.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      symbols = !symbols;
      renderAlpha();
    });

    const btnSpace = makeButton("Space", "vkey vkey--space");
    btnSpace.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      getCi()?.sendKeyEvent(KBD.space, true);
      getCi()?.sendKeyEvent(KBD.space, false);
    });

    const btnEnter = makeButton("Enter", "vkey vkey--enter");
    btnEnter.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      getCi()?.sendKeyEvent(KBD.enter, true);
      getCi()?.sendKeyEvent(KBD.enter, false);
      releaseLatched();
      renderAlpha();
    });

    bottom.append(btnSym, btnSpace, btnEnter);
    alpha.appendChild(bottom);
  };
  renderAlpha();

  // --- Function keys ------------------------------------------------------
  const fnWrap = document.createElement("div");
  fnWrap.className = "vkeys__fkeys";
  fnWrap.hidden = true;
  fnWrap.setAttribute("aria-label", "Function keys");
  FKEYS.forEach((key) =>
    fnWrap.appendChild(
      addMomentary({ key, label: key.toUpperCase() }, "vkey--fn"),
    ),
  );

  root.append(deviceKb.element, toolbar, rowMain, alpha, fnWrap);

  const setFnVisible = (visible: boolean) => {
    fnVisible = visible;
    fnWrap.hidden = !visible;
    btnFn.classList.toggle("vkey--active", visible);
    btnFn.setAttribute("aria-pressed", String(visible));
  };

  const syncModeButtons = () => {
    for (const btn of [btnModeControls, btnModeOnscreen, btnModeDevice]) {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle("vkey--active", active);
      btn.setAttribute("aria-checked", String(active));
    }
    root.dataset.mode = mode;
    alpha.hidden = mode !== "onscreen";
    deviceKb.element.classList.toggle("device-kb--visible", mode === "device");
    root.classList.toggle("vkeys--device-open", mode === "device" && deviceKb.isOpen());
  };

  const setMode = (next: KeyboardMode) => {
    if (mode === next) {
      // Tapping Device again re-focuses the OSK if it was dismissed.
      if (next === "device") {
        deviceKb.element.classList.add("device-kb--visible");
        deviceKb.open();
      }
      return;
    }
    const prev = mode;
    mode = next;

    if (prev === "device") deviceKb.close();

    // Show/hide the typing strip BEFORE focusing so mobile browsers allow the OSK.
    if (next === "onscreen") {
      symbols = false;
      renderAlpha();
    }
    syncModeButtons();

    if (next === "device") {
      deviceKb.open();
    }

    for (const cb of modeListeners) cb(mode);
  };

  deviceKb.onChange((open) => {
    root.classList.toggle("vkeys--device-open", mode === "device" && open);
    // If the OSK was dismissed externally while in device mode, keep the mode
    // selected but reflect inactive strip styling via the open class above.
    void open;
  });

  btnFn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    setFnVisible(!fnVisible);
    keepDeviceFocus();
  });

  // Default: controls-only (games pad). Device strip stays collapsed until chosen.
  deviceKb.element.classList.remove("device-kb--visible");
  syncModeButtons();

  return {
    element: root,
    setVisible(visible: boolean) {
      root.style.display = visible ? "" : "none";
      if (!visible && deviceKb.isOpen()) deviceKb.close();
    },
    getMode: () => mode,
    setMode,
    isDeviceKeyboardOpen: () => deviceKb.isOpen(),
    openDeviceKeyboard: () => setMode("device"),
    closeDeviceKeyboard: () => {
      if (mode === "device") setMode("controls");
      else deviceKb.close();
    },
    onDeviceKeyboardChange: (cb) => deviceKb.onChange(cb),
    onModeChange: (cb) => {
      modeListeners.add(cb);
      return () => modeListeners.delete(cb);
    },
  };
}
