// Whether Foundry answers at the address being typed: asked of native a
// moment after typing stops (server.check), the latest answer only.
import { useEffect, useState } from "preact/hooks";
import type { ServerId } from "../../background/servers.ts";

export type Check =
  | { readonly kind: "idle" }
  | { readonly kind: "checking"; readonly server: ServerId }
  | { readonly kind: "ok"; readonly server: ServerId; readonly version: string }
  | {
      readonly kind: "none";
      readonly server: ServerId;
      readonly error: string;
    };

/** How long typing must pause before the address is checked. */
export const CHECK_DELAY_MS = 600;

const IDLE: Check = { kind: "idle" };

export function useCheck(
  check: ((server: ServerId) => Promise<string>) | undefined,
  server: ServerId | undefined,
  delayMs = CHECK_DELAY_MS,
): Check {
  const [state, setState] = useState<Check>(IDLE);
  useEffect(() => {
    if (!server || !check) {
      setState(IDLE);
      return undefined;
    }
    let current = true;
    setState({ kind: "checking", server });
    const timer = setTimeout(() => {
      check(server)
        .then((version) => {
          if (current) setState({ kind: "ok", server, version });
        })
        .catch((e: unknown) => {
          const error = e instanceof Error ? e.message : String(e);
          if (current) setState({ kind: "none", server, error });
        });
    }, delayMs);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [check, server, delayMs]);
  return state;
}
