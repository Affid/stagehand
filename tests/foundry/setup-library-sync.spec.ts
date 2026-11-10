// Library sync (docs/LIBRARY-SYNC-PLAN.md) on the local Foundry. Phase 2:
// the page world reads and writes the library file with the admin's
// session, creating the folder when it is missing.
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import {
  createAdminClient,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
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
});

test.afterAll(async () => {
  await ext.context.close();
  await admin.dispose();
});

test("reads no file, writes one into a new folder, overwrites it, reads it back", async () => {
  expect(await libraryFile(page, { op: "read" })).toEqual({ missing: true });
  expect(await libraryFile(page, { op: "write", text: '{"n":1}' })).toEqual({});
  expect(existsSync(join(FOLDER, "library.json"))).toBe(true);
  expect(await libraryFile(page, { op: "write", text: '{"n":2}' })).toEqual({});
  expect(await libraryFile(page, { op: "read" })).toEqual({ text: '{"n":2}' });
  // The file is public, as planned: readable without a session.
  const outsider = await createAdminClient(env.url);
  const response = await outsider.get("/stagehand/library.json");
  expect(await response.text()).toBe('{"n":2}');
  await outsider.dispose();
});
