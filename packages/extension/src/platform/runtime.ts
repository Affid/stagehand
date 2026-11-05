// Sends a message to the background and unwraps its { ok, result } reply.
import type { ExtensionMessage } from "../messages.ts";

interface Reply {
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: string;
}

export async function send<T>(message: ExtensionMessage): Promise<T> {
  const reply = await chrome.runtime.sendMessage<
    ExtensionMessage,
    Reply | undefined
  >(message);
  if (!reply?.ok) throw new Error(reply?.error ?? "No reply from background");
  return reply.result as T;
}
