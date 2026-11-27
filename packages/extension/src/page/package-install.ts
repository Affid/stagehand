// Installing the ticked updates in the page world (docs/UPDATES-PLAN.md,
// phase 3): Foundry's own backup of each package first when asked, then
// Foundry's own install of each, in the order the UI worked out, from the
// manifest our check found. Foundry's dependency installer stays off: an
// update that needs a package that isn't installed is never ticked.
import type { InstallRequest } from "../page-package-install.ts";
import type { PageToUi } from "../page-protocol.ts";
import type { PageGlobals } from "./globals.ts";
import { manifestFor, recheck, versionFor } from "./package-check.ts";

type Loose = Readonly<Record<string, unknown>>;

interface InstallGame {
  readonly modules?: { get?(id: string): unknown };
  readonly systems?: { get?(id: string): unknown };
  installPackage?(o: {
    type: string;
    id: string;
    manifest: string;
    notify: boolean;
    dependencies: boolean;
  }): Promise<unknown>;
  createBackup?(
    pkg: { type: string; id: string; title: string },
    options: { note: string },
  ): Promise<boolean>;
}

const MAX_ERROR = 300;

const isObject = (v: unknown): v is Loose =>
  typeof v === "object" && v !== null;

/** Foundry's reason, without any address (a Patreon link may hold a key). */
function errorText(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return raw
    .replace(/^\[[^\]]*\]\s*/, "")
    .replace(/https?:\/\/\S+/g, "its address")
    .slice(0, MAX_ERROR);
}

/** The HTTP status behind a failed install: Foundry's code, else its words. */
function codeOf(e: unknown): number | undefined {
  const code = isObject(e) ? e.errorCode : undefined;
  if (
    typeof code === "number" &&
    Number.isInteger(code) &&
    code >= 100 &&
    code <= 599
  )
    return code;
  const text = e instanceof Error ? e.message : String(e);
  if (/\bForbidden\b|\b403\b/.test(text)) return 403;
  if (/\bUnauthorized\b|\b401\b/.test(text)) return 401;
  return undefined;
}

function titleOf(
  game: InstallGame | undefined,
  type: string,
  id: string,
): string {
  const pkg = (type === "system" ? game?.systems : game?.modules)?.get?.(id);
  return isObject(pkg) && typeof pkg.title === "string" ? pkg.title : id;
}

type Post = (m: PageToUi) => void;
type Item = InstallRequest["items"][number];

async function backupAll(
  game: InstallGame | undefined,
  req: InstallRequest,
  post: Post,
): Promise<Set<string>> {
  const failed = new Set<string>();
  for (const { type, id } of req.items) {
    post({
      type: "PACKAGE_INSTALL",
      payload: { requestId: req.requestId, kind: "item", id, state: "backup" },
    });
    const version = versionFor(type, id);
    const note = version
      ? `Before updating to ${version} (Stagehand)`
      : "Before updating (Stagehand)";
    const ok = await game
      ?.createBackup?.({ type, id, title: titleOf(game, type, id) }, { note })
      .catch(() => false);
    if (ok === true) continue;
    failed.add(id);
    post({
      type: "PACKAGE_INSTALL",
      payload: {
        requestId: req.requestId,
        kind: "item",
        id,
        state: "failed",
        error: "The backup didn't finish, so it wasn't updated.",
      },
    });
  }
  return failed;
}

async function installOne(
  game: InstallGame | undefined,
  requestId: string,
  item: Item,
  post: Post,
): Promise<void> {
  const { type, id } = item;
  const manifest = manifestFor(type, id);
  const fail = (error: string, errorCode?: number): void => {
    post({
      type: "PACKAGE_INSTALL",
      payload: {
        requestId,
        kind: "item",
        id,
        state: "failed",
        error,
        ...(errorCode ? { errorCode } : {}),
      },
    });
  };
  if (!manifest || !game?.installPackage) {
    fail("Check it again first: no update was found for it.");
    return;
  }
  post({
    type: "PACKAGE_INSTALL",
    payload: { requestId, kind: "item", id, state: "installing" },
  });
  try {
    await game.installPackage({
      type,
      id,
      manifest,
      notify: false,
      dependencies: false,
    });
    post({
      type: "PACKAGE_INSTALL",
      payload: { requestId, kind: "item", id, state: "done" },
    });
  } catch (e: unknown) {
    fail(errorText(e), codeOf(e));
  }
}

/** Backs up (when asked) and installs each package in order, posting each state. */
export async function runInstall(
  page: Pick<PageGlobals, "game">,
  req: InstallRequest,
  post: Post,
): Promise<void> {
  const game = page.game as InstallGame | undefined;
  // The page was reloaded since the check: each one's manifest, checked again.
  for (const item of req.items)
    if (!manifestFor(item.type, item.id))
      await recheck(page, item).catch(() => false);
  const skipped = req.backup
    ? await backupAll(game, req, post)
    : new Set<string>();
  for (const item of req.items) {
    if (!skipped.has(item.id))
      await installOne(game, req.requestId, item, post);
  }
  post({
    type: "PACKAGE_INSTALL",
    payload: { requestId: req.requestId, kind: "done" },
  });
}
