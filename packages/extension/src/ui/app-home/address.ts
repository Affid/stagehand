// A server's address as the app's home takes it: the protocol from a
// toggle, the rest typed as Foundry shows it (Android plan, phase 6).
import { normalizeServerUrl, type ServerId } from "../../background/servers.ts";

export type Scheme = "http" | "https";

/** What the address field holds: the toggle and the text after it. */
export interface Typed {
  readonly scheme: Scheme;
  readonly rest: string;
}

const WHOLE = /^\s*(https?):\/\//i;

/** A pasted whole address picks the toggle; the rest stays as typed. */
export function readTyped(value: string, scheme: Scheme): Typed {
  const whole = WHOLE.exec(value);
  if (!whole) return { scheme, rest: value };
  const picked = whole[1]?.toLowerCase() === "https" ? "https" : "http";
  return { scheme: picked, rest: value.slice(whole[0].length) };
}

/** The server id the field names, or undefined while it names none. */
export function serverOf(typed: Typed): ServerId | undefined {
  const rest = typed.rest.trim();
  if (!rest || rest.includes("://")) return undefined;
  try {
    return normalizeServerUrl(`${typed.scheme}://${rest}`);
  } catch {
    return undefined;
  }
}

/** A saved server back in the field: its toggle and address. */
export const typedOf = (server: ServerId): Typed => readTyped(server, "http");

/** "192.168.1.20:30000", "vtt.example.com/foundry": the id without http. */
export const hostOf = (server: ServerId): string =>
  server.replace(/^https?:\/\//, "");

/** The card's letter: the name's first, else the host's. */
export const letterOf = (label: string): string =>
  (label.trim()[0] ?? "?").toUpperCase();
