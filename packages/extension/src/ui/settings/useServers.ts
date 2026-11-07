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
  return { list, add, remove };
}
