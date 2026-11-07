// Request/response over window.postMessage with the extension's bridge.
// Answers are matched by requestId; anything unsolicited is ignored (8.6).
import {
  type Envelope,
  isEnvelope,
  makeEnvelope,
  newRequestId,
} from "@module-library/shared/protocol";

export interface Channel {
  request(
    type: string,
    payload: unknown,
    timeoutMs?: number,
  ): Promise<Envelope>;
  onBridgeReady(fn: () => void): void;
}

const DEFAULT_TIMEOUT_MS = 5000;

/** Nobody answered in time: the only failure worth asking again for. */
export class ChannelTimeout extends Error {
  constructor(type: string) {
    super(`No answer to ${type}`);
    this.name = "ChannelTimeout";
  }
}

export function createChannel(win: Window): Channel {
  const pending = new Map<string, (msg: Envelope) => void>();
  const readyListeners: (() => void)[] = [];

  win.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source !== win || event.origin !== win.location.origin) return;
    if (!isEnvelope(event.data, "bridge")) return;
    const msg = event.data;
    if (msg.type === "BRIDGE_READY") {
      readyListeners.forEach((fn) => {
        fn();
      });
      return;
    }
    const resolve = msg.requestId ? pending.get(msg.requestId) : undefined;
    resolve?.(msg);
  });

  return {
    request(type, payload, timeoutMs = DEFAULT_TIMEOUT_MS) {
      const requestId = newRequestId();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(requestId);
          reject(new ChannelTimeout(type));
        }, timeoutMs);
        pending.set(requestId, (msg) => {
          clearTimeout(timer);
          pending.delete(requestId);
          resolve(msg);
        });
        const msg = makeEnvelope("module", type, payload, requestId);
        win.postMessage(msg, win.location.origin);
      });
    },
    onBridgeReady(fn) {
      readyListeners.push(fn);
    },
  };
}
