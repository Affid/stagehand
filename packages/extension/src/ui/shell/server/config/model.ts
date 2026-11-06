// The Configuration page's draft, pure: what is typed against what is saved,
// the changes worth saving (text trimmed, an empty optional is unset), and
// the problems that stop a save (prototype cfgErrors).
import {
  EDITABLE,
  type SettingChanges,
  type SettingKey,
  type Settings,
} from "../../../../page-config.ts";

/** What a field holds while typed: the port may be any text for a moment. */
export type Typed = Readonly<Partial<Record<SettingKey, unknown>>>;

export type Problem = "port" | "dataPath" | "sslCert";

const MAX_PORT = 65535;

/** A typed value as Foundry would store it. */
export function clean(key: SettingKey, v: unknown): unknown {
  const kind = EDITABLE[key];
  if (kind === "port") {
    const text = String(v).trim();
    return /^\d+$/.test(text) ? Number(text) : NaN;
  }
  if (typeof v !== "string") return v;
  const text = v.trim();
  return kind === "optText" && text === "" ? null : text;
}

/** The value a field shows: typed, else saved. */
export const shown = (
  saved: Settings,
  typed: Typed,
  key: SettingKey,
): unknown => (key in typed ? typed[key] : saved[key]);

/** Typed values that differ from the saved ones, as Foundry stores them. */
export function changesOf(saved: Settings, typed: Typed): SettingChanges {
  return Object.fromEntries(
    (Object.keys(typed) as SettingKey[]).flatMap((k) => {
      const v = clean(k, typed[k]);
      return v === saved[k] ? [] : [[k, v]];
    }),
  );
}

const isAbsolute = (p: string): boolean =>
  p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p) || p.startsWith("\\\\");

/** Problems that stop a save, by field. */
export function problemsOf(
  saved: Settings,
  typed: Typed,
): ReadonlySet<Problem> {
  const v = (k: SettingKey): unknown => clean(k, shown(saved, typed, k));
  const out = new Set<Problem>();
  const port = v("port") as number;
  if (
    !v("unixSocket") &&
    !(Number.isInteger(port) && port >= 1 && port <= MAX_PORT)
  )
    out.add("port");
  const data = v("dataPath");
  if (typeof data !== "string" || !isAbsolute(data)) out.add("dataPath");
  if (Boolean(v("sslCert")) !== Boolean(v("sslKey"))) out.add("sslCert");
  return out;
}
