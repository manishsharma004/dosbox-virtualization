import type { CommandInterface, DosProps } from "./jsdos";

const BASE = import.meta.env.BASE_URL;
const VENDOR = `${BASE}vendor/js-dos/`;
const BUNDLE_URL = `${BASE}msdos.jsdos`;
const EMULATORS_PATH_PREFIX = `${VENDOR}emulators/`;

let loader: Promise<void> | null = null;

// Load the js-dos UMD runtime (js + css) exactly once. Assets are self-hosted
// next to the app so nothing depends on an external CDN at runtime.
function loadJsDos(): Promise<void> {
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    if (typeof window.Dos === "function") {
      resolve();
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${VENDOR}js-dos.css`;
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = `${VENDOR}js-dos.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error(`Failed to load js-dos runtime from ${VENDOR}`));
    document.head.appendChild(script);
  });
  return loader;
}

export interface DosSession {
  stop(): Promise<void>;
}

export async function startDos(
  container: HTMLElement,
  onCiReady: (ci: CommandInterface | null) => void,
): Promise<DosSession> {
  await loadJsDos();
  if (typeof window.Dos !== "function") {
    throw new Error("js-dos runtime unavailable");
  }

  let props: DosProps | null = null;
  let stopped = false;

  props = window.Dos(container, {
    url: BUNDLE_URL,
    pathPrefix: EMULATORS_PATH_PREFIX,
    theme: "dark",
    backend: "dosbox",
    autoStart: true,
    noCloud: true,
    onEvent: (event: string, ...args: unknown[]) => {
      if (stopped) return;
      if (event === "ci-ready") {
        onCiReady(args[0] as CommandInterface);
      }
    },
  });

  return {
    async stop() {
      stopped = true;
      onCiReady(null);
      await props?.stop().catch(() => {
        /* ignore shutdown races */
      });
    },
  };
}
