// Minimal typings for the js-dos v8 UMD global (window.Dos). The library does
// not publish types for the player entrypoint, so we declare just what we use.
export interface CommandInterface {
  sendKeyEvent(keyCode: number, pressed: boolean): void;
  simulateKeyPress(...keyCodes: number[]): void;
  screenshot(): Promise<ImageData>;
  exit(): Promise<void>;
}

export interface DosOptions {
  url?: string;
  dosboxConf?: string;
  pathPrefix?: string;
  theme?: string;
  backend?: "dosbox" | "dosboxX";
  autoStart?: boolean;
  noCloud?: boolean;
  onEvent?: (event: string, ...args: unknown[]) => void;
}

export interface DosProps {
  stop(): Promise<void>;
  setTheme(theme: string): void;
}

export type DosFactory = (el: HTMLElement, options: DosOptions) => DosProps;

declare global {
  interface Window {
    Dos?: DosFactory;
  }
}
