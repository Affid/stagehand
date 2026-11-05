// Loads the Setup config: a fresh cached copy, else the remote file, else
// the bundled one (R-4, V-5). The remote file is data, validated, never run.
import type { KeyValue } from "../background/kv.ts";
import {
  BUNDLED_CONFIG,
  REMOTE_CONFIG_URL,
  type SetupConfig,
  SetupConfigSchema,
} from "./config.ts";

export const CONFIG_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CACHE_KEY = "setupConfig";

interface Cached {
  readonly fetchedAt: number;
  readonly config: SetupConfig;
}

export interface ConfigDeps {
  readonly kv: KeyValue;
  readonly fetchText: (url: string) => Promise<string>;
  readonly now: () => number;
}

/** The newer of two configs; the bundled one wins a tie. */
const newer = (remote: SetupConfig, bundled: SetupConfig): SetupConfig =>
  remote.revision > bundled.revision ? remote : bundled;

async function fetchRemote(deps: ConfigDeps): Promise<SetupConfig | undefined> {
  try {
    const parsed = SetupConfigSchema.safeParse(
      JSON.parse(await deps.fetchText(REMOTE_CONFIG_URL)),
    );
    return parsed.success ? parsed.data : undefined;
  } catch {
    // Offline, not published yet, or not JSON: the bundled config applies.
    return undefined;
  }
}

export async function loadSetupConfig(deps: ConfigDeps): Promise<SetupConfig> {
  const cached = await deps.kv.get<Cached>(CACHE_KEY);
  const valid = cached ? SetupConfigSchema.safeParse(cached.config) : undefined;
  if (
    cached &&
    valid?.success &&
    deps.now() - cached.fetchedAt < CONFIG_MAX_AGE_MS
  )
    return newer(valid.data, BUNDLED_CONFIG);
  const remote = await fetchRemote(deps);
  if (remote) {
    await deps.kv.set(CACHE_KEY, { fetchedAt: deps.now(), config: remote });
    return newer(remote, BUNDLED_CONFIG);
  }
  return valid?.success ? newer(valid.data, BUNDLED_CONFIG) : BUNDLED_CONFIG;
}
