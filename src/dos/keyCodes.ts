// js-dos / DOSBox key codes. These match GLFW key codes (verified against the
// installed js-dos build, e.g. ESC=256, ENTER=257, TAB=258, F1=290).
export const KBD = {
  space: 32,
  esc: 256,
  enter: 257,
  tab: 258,
  backspace: 259,
  right: 262,
  left: 263,
  down: 264,
  up: 265,
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

// A printable ASCII char maps to its uppercase code point (what DOSBox expects).
export function charToKeyCode(ch: string): number | null {
  const code = ch.toUpperCase().charCodeAt(0);
  return code >= 32 && code <= 96 ? code : null;
}
