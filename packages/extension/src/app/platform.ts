// The app's side of each platform interface, over the native bridge: what
// the extension does with chrome.* (platform/chrome.ts, platform/runtime.ts,
// ui/settings/platform.ts, ui/ports.ts), the app asks native for. Request
// names and payloads: native-api.ts.
import { logError } from "@module-library/shared/log";
import { z } from "zod";
import type { KeyValue } from "../background/kv.ts";
import type { ScriptingPlatform } from "../background/registration.ts";
import type { ContentScript } from "../background/servers.ts";
import {
  FOUNDRY_ORIGIN,
  type ReleasesPlatform,
} from "../background/releases.ts";
import type { ExtensionMessage } from "../messages.ts";
import type { Send } from "../ui/actions.ts";
import type { UiPorts } from "../ui/ports.ts";
import type { SettingsPlatform } from "../ui/settings/platform.ts";
import type { NativeBridge } from "./bridge.ts";
import {
  CheckResultSchema,
  ConfirmResultSchema,
  FetchResultSchema,
  type FetchPurpose,
  FilesOpenResultSchema,
  IdsResultSchema,
  KvGetResultSchema,
} from "./native-api.ts";

/** The user answers dialogs and pickers in their own time. */
const USER_PACE = { timeoutMs: null } as const;

/** Native's yes or no; anything else is an error, not a quiet no (review). */
const asBoolean = (value: unknown): boolean => z.boolean().parse(value);

export function nativeKeyValue(bridge: NativeBridge): KeyValue {
  return {
    async get<T>(key: string) {
      const reply = KvGetResultSchema.parse(
        await bridge.request("kv.get", { key }),
      );
      return reply.value as T | undefined;
    },
    async set(key, value) {
      await bridge.request("kv.set", { key, value });
    },
  };
}

/** The server a set of content scripts is for: `${server}/setup*` without the page. */
export function serverOfScripts(scripts: readonly ContentScript[]): string {
  const servers = new Set(
    scripts.map((s) => (s.matches[0] ?? "").replace(/\/(setup|game)\*$/, "")),
  );
  const [server] = servers;
  if (servers.size !== 1 || !server)
    throw new Error("Scripts for one server at a time");
  return server;
}

export function nativeScripting(bridge: NativeBridge): ScriptingPlatform {
  return {
    async hasPermission(origin) {
      return asBoolean(
        await bridge.request("permissions.contains", { origin }),
      );
    },
    async registeredIds(ids) {
      return IdsResultSchema.parse(
        await bridge.request("scripts.registered", { ids: [...ids] }),
      );
    },
    async unregister(ids) {
      await bridge.request("scripts.unregister", { ids: [...ids] });
    },
    // Native gets the server and the ids, never the extension's file
    // names: it injects its own two scripts (security review).
    async register(scripts) {
      await bridge.request("scripts.register", {
        server: serverOfScripts(scripts),
        ids: scripts.map((s) => s.id),
      });
    },
    // Best effort, as in the extension: the server is taken off either way.
    async removePermission(origin) {
      try {
        await bridge.request("permissions.remove", { origin });
      } catch (error: unknown) {
        logError("background", error);
      }
    },
  };
}

/** NativeFetch: native checks the URL against its purpose (native-api.ts). */
export function nativeFetch(
  bridge: NativeBridge,
  purpose: FetchPurpose,
): (url: string) => Promise<string> {
  return async (url) =>
    FetchResultSchema.parse(await bridge.request("fetch", { url, purpose }))
      .text;
}

export function nativeReleases(bridge: NativeBridge): ReleasesPlatform {
  return {
    permitted: async () =>
      asBoolean(
        await bridge.request("permissions.contains", {
          origin: FOUNDRY_ORIGIN,
        }),
      ),
    fetchText: nativeFetch(bridge, "release"),
  };
}

/**
 * A message to the background: native relays it with the sender attached.
 * No timeout here, as in the extension: the background may still finish
 * the work (an import, a removal) after any limit we set, so native owns
 * the timeout of `route` (review).
 */
export function nativeSend(bridge: NativeBridge): Send {
  return <T>(message: ExtensionMessage) =>
    bridge.request<T>("runtime.send", { message }, USER_PACE);
}

export function nativePorts(bridge: NativeBridge): UiPorts {
  return {
    files: {
      async save(fileName, text) {
        await bridge.request("files.save", { fileName, text }, USER_PACE);
      },
      async open() {
        const reply = await bridge.request("files.open", {}, USER_PACE);
        return FilesOpenResultSchema.parse(reply).text;
      },
    },
    async confirm(text) {
      const reply = await bridge.request("confirm", { text }, USER_PACE);
      return ConfirmResultSchema.parse(reply).yes;
    },
    openExternal(url) {
      bridge.request("openExternal", { url }).catch((error: unknown) => {
        logError("open link", error);
      });
      return true;
    },
  };
}

/** The home screen: no tab under it, so no "This site" section. */
export function nativeSettingsPlatform(
  bridge: NativeBridge,
  build: string,
): SettingsPlatform {
  const ask = async (
    type: string,
    origin: string,
    options = {},
  ): Promise<boolean> =>
    asBoolean(await bridge.request(type, { origin }, options));
  return {
    send: nativeSend(bridge),
    permissions: {
      // Only a request may wait for the user; the rest are native's own work.
      request: (origin) => ask("permissions.request", origin, USER_PACE),
      contains: (origin) => ask("permissions.contains", origin),
      remove: (origin) => ask("permissions.remove", origin),
    },
    currentTab: () => Promise.resolve(undefined),
    reload: () => Promise.resolve(),
    isFoundry: () => Promise.resolve(false),
    build,
    app: {
      // A tap opens the server's Setup in the app (native takes the link).
      serverHref: (server) => `${server}/setup`,
      check: async (server) => {
        const reply = CheckResultSchema.safeParse(
          await bridge.request("server.check", { server }),
        );
        // Native's own words otherwise; never a schema message (review).
        if (!reply.success) throw new Error("Not a Foundry server");
        return reply.data.version;
      },
    },
  };
}
