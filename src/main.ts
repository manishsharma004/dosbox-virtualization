import "./ui/shell.css";
import { startDos } from "./dos/player";
import { createModifierBar } from "./ui/modifier-bar";
import type { CommandInterface } from "./dos/jsdos";
import { KBD, charToKeyCode } from "./dos/keyCodes";

let ci: CommandInterface | null = null;
const getCi = () => ci;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Type a command into the DOS prompt (used by the quick-launch buttons).
async function typeCommand(command: string) {
  const cur = ci;
  if (!cur) return;
  for (const ch of command) {
    const code = charToKeyCode(ch);
    if (code === null) continue;
    cur.sendKeyEvent(code, true);
    await delay(45);
    cur.sendKeyEvent(code, false);
    await delay(55);
  }
  cur.sendKeyEvent(KBD.enter, true);
  await delay(45);
  cur.sendKeyEvent(KBD.enter, false);
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function build() {
  const app = document.getElementById("app")!;

  const header = h("header", "app__bar");
  const title = h("div", "app__title");
  title.append(h("span", "app__logo", "DOS"), h("span", undefined, "MS-DOS in the Browser"));

  const actions = h("div", "app__actions");
  const btnTc = h("button", "app__btn", "Turbo C++");
  const btnDave = h("button", "app__btn", "Dave");
  const btnMenu = h("button", "app__btn app__btn--ghost", "Menu");
  const btnFull = h("button", "app__btn app__btn--ghost", "Fullscreen");
  const btnKeys = h("button", "app__btn app__btn--ghost", "Hide controls");
  const btnDeviceKb = h("button", "app__btn app__btn--ghost", "Device keyboard");
  [btnTc, btnDave, btnMenu, btnFull, btnKeys, btnDeviceKb].forEach((b) =>
    b.setAttribute("type", "button"),
  );
  actions.append(btnTc, btnDave, btnMenu, btnFull, btnDeviceKb, btnKeys);
  header.append(title, actions);

  const screen = h("main", "app__screen");
  const canvas = h("div", "dos-canvas");
  const loading = h("div", "app__loading");
  loading.append(h("div", "app__spinner"), h("p", undefined, "Booting MS-DOS\u2026"));
  screen.append(canvas, loading);

  const bar = createModifierBar(getCi);

  app.append(header, screen, bar.element);

  // --- Interactions -------------------------------------------------------
  const setBusyButtons = (enabled: boolean) => {
    [btnTc, btnDave, btnMenu].forEach((b) => (b.disabled = !enabled));
  };
  setBusyButtons(false);

  btnTc.addEventListener("click", () => void typeCommand("TC"));
  btnDave.addEventListener("click", () => void typeCommand("DAVE"));
  btnMenu.addEventListener("click", () => void typeCommand("MENU"));

  btnFull.addEventListener("click", () => {
    const target = screen as HTMLElement & {
      webkitRequestFullscreen?: () => void;
    };
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (target.requestFullscreen) {
      void target.requestFullscreen();
    } else if (target.webkitRequestFullscreen) {
      target.webkitRequestFullscreen();
    }
  });

  let keysVisible = true;
  btnKeys.addEventListener("click", () => {
    keysVisible = !keysVisible;
    bar.setVisible(keysVisible);
    btnKeys.textContent = keysVisible ? "Hide controls" : "Show controls";
  });

  const syncDeviceKbBtn = () => {
    const device = bar.getMode() === "device";
    btnDeviceKb.textContent = device ? "Hide keyboard" : "Device keyboard";
    btnDeviceKb.classList.toggle("app__btn--active", device);
  };
  bar.onModeChange(syncDeviceKbBtn);
  bar.onDeviceKeyboardChange(syncDeviceKbBtn);
  btnDeviceKb.addEventListener("click", () => {
    if (bar.getMode() === "device") {
      bar.closeDeviceKeyboard();
    } else {
      if (!keysVisible) {
        keysVisible = true;
        bar.setVisible(true);
        btnKeys.textContent = "Hide controls";
      }
      bar.openDeviceKeyboard();
    }
  });

  // Keep the layout sized to the *visual* viewport so the virtual keys stay
  // visible when the mobile device keyboard opens.
  const vv = window.visualViewport;
  const applyHeight = () => {
    const height = vv ? vv.height : window.innerHeight;
    document.documentElement.style.setProperty("--app-height", `${height}px`);
  };
  applyHeight();
  vv?.addEventListener("resize", applyHeight);
  vv?.addEventListener("scroll", applyHeight);
  window.addEventListener("resize", applyHeight);

  // --- Boot DOS -----------------------------------------------------------
  startDos(canvas, (next) => {
    ci = next;
    const ready = next !== null;
    setBusyButtons(ready);
    loading.style.display = ready ? "none" : "";
  }).catch((err) => {
    loading.innerHTML = "";
    loading.append(
      h("p", "app__error", "Failed to start DOS."),
      h("p", "app__error-detail", String(err?.message ?? err)),
    );
  });
}

build();
