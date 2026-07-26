import type { CommandInterface } from "../dos/jsdos";
import { KBD, type KbdKey } from "../dos/keyCodes";

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

// Momentary keys: down on pointerdown, up on pointerup. Holding also works,
// which matters for arrow keys in games like Dave.
const SPECIAL: KeyDef[] = [
  { key: "tab", label: "Tab" },
  { key: "esc", label: "Esc" },
  { key: "enter", label: "Enter" },
  { key: "space", label: "Space" },
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
}

export function createModifierBar(getCi: GetCi): ModifierBar {
  const root = document.createElement("div");
  root.className = "vkeys";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Virtual control keys");

  const latched = new Set<KbdKey>();
  const latchedButtons = new Map<KbdKey, HTMLButtonElement>();

  const releaseLatched = () => {
    const ci = getCi();
    if (latched.size === 0) return;
    for (const k of latched) {
      ci?.sendKeyEvent(KBD[k], false);
      latchedButtons.get(k)?.classList.remove("vkey--active");
    }
    latched.clear();
  };

  const makeButton = (def: KeyDef, extraCls: string): HTMLButtonElement => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `vkey ${extraCls} ${def.cls ?? ""}`.trim();
    btn.textContent = def.label;
    return btn;
  };

  const addModifier = (def: KeyDef) => {
    const btn = makeButton(def, "vkey--mod");
    btn.setAttribute("aria-pressed", "false");
    latchedButtons.set(def.key, btn);
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
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
    let held = false;

    const press = (e: Event) => {
      e.preventDefault();
      if (held) return;
      held = true;
      // Send the key BEFORE anything that could throw (e.g. setPointerCapture
      // with a synthetic pointerId), so the key-down always reaches the game.
      getCi()?.sendKeyEvent(KBD[def.key], true);
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
      getCi()?.sendKeyEvent(KBD[def.key], false);
      btn.classList.remove("vkey--down");
      // A combo like Ctrl+F9 clears the latched modifier afterwards.
      releaseLatched();
    };

    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("lostpointercapture", release);
    // Safety net: never let a key stay stuck down.
    window.addEventListener("blur", () => release());
    return btn;
  };

  const rowMain = document.createElement("div");
  rowMain.className = "vkeys__row";
  MODIFIERS.forEach((d) => rowMain.appendChild(addModifier(d)));
  SPECIAL.forEach((d) => rowMain.appendChild(addMomentary(d, "")));

  const rowNav = document.createElement("div");
  rowNav.className = "vkeys__row";
  ARROWS.forEach((d) => rowNav.appendChild(addMomentary(d, "vkey--arrow")));

  const fnWrap = document.createElement("div");
  fnWrap.className = "vkeys__fkeys";
  FKEYS.forEach((key) =>
    fnWrap.appendChild(
      addMomentary({ key, label: key.toUpperCase() }, "vkey--fn"),
    ),
  );
  rowNav.appendChild(fnWrap);

  root.append(rowMain, rowNav);
  return { element: root };
}
