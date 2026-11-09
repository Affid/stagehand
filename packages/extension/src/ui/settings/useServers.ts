// The registered servers, read from the background, and adding or removing
// one. Adding asks for the server's site first, so the browser's prompt runs
// within the user's click.
import { useCallback, useEffect, useState } from "preact/hooks";
import type { ServerRecord } from "../../background/state.ts";
import { permissionOrigin, type ServerId } from "../../background/servers.ts";
import type { SettingsPlatform } from "./platform.ts";

/** A saved server, and whether its scripts are really registered. */
export interface ListedServer extends ServerRecord {
  readonly active: boolean;
}

export interface Servers {
  /** Null until the background answers. */
  readonly list: readonly ListedServer[] | null;
  /** Asks for the site, then registers it; false when the user refused. */
  readonly add: (server: ServerId) => Promise<boolean>;
  readonly remove: (server: ServerId) => Promise<void>;
  /** The app's home: an empty name shows the address again. */
  readonly rename: (server: ServerId, name: string) => Promise<void>;
  /** The same server at a new address; false when its site was refused. */
  readonly move: (from: ServerId, to: ServerId) => Promise<boolean>;
}

const listOf = (reply: unknown): readonly ListedServer[] =>
  (reply as { servers?: readonly ListedServer[] }).servers ?? [];

/** "localhost:30000", "vtt.example.com/foundry": the address without http. */
export const serverLabel = (server: ServerId): string =>
  server.replace(/^https?:\/\//, "");

export function useServers(platform: SettingsPlatform): Servers {
  const [list, setList] = useState<readonly ListedServer[] | null>(null);
  const refresh = useCallback(async (): Promise<void> => {
    setList(listOf(await platform.send({ kind: "list-servers" })));
  }, [platform]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const add = async (server: ServerId): Promise<boolean> => {
    // Not awaited: the browser's prompt must open within the click. The
    // background finishes the add if the popup closes meanwhile.
    platform.send({ kind: "adding-server", server }).catch(() => undefined);
    const granted = await platform.permissions.request(
      permissionOrigin(server),
    );
    if (!granted) return false;
    await platform.send({ kind: "register-server", server });
    // Added either way; a list that fails to refresh is shown next time.
    await refresh().catch(() => undefined);
    return true;
  };
  const remove = async (server: ServerId): Promise<void> => {
    setList(listOf(await platform.send({ kind: "remove-server", server })));
  };
  const rename = async (server: ServerId, name: string): Promise<void> => {
    setList(
      listOf(await platform.send({ kind: "rename-server", server, name })),
    );
  };
  const move = async (from: ServerId, to: ServerId): Promise<boolean> => {
    try {
      const reply = await moveServer(platform, from, to);
      if (reply === undefined) return false;
      setList(listOf(reply));
      return true;
    } catch (error: unknown) {
      // Whatever the move left is shown, not a stale list (code review).
      await refresh().catch(() => undefined);
      throw error;
    }
  };
  return { list, add, remove, rename, move };
}

/**
 * Asks for the new address's site, then moves; a failed move gives the
 * site back unless a saved server still uses it (no allowed site left over).
 */
async function moveServer(
  platform: SettingsPlatform,
  from: ServerId,
  to: ServerId,
): Promise<unknown> {
  const origin = permissionOrigin(to);
  if (!(await platform.permissions.request(origin))) return undefined;
  try {
    return await platform.send({ kind: "move-server", from, to });
  } catch (error: unknown) {
    await giveBack(platform, origin).catch(() => undefined);
    throw error;
  }
}

/** The site of a failed move, unless a saved server still uses it. */
async function giveBack(
  platform: SettingsPlatform,
  origin: string,
): Promise<void> {
  const saved = listOf(await platform.send({ kind: "list-servers" }));
  if (!saved.some((s) => permissionOrigin(s.id) === origin))
    await platform.permissions.remove(origin);
}
