// What the settings panel needs from the browser, so it can be tested with
// a fake: messages to the background, permissions, the tab it was opened
// over, and the build line.
import { BUILD } from "../../build-info.ts";
import type { ExtensionMessage } from "../../messages.ts";
import { send } from "../../platform/runtime.ts";

export interface SettingsTab {
  readonly id: number;
  readonly url: string;
}

export interface SettingsPlatform {
  readonly send: (message: ExtensionMessage) => Promise<unknown>;
  readonly permissions: {
    /** Must be the first thing a click does: the browser asks the user. */
    readonly request: (origin: string) => Promise<boolean>;
    readonly contains: (origin: string) => Promise<boolean>;
    readonly remove: (origin: string) => Promise<boolean>;
  };
  /** The tab the panel opened over; its address only with activeTab. */
  readonly currentTab: () => Promise<SettingsTab | undefined>;
  readonly reload: (tabId: number) => Promise<void>;
  /** Whether the tab shows a Foundry page: its own stylesheet or script. */
  readonly isFoundry: (tabId: number) => Promise<boolean>;
  readonly build: string;
}

/** Runs in the tab (activeTab, or a server already allowed). */
const looksLikeFoundry = (): boolean =>
  document.querySelector(
    'link[href*="css/foundry2.css"], script[src*="scripts/foundry.mjs"]',
  ) !== null;

export function chromeSettingsPlatform(): SettingsPlatform {
  return {
    send: (message) => send<unknown>(message),
    permissions: {
      request: (origin) => chrome.permissions.request({ origins: [origin] }),
      contains: (origin) => chrome.permissions.contains({ origins: [origin] }),
      remove: (origin) => chrome.permissions.remove({ origins: [origin] }),
    },
    async currentTab() {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      return tab?.id !== undefined && tab.url
        ? { id: tab.id, url: tab.url }
        : undefined;
    },
    reload: (tabId) => chrome.tabs.reload(tabId),
    async isFoundry(tabId) {
      try {
        const [hit] = await chrome.scripting.executeScript({
          target: { tabId },
          func: looksLikeFoundry,
        });
        return hit?.result === true;
      } catch {
        // Not allowed in that tab (no click on the toolbar button): unknown.
        return false;
      }
    },
    build: BUILD,
  };
}
