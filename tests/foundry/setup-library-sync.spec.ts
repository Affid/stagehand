// Library sync (docs/LIBRARY-SYNC-PLAN.md) on the local Foundry: Setup puts
// the library on the server when it opens and after edits, takes another
// device's changes when it opens again, and the page world reads and writes
// the file with the admin's session (the folder starts missing).
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import {
  createAdminClient,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { SCREENS } from "./extension.ts";
import { loadTarget, ON_APP, openSetupAsAdmin, type Target } from "./target.ts";

const env = loadFoundryEnv();
const FOLDER = join(env.dataDir, "Data", "stagehand");
const ASIDE = join(
  import.meta.dirname,
  "..",
  "..",
  "test-results",
  "library-sync",
);

let ext: Target;
let admin: APIRequestContext;
let page: Page;

test.describe.configure({ mode: "serial" });
// The page-world probe posts on the window channel, which only the
// extension uses; phase 4's walk covers both targets through the UI.
test.skip(ON_APP, "extension only until the UI drives sync");

/** Moves a library file left by an earlier run away, so the folder is new. */
function setFolderAside(): void {
  if (!existsSync(FOLDER)) return;
  mkdirSync(ASIDE, { recursive: true });
  renameSync(FOLDER, join(ASIDE, `stagehand-${String(Date.now())}`));
}

interface Reply {
  readonly text?: string;
  readonly missing?: true;
  readonly error?: string;
}

/** What setup-ui sends; answered by setup-main with the same request id. */
function libraryFile(p: Page, ask: object): Promise<Reply> {
  return p.evaluate(
    (payload) =>
      new Promise<Reply>((resolve) => {
        const requestId = `t${String(Date.now())}`;
        window.addEventListener("message", function on(e: MessageEvent) {
          const d = e.data as {
            from?: string;
            type?: string;
            payload?: { requestId?: string } & Reply;
          };
          if (d.from !== "setup-main" || d.type !== "LIBRARY_FILE_DONE") return;
          if (d.payload?.requestId !== requestId) return;
          window.removeEventListener("message", on);
          const { text, missing, error } = d.payload;
          resolve({
            ...(text === undefined ? {} : { text }),
            ...(missing ? { missing } : {}),
            ...(error === undefined ? {} : { error }),
          });
        });
        window.postMessage(
          {
            ns: "stagehand",
            v: 1,
            from: "setup-ui",
            type: "LIBRARY_FILE",
            payload: { requestId, ...payload },
          },
          window.location.origin,
        );
      }),
    ask,
  );
}

test.beforeAll(async () => {
  admin = await createAdminClient(env.url);
  await shutdownWorld(admin, env.adminPassword);
  setFolderAside();
  ext = await loadTarget();
  page = await ext.context.newPage();
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
  await openLibrary();
});

async function openLibrary(): Promise<void> {
  await page
    .locator("#st-shell-root")
    .getByRole("button", { name: /^Library/ })
    .click();
}

test.afterAll(async () => {
  await ext.close();
  await admin.dispose();
});

const FILE = join(FOLDER, "library.json");

interface FileShape {
  readonly format: string;
  readonly library: { readonly tags: readonly { name: string }[] };
}

const onServer = (): FileShape | null =>
  existsSync(FILE)
    ? (JSON.parse(readFileSync(FILE, "utf8")) as FileShape)
    : null;

const tagNames = (): string[] =>
  onServer()?.library.tags.map((t) => t.name) ?? [];

const lib = (): Locator => page.locator("#st-shell-root .stl-page");
const shell = (): Locator => page.locator("#st-shell-root");

test("opening Setup puts this device's library on the server", async () => {
  await expect.poll(() => onServer()?.format).toBe("stagehand-library");
  await expect(lib().locator(".stl-sync.synced")).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/library-sync-synced.png` });
});

test("a new tag reaches the server once the edits pause", async () => {
  await lib().getByRole("button", { name: "Tags", exact: true }).click();
  const panel = shell().getByRole("complementary", { name: "Tags" });
  await panel.getByRole("button", { name: "New tag" }).click();
  const name = panel.getByRole("textbox", { name: "Name" });
  await name.fill("synced here");
  await name.press("Enter");
  await expect.poll(tagNames, { timeout: 10_000 }).toContain("synced here");
  await panel.getByRole("button", { name: "Close" }).click();
});

test("a tag another device saved comes in when Setup opens again", async () => {
  const file = JSON.parse(readFileSync(FILE, "utf8")) as {
    library: { tags: object[] };
  };
  const remote = {
    id: "remote-tag",
    name: "from elsewhere",
    color: "#3366aa",
    revision: 1,
  };
  writeFileSync(
    FILE,
    JSON.stringify({
      ...file,
      library: { ...file.library, tags: [...file.library.tags, remote] },
    }),
  );
  await page.reload();
  await openLibrary();
  await expect(lib().locator(".stl-sync.synced")).toBeVisible();
  await lib().getByRole("button", { name: "Tags", exact: true }).click();
  const panel = shell().getByRole("complementary", { name: "Tags" });
  await expect(panel).toContainText("from elsewhere");
  await expect(panel).toContainText("synced here");
  await page.screenshot({ path: `${SCREENS}/library-sync-remote-tag.png` });
  await panel.getByRole("button", { name: "Close" }).click();
});

test("the page world writes, overwrites and reads the file; it is public", async () => {
  const text = readFileSync(FILE, "utf8");
  expect(await libraryFile(page, { op: "write", text: `${text} ` })).toEqual(
    {},
  );
  expect(await libraryFile(page, { op: "write", text })).toEqual({});
  expect(await libraryFile(page, { op: "read" })).toEqual({ text });
  // The file is public, as planned: readable without a session.
  const outsider = await createAdminClient(env.url);
  const response = await outsider.get("/stagehand/library.json");
  expect(await response.text()).toBe(text);
  await outsider.dispose();
});
