// Shared by the live specs of Stagehand's view in Module Management: the
// library file they put on the server, and Foundry's window.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import {
  emptyLibrary,
  type Library,
} from "../../packages/shared/src/library/schema.ts";
import { serializeSyncFile } from "../../packages/shared/src/library/sync-file.ts";

export const LIB = "st-fixture-lib";
export const A = "st-fixture-a";

export const LIBRARY: Library = {
  ...emptyLibrary("test"),
  folders: [
    {
      id: "f1",
      name: "Fixtures",
      color: "#3c8dc9",
      parentId: null,
      order: 0,
      collapsed: false,
      revision: 1,
    },
  ],
  modules: {
    [A]: { folderId: "f1", tags: [], note: "Needs the library" },
    [LIB]: { folderId: "f1", tags: [], note: "" },
  },
  presets: [
    {
      id: "p1",
      name: "Fixture pair",
      description: "A and what it needs",
      modules: [A, LIB],
      source: "user",
      revision: 1,
    },
  ],
};

/** Puts the library file on the server; the returned function puts back what was there. */
export function placeLibrary(dataDir: string): () => void {
  const file = libraryFile(dataDir);
  const previous = existsSync(file) ? readFileSync(file, "utf8") : undefined;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    serializeSyncFile(
      { side: { library: LIBRARY, sorted: [] }, id: "t1", history: [] },
      new Date().toISOString(),
    ),
  );
  return () => {
    if (previous === undefined) rmSync(file, { force: true });
    else writeFileSync(file, previous);
  };
}

export const libraryFile = (dataDir: string): string =>
  join(dataDir, "Data", "stagehand", "library.json");

export const win = (page: Page): Locator => page.locator("#module-management");

export const card = (w: Locator, id: string): Locator =>
  w.locator(`.stw-card[data-module="${id}"]`);

export const dialog = (page: Page, title: string): Locator =>
  page.locator(".application.dialog").filter({ hasText: title });

export async function openModules(page: Page): Promise<Locator> {
  await page.evaluate(async () => {
    const g = globalThis as unknown as {
      foundry: {
        applications: {
          sidebar: {
            apps: {
              ModuleManagement: new () => {
                render(o: object): Promise<unknown>;
              };
            };
          };
        };
      };
    };
    await new g.foundry.applications.sidebar.apps.ModuleManagement().render({
      force: true,
    });
  });
  await win(page).waitFor();
  return win(page);
}

export async function closeModules(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const g = globalThis as unknown as {
      foundry: {
        applications: { instances: Map<string, { close(): Promise<unknown> }> };
      };
    };
    await g.foundry.applications.instances.get("module-management")?.close();
  });
  await win(page).waitFor({ state: "detached" });
}

export async function setSetting(
  page: Page,
  ns: string,
  key: string,
  value: unknown,
): Promise<void> {
  await page.evaluate(
    async ([n, k, v]) => {
      const g = globalThis as unknown as {
        game: {
          settings: { set(n: string, k: string, v: unknown): Promise<unknown> };
        };
      };
      await g.game.settings.set(n, k, v);
    },
    [ns, key, value] as const,
  );
}

export const getSetting = (
  page: Page,
  ns: string,
  key: string,
): Promise<unknown> =>
  page.evaluate(
    ([n, k]) =>
      (
        globalThis as unknown as {
          game: { settings: { get(n: string, k: string): unknown } };
        }
      ).game.settings.get(n, k),
    [ns, key] as const,
  );
