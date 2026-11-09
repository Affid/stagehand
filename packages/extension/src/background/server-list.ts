// The saved servers as the settings panel and the app's home see them:
// listed, named, moved to a new address, taken off (Android plan, phase 6).
import {
  isActive,
  registerServer,
  type ScriptingPlatform,
  unregisterServer,
} from "./registration.ts";
import { normalizeServerUrl, type ServerId } from "./servers.ts";
import type { ServerState } from "./state.ts";

export interface ServerListDeps {
  readonly state: ServerState;
  readonly scripting: ScriptingPlatform;
}

/** The registered servers, oldest first, and whether each is really on. */
export async function listServers(deps: ServerListDeps): Promise<unknown> {
  const records = Object.values(await deps.state.servers());
  const sorted = [...records].sort((a, b) =>
    a.addedAt.localeCompare(b.addedAt),
  );
  const servers = await Promise.all(
    sorted.map(async (r) => ({
      ...r,
      active: await isActive(r.id, deps.scripting),
    })),
  );
  return { servers };
}

export async function removeServer(
  deps: ServerListDeps,
  server: ServerId,
): Promise<unknown> {
  const ids = Object.keys(await deps.state.servers());
  if (!ids.includes(server)) return listServers(deps);
  const others = ids.filter((id) => id !== server);
  await unregisterServer(server, others, deps.scripting);
  await deps.state.removeServer(server);
  return listServers(deps);
}

export async function renameServer(
  deps: ServerListDeps,
  server: ServerId,
  name: string,
): Promise<unknown> {
  if (!(server in (await deps.state.servers())))
    throw new Error("No such server");
  await deps.state.renameServer(server, name.trim());
  return listServers(deps);
}

/**
 * The same Foundry at a new address: its library, queue, name and what
 * Setup last showed go along; the old address is taken off as a removal
 * does (its data stays behind, as after any removal).
 */
export async function moveServer(
  deps: ServerListDeps,
  from: ServerId,
  input: string,
): Promise<unknown> {
  const saved = await deps.state.servers();
  if (!(from in saved)) throw new Error("No such server");
  const to = normalizeServerUrl(input);
  if (to in saved) throw new Error("That address is already saved");
  await registerServer(to, deps.scripting);
  try {
    await deps.state.moveServer(from, to);
  } catch (error: unknown) {
    // No scripts left at an address with no record (code review); its site
    // the home screen gives back. Copied keys stay, as after any removal.
    await unregisterServer(to, Object.keys(saved), deps.scripting).catch(
      () => undefined,
    );
    throw error;
  }
  return removeServer(deps, from);
}
