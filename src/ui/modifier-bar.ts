import type { CommandInterface } from "../dos/jsdos";
import { KBD, type KbdKey } from "../dos/keyCodes";
import {
  createDeviceKeyboard,
  type DeviceKeyboard,
} from "./device-keyboard";

type GetCi = () => CommandInterface | null;

interface KeyDef {
  key: KbdKey;
  label: string;
  cls?: string;
}

// Sticky modifiers: tap to latch (stays held so it combines with the device
// keyboard), tap again to release.
const MODIFIERS: KeyDef[] = [
  { key: "leftctrl", label: "Ctrl" },
  { key: "leftalt", label: "Alt" },
  { key: "leftshift", label: "Shift" },
];

const EDIT: KeyDef[] = [
  { key: "tab", label: "Tab" },
  { key: "esc", label: "Esc" },
  { key: "backspace", label: "Bksp" },
  { key: "enter", label: "Enter" },
];

const ARROWS: KeyDef[] = [
  { key: "left", label: "\u25C0" },
  { key: "up", label: "\u25B2" },
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

export interface ModifierBar {
  element: HTMLElement;
  /** Show or hide the whole control pad. */
  setVisible(visible: boolean): void;
  /** Whether the OS soft keyboard bridge is focused. */
  isDeviceKeyboardOpen(): boolean;
  openDeviceKeyboard(): void;
  closeDeviceKeyboard(): void;
  /** Subscribe to device-keyboard open/close. Returns an unsubscribe. */
  onDeviceKeyboardChange(cb: (open: boolean) => void): () => void;
}

export function createModifierBar(getCi: GetCi): ModifierBar {
  const root = document.createElement("div");
  root.className = "vkeys";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "DOS control pad");

  const deviceKb: DeviceKeyboard = createDeviceKeyboard(getCi);

  const latched = new Set<KbdKey>();
  const latchedButtons = new Map<KbdKey, HTMLButtonElement>();
  let fnVisible = false;

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

  const makeButton = (def: KeyDef, extraCls: string): HTMLButtonElement => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `vkey ${extraCls} ${def.cls ?? ""}`.trim();
    btn.textContent = def.label;
    btn.setAttribute("aria-label", def.label);
    return btn;
  };

  const addModifier = (def: KeyDef) => {
    const btn = makeButton(def, "vkey--mod");
    btn.setAttribute("aria-pressed", "false");
    latchedButtons.set(def.key, btn);
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      // Keep the soft keyboard up while toggling modifiers.
      if (deviceKb.isOpen()) deviceKb.open();
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
    });
    return btn;
  };

  const addMomentary = (def: KeyDef, extraCls: string) => {
    const btn = makeButton(def, extraCls);
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
      if (deviceKb.isOpen()) deviceKb.open();
      // Send the key BEFORE anything that could throw (e.g. setPointerCapture
      // with a synthetic pointerId), so the key-down always reaches the game.
      getCi()?.sendKeyEvent(code, true);
      // Games (e.g. Dave) read a *held* key via typematic repeat: a physical
      // held key fires keydown repeatedly. Re-send "down" on an interval so the
      // character keeps moving while the button is held.
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
      // A combo like Ctrl+F9 clears the latched modifier afterwards.
      releaseLatched();
      if (deviceKb.isOpen()) deviceKb.open();
    };

    // Listen for pointer, mouse AND touch events (deduped by the `held` guard)
    // so a press-and-hold works across mouse, touch and pen inputs.
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
    // Safety net: never let a key stay stuck down.
    window.addEventListener("blur", () => release());
    return btn;
  };

  // --- Toolbar: device keyboard switch + Fn layer -------------------------
  const toolbar = document.createElement("div");
  toolbar.className = "vkeys__toolbar";

  const btnDevice = document.createElement("button");
  btnDevice.type = "button";
  btnDevice.className = "vkey vkey--tool vkey--device";
  btnDevice.setAttribute("aria-pressed", "false");
  btnDevice.innerHTML =
    '<span class="vkey__icon" aria-hidden="true">\u2328</span><span class="vkey__label">Device keyboard</span>';

  const btnFn = document.createElement("button");
  btnFn.type = "button";
  btnFn.className = "vkey vkey--tool";
  btnFn.textContent = "Fn";
  btnFn.setAttribute("aria-pressed", "false");
  btnFn.title = "Show function keys";

  const hint = document.createElement("p");
  hint.className = "vkeys__hint";
  hint.textContent =
    "Use Device keyboard to type. On-screen keys cover Ctrl/Alt/arrows.";

  toolbar.append(btnDevice, btnFn, hint);

  // --- Modifier + edit row ------------------------------------------------
  const rowMods = document.createElement("div");
  rowMods.className = "vkeys__row vkeys__row--mods";
  MODIFIERS.forEach((d) => rowMods.appendChild(addModifier(d)));

  const editGroup = document.createElement("div");
  editGroup.className = "vkeys__group";
  EDIT.forEach((d) => editGroup.appendChild(addMomentary(d, "")));
  editGroup.appendChild(addMomentary({ key: "space", label: "Space" }, "vkey--space"));
  rowMods.appendChild(editGroup);

  // --- Arrow D-pad + optional F-keys --------------------------------------
  const rowNav = document.createElement("div");
  rowNav.className = "vkeys__row vkeys__row--nav";

  const dpad = document.createElement("div");
  dpad.className = "vkeys__dpad";
  dpad.setAttribute("aria-label", "Arrow keys");
  const arrowBtns: Record<string, HTMLButtonElement> = {};
  for (const d of ARROWS) {
    arrowBtns[d.key] = addMomentary(d, `vkey--arrow vkey--arrow-${d.key}`);
  }
  dpad.append(
    arrowBtns.up,
    arrowBtns.left,
    arrowBtns.down,
    arrowBtns.right,
  );

  const fnWrap = document.createElement("div");
  fnWrap.className = "vkeys__fkeys";
  fnWrap.hidden = true;
  FKEYS.forEach((key) =>
    fnWrap.appendChild(
      addMomentary({ key, label: key.toUpperCase() }, "vkey--fn"),
    ),
  );

  rowNav.append(dpad, fnWrap);

  // Typing strip sits above the keys so it stays visible with the OSK.
  root.append(deviceKb.element, toolbar, rowMods, rowNav);

  const syncDeviceBtn = (isOpen: boolean) => {
    btnDevice.classList.toggle("vkey--active", isOpen);
    btnDevice.setAttribute("aria-pressed", String(isOpen));
    const label = btnDevice.querySelector(".vkey__label");
    if (label) {
      label.textContent = isOpen ? "Hide device keyboard" : "Device keyboard";
    }
    root.classList.toggle("vkeys--device-open", isOpen);
  };

  btnDevice.addEventListener("click", (e) => {
    e.preventDefault();
    if (deviceKb.isOpen()) {
      deviceKb.close();
    } else {
      deviceKb.open();
    }
  });

  deviceKb.onChange(syncDeviceBtn);

  btnFn.addEventListener("click", (e) => {
    e.preventDefault();
    fnVisible = !fnVisible;
    fnWrap.hidden = !fnVisible;
    btnFn.classList.toggle("vkey--active", fnVisible);
    btnFn.setAttribute("aria-pressed", String(fnVisible));
    if (deviceKb.isOpen()) deviceKb.open();
  });

  return {
    element: root,
    setVisible(visible: boolean) {
      root.style.display = visible ? "" : "none";
      if (!visible && deviceKb.isOpen()) deviceKb.close();
    },
    isDeviceKeyboardOpen: () => deviceKb.isOpen(),
    openDeviceKeyboard: () => deviceKb.open(),
    closeDeviceKeyboard: () => deviceKb.close(),
    onDeviceKeyboardChange: (cb) => deviceKb.onChange(cb),
  };
}
