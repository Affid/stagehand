// The game page's relay between the companion module (page JavaScript, over
// window.postMessage) and the background. No Foundry logic here (PRD 6).
// Started by the extension's game-bridge script and the app's app-game
// script, each with its own way to the background.
import { logError } from "@module-library/shared/log";
import {
  type Envelope,
  isEnvelope,
  makeEnvelope,
  PROTOCOL_VERSIONS,
} from "@module-library/shared/protocol";
import type { Send } from "../ui/actions.ts";

export interface GameBridgeDeps {
  readonly send: Send;
  readonly win: Window;
}

const worldOf = (msg: Envelope): string | undefined => {
  const p = msg.payload as { worldId?: unknown } | null;
  return typeof p?.worldId === "string" ? p.worldId : undefined;
};

/** Starts relaying; returns a function that stops listening (tests). */
export function startGameBridge({ send, win }: GameBridgeDeps): () => void {
  const init = send<{ enabled: boolean; extensionVersion: string }>({
    kind: "bridge-init",
  });
  const post = (msg: Envelope): void => {
    win.postMessage(msg, win.location.origin);
  };

  /** The world this page belongs to, taken from the companion's HELLO. */
  let pinnedWorld: string | undefined;
  /** Messages about another world than the HELLO's are dropped. */
  const sameWorld = (msg: Envelope): boolean => {
    if (msg.type === "HELLO") {
      pinnedWorld ??= worldOf(msg);
      return worldOf(msg) === pinnedWorld;
    }
    const world = worldOf(msg);
    return world === undefined || world === pinnedWorld;
  };

  const relay = async (
    msg: Envelope & { readonly from: "module" },
  ): Promise<void> => {
    const { enabled } = await init;
    if (!enabled) return;
    post(await send<Envelope>({ kind: "relay", msg }));
  };

  // Listening at once: the module may say HELLO before the background answers.
  const onMessage = (event: MessageEvent<unknown>): void => {
    if (event.source !== win || event.origin !== win.location.origin) return;
    if (!isEnvelope(event.data, "module") || !sameWorld(event.data)) return;
    relay(event.data).catch((error: unknown) => {
      logError("bridge", error);
    });
  };
  win.addEventListener("message", onMessage);

  init.then(
    ({ enabled, extensionVersion }) => {
      if (!enabled) return;
      post(
        makeEnvelope("bridge", "BRIDGE_READY", {
          extensionVersion,
          protocol: PROTOCOL_VERSIONS,
        }),
      );
    },
    (error: unknown) => {
      logError("bridge", error);
    },
  );
  return () => {
    win.removeEventListener("message", onMessage);
  };
}
