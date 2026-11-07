// Extension background entry: wires Chrome/Firefox APIs into the router.
import "@module-library/shared/zod-config";
import { logError } from "@module-library/shared/log";
import type { SetupConfig } from "../adapters/config.ts";
import { loadSetupConfig } from "../adapters/remote.ts";
import { serialized } from "../background/kv.ts";
import { chromeKeyValue, chromeScripting } from "../platform/chrome.ts";
import { FOUNDRY_ORIGIN, fetchRelease } from "../background/releases.ts";
import { grantedOrigins, route } from "../background/router.ts";
import { createState } from "../background/state.ts";

const FETCH_TIMEOUT_MS = 5000;

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
  return response.text();
}

let config: Promise<SetupConfig> | undefined;
const loadConfig = (): Promise<SetupConfig> => {
  config ??= loadSetupConfig({
    kv: chromeKeyValue(),
    fetchText,
    now: Date.now,
  });
  return config;
};

const releases = {
  permitted: () => chrome.permissions.contains({ origins: [FOUNDRY_ORIGIN] }),
  fetchText: fetchRelease,
};

/** One panel at a time: a page can't keep opening it (security review). */
const SETTINGS_GAP_MS = 2000;
let settingsAt = 0;

/**
 * The settings panel over the page: the toolbar popup where the browser
 * lets us open it, else the options dialog (the same panel).
 */
async function openSettings(): Promise<void> {
  if (Date.now() - settingsAt < SETTINGS_GAP_MS) return;
  settingsAt = Date.now();
  try {
    await chrome.action.openPopup();
  } catch {
    await chrome.runtime.openOptionsPage();
  }
}

const deps = {
  state: createState(serialized(chromeKeyValue())),
  scripting: chromeScripting(),
  releases,
  openSettings,
  extensionId: chrome.runtime.id,
  extensionUrl: chrome.runtime.getURL(""),
  extensionVersion: chrome.runtime.getManifest().version,
  loadConfig,
  now: () => new Date().toISOString(),
  uuid: () => crypto.randomUUID(),
};

// A server the panel was adding, once its site is allowed (code review).
chrome.permissions.onAdded.addListener((granted) => {
  grantedOrigins(deps, granted.origins ?? []).catch((error: unknown) => {
    logError("background", error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  route(deps, message, {
    id: sender.id,
    url: sender.url,
    fromTab: sender.tab !== undefined,
  }).then(
    (result) => {
      sendResponse({ ok: true, result });
    },
    (error: unknown) => {
      logError("background", error);
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  );
  return true;
});
