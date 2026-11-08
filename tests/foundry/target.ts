// What the live suites run against (Android plan, phase 2, package 5): the
// extension in Chromium (default) or the app's web part in the app harness
// (`ML_TARGET=app`, `pnpm test:foundry:app`). The specs open Setup and read
// or seed the background's storage through this, the same on both.
import { type BrowserContext, expect, type Page } from "@playwright/test";
import { FOUNDRY_ORIGIN } from "../../packages/extension/src/background/releases.ts";
import {
  type AppHarness,
  launchApp,
  openAppSetupAsAdmin,
} from "../app/harness.ts";
import {
  exitTour,
  type LoadedExtension,
  loadExtension,
  type LoadOptions,
  openSetupAsAdmin as openExtensionSetup,
  storage as extensionStorage,
  waitForSettingsPanel,
} from "./extension.ts";

export type TargetKind = "extension" | "app";

export const TARGET: TargetKind =
  process.env.ML_TARGET === "app" ? "app" : "extension";
export const ON_APP = TARGET === "app";

/** The background's storage, as chrome.storage.local's get and set. */
export interface TargetStorage {
  /** Everything stored. */
  all(): Promise<Record<string, unknown>>;
  set(items: Readonly<Record<string, unknown>>): Promise<void>;
}

/** Reads one key, changes it with `fn`, writes it back (a test seeding state). */
export async function updateStored<T>(
  target: Target,
  key: string,
  fn: (current: T | undefined) => T,
): Promise<void> {
  const current = (await target.storage.all())[key] as T | undefined;
  await target.storage.set({ [key]: fn(current) });
}

export interface Target {
  readonly kind: TargetKind;
  readonly context: BrowserContext;
  readonly storage: TargetStorage;
  /** Only on the extension: its service worker and id. */
  readonly ext?: LoadedExtension;
  /** Only on the app: the harness and its native side. */
  readonly app?: AppHarness;
  close(): Promise<void>;
}

function extensionTarget(ext: LoadedExtension): Target {
  return {
    kind: "extension",
    context: ext.context,
    ext,
    storage: {
      all: () => extensionStorage(ext.worker),
      set: (items) =>
        ext.worker.evaluate((i) => chrome.storage.local.set(i), { ...items }),
    },
    close: () => ext.context.close(),
  };
}

function appTarget(app: AppHarness): Target {
  return {
    kind: "app",
    context: app.context,
    app,
    storage: {
      all: () =>
        Promise.resolve(
          Object.fromEntries(
            [...app.native.kv.keys()].map((k) => [k, app.native.get(k)]),
          ),
        ),
      set: (items) => {
        Object.entries(items).forEach(([k, v]) => {
          app.native.set(k, v);
        });
        return Promise.resolve();
      },
    },
    close: () => app.close(),
  };
}

/**
 * The target with `hosts` allowed from the start: on the extension, host
 * permissions granted at install; on the app, foundryvtt.com turns Release
 * history on (the only other host a suite needs).
 */
export async function loadTarget(
  hosts: readonly string[] = [],
  options: LoadOptions = {},
): Promise<Target> {
  if (!ON_APP) return extensionTarget(await loadExtension(hosts, options));
  const app = await launchApp(options);
  // The app can grant only Release history's site; any other host is a
  // suite asking for something the app can't give.
  for (const host of hosts) {
    if (host !== FOUNDRY_ORIGIN)
      throw new Error(`The app can't allow ${host} from the start`);
    app.native.releaseHistory = true;
  }
  return appTarget(app);
}

/** Adds the server, logs in as admin and opens Setup with our page on it. */
export async function openSetupAsAdmin(
  target: Target,
  page: Page,
  url: string,
  password: string,
): Promise<void> {
  if (target.ext) {
    await openExtensionSetup(target.ext, page, url, password);
    return;
  }
  if (!target.app) throw new Error("No target");
  await openAppSetupAsAdmin(target.app, page, url, password);
  await exitTour(page);
}

/**
 * The settings opened over Setup: the extension's panel, or the app's home
 * screen (native's home.open).
 */
export async function settingsOpened(
  target: Target,
  page: Page,
  click: () => Promise<void>,
): Promise<void> {
  const native = target.app?.native;
  const before = native?.homeOpens ?? 0;
  await click();
  if (target.ext) {
    await waitForSettingsPanel(target.ext, page);
    return;
  }
  await expect.poll(() => native?.homeOpens ?? 0).toBe(before + 1);
}

/**
 * Follows a link to another site: on the extension it opens a new tab
 * (closed again), on the app native gets it (a Custom Tab on Android).
 * Resolves with the address that opened.
 */
export async function openedExternally(
  target: Target,
  click: () => Promise<void>,
): Promise<string> {
  if (target.ext) {
    const [tab] = await Promise.all([
      target.context.waitForEvent("page"),
      click(),
    ]);
    const url = tab.url();
    await tab.close();
    return url;
  }
  const native = target.app?.native;
  const before = native?.external.length ?? 0;
  await click();
  await expect.poll(() => native?.external.length ?? 0).toBe(before + 1);
  return native?.external.at(-1) ?? "";
}
