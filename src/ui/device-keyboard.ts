import type { CommandInterface } from "../dos/jsdos";
import {
  KBD,
  charNeedsShift,
  charToKeyCode,
  eventKeyToCode,
} from "../dos/keyCodes";

type GetCi = () => CommandInterface | null;

export interface DeviceKeyboard {
  /** Focus target — append inside the control pad. */
  element: HTMLTextAreaElement;
  /** Whether the bridge currently holds focus (soft keyboard likely open). */
  isOpen(): boolean;
  /** Focus the bridge from a user gesture so the OS soft keyboard appears. */
  open(): void;
  /** Blur the bridge and dismiss the soft keyboard. */
  close(): void;
  /** Subscribe to open/close changes (focus/blur). Returns an unsubscribe. */
  onChange(cb: (open: boolean) => void): () => void;
}

const hasBeforeInput =
  typeof InputEvent !== "undefined" && "inputType" in InputEvent.prototype;

/**
 * Bridges the mobile/OS soft keyboard into js-dos.
 *
 * Canvas elements never open a device keyboard, so we keep a real textarea,
 * focus it on demand, and forward typed characters / special keys via
 * `ci.sendKeyEvent`. Autocorrect and capitalization are disabled so DOS gets
 * what the user typed.
 */
export function createDeviceKeyboard(getCi: GetCi): DeviceKeyboard {
  const input = document.createElement("textarea");
  input.className = "device-kb";
  input.setAttribute("aria-label", "Type into DOS");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("autocapitalize", "none");
  input.setAttribute("spellcheck", "false");
  input.setAttribute("enterkeyhint", "enter");
  input.setAttribute("inputmode", "text");
  input.rows = 1;
  input.value = "";
  input.placeholder = "Tap here or Device keyboard to type\u2026";
  // Read-only until opened: prevents accidental focus/zoom on page load.
  input.readOnly = true;

  const listeners = new Set<(open: boolean) => void>();
  let open = false;
  let suppressBlurClose = false;
  const held = new Set<number>();

  const notify = () => {
    for (const cb of listeners) cb(open);
  };

  const sendKey = (code: number, pressed: boolean) => {
    getCi()?.sendKeyEvent(code, pressed);
  };

  const tapKey = (code: number) => {
    sendKey(code, true);
    sendKey(code, false);
  };

  const sendChar = (ch: string) => {
    if (ch === "\n" || ch === "\r") {
      tapKey(KBD.enter);
      return;
    }
    if (ch === "\t") {
      tapKey(KBD.tab);
      return;
    }

    const code = charToKeyCode(ch);
    if (code === null) return;

    // DOSBox letter keys are uppercase scancodes; hold Shift for capitals so
    // the Turbo C++ editor (and similar) receive the right case.
    const addShift = charNeedsShift(ch);
    if (addShift) sendKey(KBD.leftshift, true);
    tapKey(code);
    if (addShift) sendKey(KBD.leftshift, false);
  };

  const flushInputValue = () => {
    const text = input.value;
    if (!text) return;
    for (const ch of text) sendChar(ch);
    input.value = "";
  };

  // Prefer beforeinput: it gives inserted text even when keydown is missing
  // (common on mobile) and fires before the value mutates.
  input.addEventListener("beforeinput", (e) => {
    if (input.readOnly) return;
    const ev = e as InputEvent;
    ev.preventDefault();

    switch (ev.inputType) {
      case "insertText":
      case "insertCompositionText":
      case "insertFromPaste": {
        const data = ev.data ?? "";
        for (const ch of data) sendChar(ch);
        break;
      }
      case "insertLineBreak":
      case "insertParagraph":
        tapKey(KBD.enter);
        break;
      case "deleteContentBackward":
      case "deleteContent":
        tapKey(KBD.backspace);
        break;
      case "deleteContentForward":
        tapKey(KBD.delete);
        break;
      default:
        break;
    }
    // Keep the field empty so IME / OS never accumulates buffer state.
    input.value = "";
  });

  // Fallback when beforeinput is missing or skipped (older WebViews).
  input.addEventListener("input", () => {
    if (input.readOnly) return;
    flushInputValue();
  });

  input.addEventListener("keydown", (e) => {
    if (input.readOnly || e.metaKey || e.isComposing) return;

    // Printable characters: keep the textarea empty. beforeinput (or the
    // input fallback) delivers the character to DOS.
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      if (!hasBeforeInput) sendChar(e.key);
      return;
    }

    const code = eventKeyToCode(e.key);
    if (code === null) return;

    // Enter / Backspace also arrive via beforeinput on modern browsers —
    // skip the keydown path there to avoid double-firing.
    if (
      hasBeforeInput &&
      (e.key === "Enter" || e.key === "Backspace" || e.key === "Delete")
    ) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    if (e.repeat) {
      sendKey(code, true);
      held.add(code);
      return;
    }
    sendKey(code, true);
    held.add(code);
  });

  input.addEventListener("keyup", (e) => {
    if (input.readOnly || e.metaKey || e.isComposing) return;
    const code = eventKeyToCode(e.key);
    if (code === null) return;
    if (held.has(code)) {
      sendKey(code, false);
      held.delete(code);
    }
  });

  input.addEventListener("focus", () => {
    if (input.readOnly) return;
    open = true;
    input.value = "";
    input.classList.add("device-kb--open");
    input.placeholder = "Typing into DOS\u2026";
    notify();
  });

  input.addEventListener("blur", () => {
    if (suppressBlurClose) return;
    for (const code of held) sendKey(code, false);
    held.clear();
    open = false;
    input.readOnly = true;
    input.classList.remove("device-kb--open");
    input.placeholder = "Tap here or Device keyboard to type\u2026";
    notify();
  });

  // Tapping the strip itself should open the soft keyboard. Clearing
  // readOnly before the browser's focus handling is enough — do not
  // preventDefault here or iOS may refuse to open the OSK.
  input.addEventListener("pointerdown", () => {
    input.readOnly = false;
  });

  return {
    element: input,
    isOpen: () => open,
    open() {
      input.readOnly = false;
      // iOS only opens the keyboard from a synchronous user-gesture focus.
      input.focus({ preventScroll: true });
      if (document.activeElement !== input) {
        suppressBlurClose = true;
        requestAnimationFrame(() => {
          input.readOnly = false;
          input.focus({ preventScroll: true });
          suppressBlurClose = false;
        });
      }
    },
    close() {
      for (const code of held) sendKey(code, false);
      held.clear();
      if (document.activeElement === input) {
        input.blur();
        return;
      }
      if (!open) return;
      open = false;
      input.readOnly = true;
      input.classList.remove("device-kb--open");
      input.placeholder = "Tap here or Device keyboard to type\u2026";
      notify();
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
