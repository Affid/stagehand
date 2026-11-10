// Library sync between two devices on one server (docs/LIBRARY-SYNC-PLAN.md,
// phase 4): two Chrome profiles, each with its own copy of the extension
// and its own storage, edit the library; both end up with both changes. A
// damaged file on the server is replaced, with a notice. The app shares the
// UI and background; its harness can't run Setup at the moment (app-smoke
// fails the same way), so it is not one of the devices yet.
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
import {
  loadTargetOf,
  ON_APP,
  openSetupAsAdmin,
  type Target,
} from "./target.ts";

const env = loadFoundryEnv();
const FOLDER = join(env.dataDir, "Data", "stagehand");
const FILE = join(FOLDER, "library.json");
const ASIDE = join(
  import.meta.dirname,
  "..",
  "..",
  "test-results",
  "library-sync",
);

interface Device {
  readonly target: Target;
  readonly page: Page;
}

let admin: APIRequestContext;
let one: Device;
let two: Device;

test.describe.configure({ mode: "serial" });
test.skip(ON_APP, "two Chrome profiles; the extension run only");

const shell = (d: Device): Locator => d.page.locator("#st-shell-root");
const lib = (d: Device): Locator => shell(d).locator(".stl-page");

/** The tags in the server's file; none while it is missing or damaged. */
function tagNames(): string[] {
  try {
    const file = JSON.parse(readFileSync(FILE, "utf8")) as {
      library?: { tags?: { name: string }[] };
    };
    return file.library?.tags?.map((t) => t.name) ?? [];
  } catch {
    return [];
  }
}

async function openLibrary(d: Device): Promise<void> {
  await shell(d)
    .getByRole("button", { name: /^Library/ })
    .click();
  await expect(lib(d).locator(".stl-sync.synced")).toBeVisible();
}

async function device(copy: string): Promise<Device> {
  const target = await loadTargetOf("extension", [], { copy });
  const page = await target.context.newPage();
  await openSetupAsAdmin(target, page, env.url, env.adminPassword);
  const d = { target, page };
  await openLibrary(d);
  return d;
}

async function tagsPanel(d: Device): Promise<Locator> {
  await lib(d).getByRole("button", { name: "Tags", exact: true }).click();
  return shell(d).getByRole("complementary", { name: "Tags" });
}

async function newTag(d: Device, name: string): Promise<void> {
  const panel = await tagsPanel(d);
  await panel.getByRole("button", { name: "New tag" }).click();
  const field = panel.getByRole("textbox", { name: "Name" });
  await field.fill(name);
  await field.press("Enter");
  await expect(panel.locator(".sts-list li.active")).toContainText(name);
  await panel.getByRole("button", { name: "Close" }).click();
}

async function reopen(d: Device): Promise<void> {
  await d.page.reload();
  await openLibrary(d);
}

test.beforeAll(async () => {
  admin = await createAdminClient(env.url);
  await shutdownWorld(admin, env.adminPassword);
  if (existsSync(FOLDER)) {
    mkdirSync(ASIDE, { recursive: true });
    renameSync(FOLDER, join(ASIDE, `devices-${String(Date.now())}`));
  }
  one = await device("device-one");
  two = await device("device-two");
});

test.afterAll(async () => {
  await one.target.close();
  await two.target.close();
  await admin.dispose();
});

test("a tag made on each device ends up on both", async () => {
  await newTag(one, "made on one");
  await newTag(two, "made on two");
  await expect
    .poll(tagNames, { timeout: 15_000 })
    .toEqual(expect.arrayContaining(["made on one", "made on two"]));
  for (const d of [one, two]) {
    await reopen(d);
    const panel = await tagsPanel(d);
    await expect(panel).toContainText("made on one");
    await expect(panel).toContainText("made on two");
    await panel.getByRole("button", { name: "Close" }).click();
  }
  await two.page.screenshot({
    path: `${SCREENS}/library-sync-two-devices.png`,
  });
});

test("a tag deleted on one device goes from the other", async () => {
  const panel = await tagsPanel(two);
  await panel.locator(".sts-list li", { hasText: "made on one" }).click();
  two.page.once("dialog", (dialog) => void dialog.accept());
  await panel.getByRole("button", { name: "Delete tag" }).click();
  await panel.getByRole("button", { name: "Close" }).click();
  await expect.poll(tagNames, { timeout: 15_000 }).not.toContain("made on one");
  await reopen(one);
  const there = await tagsPanel(one);
  await expect(there).not.toContainText("made on one");
  await expect(there).toContainText("made on two");
  await there.getByRole("button", { name: "Close" }).click();
});

test("a damaged file is replaced by this device's library, with a notice", async () => {
  writeFileSync(FILE, "<html>not a library</html>");
  await one.page.reload();
  await expect(
    one.page.locator("#notifications li", { hasText: "could not be read" }),
  ).toBeVisible();
  await expect.poll(tagNames, { timeout: 15_000 }).toContain("made on two");
  await one.page.screenshot({ path: `${SCREENS}/library-sync-repaired.png` });
});
