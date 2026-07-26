// js-dos / DOSBox key codes. These match GLFW key codes (verified against the
// installed js-dos build, e.g. ESC=256, ENTER=257, TAB=258, F1=290).
export const KBD = {
  space: 32,
  esc: 256,
  enter: 257,
  tab: 258,
  backspace: 259,
  insert: 260,
  delete: 261,
  right: 262,
  left: 263,
  down: 264,
  up: 265,
  pageup: 266,
  pagedown: 267,
  home: 268,
  end: 269,
  capslock: 280,
  f1: 290,
  f2: 291,
  f3: 292,
  f4: 293,
  f5: 294,
  f6: 295,
  f7: 296,
  f8: 297,
  f9: 298,
  f10: 299,
  f11: 300,
  f12: 301,
  leftshift: 340,
  leftctrl: 341,
  leftalt: 342,
  rightshift: 344,
  rightctrl: 345,
  rightalt: 346,
} as const;

export type KbdKey = keyof typeof KBD;

// A printable ASCII char maps to its uppercase code point (what DOSBox expects
// for letter keys). Punctuation keeps its own code point.
export function charToKeyCode(ch: string): number | null {
  if (!ch) return null;
  const upper = ch.toUpperCase();
  const code = upper.charCodeAt(0);
  return code >= 32 && code <= 126 ? code : null;
}

/** True when the character is an uppercase Latin letter that needs Shift. */
export function charNeedsShift(ch: string): boolean {
  return ch.length === 1 && ch >= "A" && ch <= "Z";
}

const EVENT_KEY_TO_CODE: Record<string, number> = {
  Escape: KBD.esc,
  Enter: KBD.enter,
  Tab: KBD.tab,
  Backspace: KBD.backspace,
  " ": KBD.space,
  ArrowLeft: KBD.left,
  ArrowRight: KBD.right,
  ArrowUp: KBD.up,
  ArrowDown: KBD.down,
  Home: KBD.home,
  End: KBD.end,
  PageUp: KBD.pageup,
  PageDown: KBD.pagedown,
  Insert: KBD.insert,
  Delete: KBD.delete,
  F1: KBD.f1,
  F2: KBD.f2,
  F3: KBD.f3,
  F4: KBD.f4,
  F5: KBD.f5,
  F6: KBD.f6,
  F7: KBD.f7,
  F8: KBD.f8,
  F9: KBD.f9,
  F10: KBD.f10,
  F11: KBD.f11,
  F12: KBD.f12,
  Control: KBD.leftctrl,
  Alt: KBD.leftalt,
  Shift: KBD.leftshift,
};

/** Map a KeyboardEvent.key value to a DOSBox/js-dos key code, if known. */
export function eventKeyToCode(key: string): number | null {
  if (EVENT_KEY_TO_CODE[key] !== undefined) return EVENT_KEY_TO_CODE[key];
  if (key.length === 1) return charToKeyCode(key);
  return null;
}
