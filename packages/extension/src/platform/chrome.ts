// Chrome/Firefox extension APIs behind the background's interfaces.
// Thin glue, exercised by the end-to-end suite (pnpm test:foundry).
import type { KeyValue } from "../background/kv.ts";
import type { ScriptingPlatform } from "../background/registration.ts";

export function chromeKeyValue(): KeyValue {
  return {
    async get<T>(key: string) {
      const items = await chrome.storage.local.get(key);
      return items[key] as T | undefined;
    },
    set: (key, value) => chrome.storage.local.set({ [key]: value }),
  };
}

export function chromeScripting(): ScriptingPlatform {
  return {
    hasPermission: (origin) =>
      chrome.permissions.contains({ origins: [origin] }),
    async registeredIds(ids) {
      const found = await chrome.scripting.getRegisteredContentScripts({
        ids: [...ids],
      });
      return found.map((s) => s.id);
    },
    unregister: (ids) =>
      chrome.scripting.unregisterContentScripts({ ids: [...ids] }),
    register: (scripts) =>
      chrome.scripting.registerContentScripts(
        scripts.map((s) => ({
          id: s.id,
          matches: [...s.matches],
          js: [...s.js],
          ...(s.css ? { css: [...s.css] } : {}),
          world: s.world,
          runAt: s.runAt,
          persistAcrossSessions: true,
        })),
      ),
  };
}
