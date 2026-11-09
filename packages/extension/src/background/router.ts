// Routes background messages after checking who sent them (PRD 7.11, 8.6):
// the server comes from the sender's page URL, never from the message.
import { logError } from "@module-library/shared/log";
import {
  exportLibrary,
  parseLibraryImport,
} from "@module-library/shared/library/transfer";
import { newsUrls } from "@module-library/shared/news";
import { parseCoreVersion } from "@module-library/shared/version";
import type { SetupConfig } from "../adapters/config.ts";
import { allowsChanges, selectAdapter } from "../adapters/select.ts";
import {
  type ExtensionMessage,
  ExtensionMessageSchema,
  type SetupState,
} from "../messages.ts";
import {
  cancel,
  failOrphans,
  markInWorld,
  pendingFor,
  queue,
  toQueue,
} from "./commands.ts";
import {
  isActive,
  registerServer,
  type ScriptingPlatform,
} from "./registration.ts";
import { type ReleasesPlatform, readReleases } from "./releases.ts";
import {
  listServers,
  moveServer,
  removeServer,
  renameServer,
} from "./server-list.ts";
import {
  normalizeServerUrl,
  pathWithinServer,
  permissionOrigin,
  type ServerId,
  serverIdOfPage,
} from "./servers.ts";
import type { ServerState } from "./state.ts";
import { syncWorlds } from "./world-sync.ts";

export interface SenderInfo {
  readonly id?: string | undefined;
  readonly url?: string | undefined;
  readonly fromTab: boolean;
}

export interface RouterDeps {
  readonly state: ServerState;
  readonly scripting: ScriptingPlatform;
  readonly releases: ReleasesPlatform;
  /** Opens the settings panel: the toolbar popup, else the options dialog. */
  readonly openSettings: () => Promise<void>;
  readonly extensionId: string;
  readonly extensionUrl: string;
  readonly extensionVersion: string;
  readonly loadConfig: () => Promise<SetupConfig>;
  readonly now: () => string;
  readonly uuid: () => string;
}

type Msg<K extends ExtensionMessage["kind"]> = Extract<
  ExtensionMessage,
  { kind: K }
>;

/** How long one authenticated Setup visit keeps this browser verified. */
export const ADMIN_VERIFIED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function isVerified(
  deps: RouterDeps,
  server: ServerId,
): Promise<boolean> {
  const at = (await deps.state.servers())[server]?.adminVerifiedAt;
  if (at === undefined) return false;
  // PR-9: verification lapses; a Setup visit renews it.
  return Date.parse(deps.now()) - Date.parse(at) < ADMIN_VERIFIED_TTL_MS;
}

async function freshModules(
  deps: RouterDeps,
  server: ServerId,
): Promise<string[]> {
  const sorted = new Set((await deps.state.sortedModules(server)) ?? []);
  const setup = await deps.state.setup(server);
  return (setup?.modules ?? [])
    .map((m) => m.id)
    .filter((id) => !sorted.has(id));
}

async function unreadNews(
  deps: RouterDeps,
  server: ServerId,
): Promise<string[]> {
  const setup = await deps.state.setup(server);
  const seen = await deps.state.newsSeen(server);
  if (!setup || !seen) return [];
  const known = new Set(seen);
  return newsUrls(setup).filter((url) => !known.has(url));
}

/** Only articles Setup listed are remembered as seen. */
async function markNewsSeen(
  deps: RouterDeps,
  server: ServerId,
  urls: readonly string[],
): Promise<void> {
  const listed = new Set(newsUrls((await deps.state.setup(server)) ?? {}));
  await deps.state.markNewsSeen(
    server,
    urls.filter((url) => listed.has(url)),
  );
}

async function state(deps: RouterDeps, server: ServerId): Promise<SetupState> {
  const s = deps.state;
  return {
    server,
    adminVerified: await isVerified(deps, server),
    library: await s.library(server),
    setup: await s.setup(server),
    snapshots: await s.snapshots(server),
    commands: await s.commands(server),
    config: await deps.loadConfig(),
    fresh: await freshModules(deps, server),
    newsUnread: await unreadNews(deps, server),
  };
}

/** Changes need an admin-verified browser (PR-2) and a known version (V-3). */
async function assertCanChange(
  deps: RouterDeps,
  server: ServerId,
): Promise<void> {
  if (!(await isVerified(deps, server)))
    throw new Error("This browser is not admin-verified for this server.");
  const setup = await deps.state.setup(server);
  const core = parseCoreVersion(setup?.core.version ?? "0");
  if (!allowsChanges(selectAdapter(await deps.loadConfig(), core)))
    throw new Error("Unsupported Foundry version: read-only.");
}

/** Changes are only for worlds Setup listed. */
async function assertKnownWorld(
  deps: RouterDeps,
  server: ServerId,
  worldId: string,
): Promise<void> {
  const setup = await deps.state.setup(server);
  if (!setup?.worlds.some((w) => w.id === worldId))
    throw new Error(`Unknown world ${worldId}`);
}

/** Only modules that are installed are remembered as sorted. */
/** Only ids of modules Setup reported as installed (security review). */
async function installedOnly(
  deps: RouterDeps,
  server: ServerId,
  ids: readonly string[],
): Promise<string[]> {
  const installed = new Set(
    ((await deps.state.setup(server))?.modules ?? []).map((m) => m.id),
  );
  return ids.filter((id) => installed.has(id));
}

async function markSorted(
  deps: RouterDeps,
  server: ServerId,
  ids: readonly string[],
): Promise<void> {
  await deps.state.markSorted(server, await installedOnly(deps, server, ids));
}

async function queueApply(
  deps: RouterDeps,
  server: ServerId,
  m: Msg<"queue-apply">,
) {
  await assertKnownWorld(deps, server, m.worldId);
  const known = new Set(
    (await deps.state.library(server)).presets.map((p) => p.id),
  );
  const unknown = m.presetIds.filter((id) => !known.has(id));
  if (unknown.length > 0)
    throw new Error(`Unknown preset ${unknown.join(", ")}`);
  // Turning on a module that isn't installed changes nothing (security
  // review); a removal may still name one the world remembers.
  const modules =
    m.mode !== "remove" && m.modules
      ? await installedOnly(deps, server, m.modules)
      : m.modules;
  const snap = (await deps.state.snapshots(server))[m.worldId];
  const id = deps.uuid();
  await deps.state.updateCommands(server, (list) =>
    queue(list, {
      id,
      worldId: m.worldId,
      mode: m.mode,
      presetIds: m.presetIds,
      modules,
      createdAt: deps.now(),
      baseSnapshotAt: snap?.takenAt ?? null,
    }),
  );
  return { queued: id };
}

/**
 * The world's queue as Setup writes it into the world's flags: this
 * world's pending changes, expanded; any whose preset was deleted fails
 * rather than reaching the world as an empty (for Replace: destructive) one.
 */
async function worldQueue(
  deps: RouterDeps,
  server: ServerId,
  m: Msg<"world-queue">,
) {
  await assertKnownWorld(deps, server, m.worldId);
  const library = await deps.state.library(server);
  const list = await deps.state.updateCommands(server, (all) =>
    failOrphans(all, library, m.worldId),
  );
  return {
    queue: toQueue(pendingFor(list, m.worldId), library, deps.now()),
  };
}

async function libraryImport(
  deps: RouterDeps,
  server: ServerId,
  m: Msg<"library-import">,
) {
  const parsed = parseLibraryImport(m.text, server);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    library: await deps.state.replaceLibrary(server, parsed.library),
  };
}

async function setupSeen(
  deps: RouterDeps,
  server: ServerId,
  m: Msg<"setup-seen">,
) {
  await deps.state.putSetup(server, m.data, deps.now());
  await deps.state.markOpened(server, deps.now());
  // Only an admin's Setup lists the worlds' flags we act on.
  if (m.data.isAdmin) await syncWorlds(deps.state, server, m.data, deps.now());
  // Only a real admin visit seeds what counts as sorted.
  if (m.data.isAdmin)
    await deps.state.seedSorted(
      server,
      m.data.modules.map((x) => x.id),
    );
  // Nothing is new on a first visit (SETUP-REDESIGN.md, open item 3).
  await deps.state.seedNews(server, newsUrls(m.data));
  // PR-1: only an authenticated Setup page (Foundry's isAdmin) verifies.
  if (m.data.isAdmin) await deps.state.markAdminVerified(server, deps.now());
  else await deps.state.revokeAdmin(server);
  return state(deps, server);
}

const SETUP_WRITES: ReadonlySet<string> = new Set([
  "library-op",
  "library-import",
  "library-export",
  "queue-apply",
  "cancel-command",
  "world-queue",
  "queue-written",
  "modules-sorted",
]);

async function fromSetup(
  deps: RouterDeps,
  server: ServerId,
  m: ExtensionMessage,
): Promise<unknown> {
  if (m.kind === "setup-seen") return setupSeen(deps, server, m);
  if (m.kind === "get-state") return state(deps, server);
  // Foundry's public release notes: read only, nothing of this server's.
  if (m.kind === "foundry-releases")
    return readReleases(deps.releases, m.version);
  if (m.kind === "open-settings") return deps.openSettings();
  // Read state for this browser's view only, like the page's other views.
  if (m.kind === "news-seen") {
    await markNewsSeen(deps, server, m.urls);
    return state(deps, server);
  }
  if (!SETUP_WRITES.has(m.kind))
    throw new Error(`Unexpected ${m.kind} from Setup`);
  await assertCanChange(deps, server);
  switch (m.kind) {
    case "library-op":
      return deps.state.applyLibraryOp(server, m.op);
    case "library-import":
      return libraryImport(deps, server, m);
    case "library-export":
      return {
        text: exportLibrary(await deps.state.library(server), deps.now()),
      };
    case "queue-apply":
      return queueApply(deps, server, m);
    case "cancel-command":
      return deps.state.updateCommands(server, (list) => cancel(list, m.id));
    case "modules-sorted":
      return markSorted(deps, server, m.ids);
    case "world-queue":
      return worldQueue(deps, server, m);
    case "queue-written":
      return deps.state.updateCommands(server, (list) =>
        markInWorld(list, m.worldId, m.ids, m.at),
      );
    default:
      throw new Error(`Unexpected ${m.kind} from Setup`);
  }
}

async function fromExtension(
  deps: RouterDeps,
  m: ExtensionMessage,
): Promise<unknown> {
  if (m.kind === "list-servers") return listServers(deps);
  if (m.kind === "adding-server") {
    pendingOf(deps).add(normalizeServerUrl(m.server));
    return {};
  }
  if (m.kind === "remove-server")
    return oneAtATime(deps, () => removeServer(deps, m.server));
  if (m.kind === "rename-server")
    return oneAtATime(deps, () => renameServer(deps, m.server, m.name));
  if (m.kind === "move-server")
    return oneAtATime(deps, () => moveServer(deps, m.from, m.to));
  if (m.kind !== "register-server")
    throw new Error(`Unexpected ${m.kind} from the extension`);
  return oneAtATime(deps, async () => {
    const server = await registerServer(m.server, deps.scripting);
    pendingOf(deps).delete(server);
    await deps.state.addServer(server, deps.now());
    return { server };
  });
}

/**
 * Registrations and removals one at a time: the panel's add and the
 * background finishing it would register the same scripts twice, and two
 * removals on one origin would each keep its permission for the other.
 */
const queues = new WeakMap<RouterDeps, Promise<unknown>>();
function oneAtATime<T>(deps: RouterDeps, work: () => Promise<T>): Promise<T> {
  const run = (queues.get(deps) ?? Promise.resolve()).then(work, work);
  queues.set(
    deps,
    run.catch(() => undefined),
  );
  return run;
}

/** Servers the panel was adding, per background (code review). */
const pending = new WeakMap<RouterDeps, Set<ServerId>>();
const pendingOf = (deps: RouterDeps): Set<ServerId> => {
  const found = pending.get(deps) ?? new Set<ServerId>();
  pending.set(deps, found);
  return found;
};

/**
 * Sites just allowed: a server the panel was adding there is registered,
 * even if the popup closed while the browser asked (Firefox may close it).
 */
export async function grantedOrigins(
  deps: RouterDeps,
  origins: readonly string[],
): Promise<ServerId[]> {
  const waiting = pendingOf(deps);
  const ready = [...waiting].filter((s) =>
    origins.includes(permissionOrigin(s)),
  );
  ready.forEach((s) => waiting.delete(s));
  for (const server of ready)
    await oneAtATime(deps, async () => {
      await registerServer(server, deps.scripting);
      await deps.state.addServer(server, deps.now());
    });
  return ready;
}

/**
 * Puts back the scripts the browser dropped: Chrome clears dynamically
 * registered content scripts when an extension is updated or reloaded,
 * while its storage and permissions stay (owner's bug). A saved server whose
 * site is no longer allowed stays off until it is turned on again.
 */
export async function restoreServers(deps: RouterDeps): Promise<void> {
  for (const server of Object.keys(await deps.state.servers()))
    await oneAtATime(deps, () => restoreOne(deps, server)).catch(
      (error: unknown) => {
        // One server failing doesn't keep the others off (code review).
        logError("background", error);
      },
    );
}

async function restoreOne(deps: RouterDeps, server: ServerId): Promise<void> {
  // Removed while this turn waited: not brought back (code review).
  if (!(server in (await deps.state.servers()))) return;
  const allowed = await deps.scripting.hasPermission(permissionOrigin(server));
  if (allowed && !(await isActive(server, deps.scripting)))
    await registerServer(server, deps.scripting);
}

const isPage = (path: string, page: string): boolean =>
  path === page || path.startsWith(`${page}/`);

export async function route(
  deps: RouterDeps,
  raw: unknown,
  sender: SenderInfo,
): Promise<unknown> {
  if (sender.id !== deps.extensionId || !sender.url)
    throw new Error("Unknown sender");
  const m = ExtensionMessageSchema.parse(raw);
  if (sender.url.startsWith(deps.extensionUrl)) return fromExtension(deps, m);
  if (!sender.fromTab) throw new Error("Unknown sender");
  const server = serverIdOfPage(
    sender.url,
    Object.keys(await deps.state.servers()),
  );
  if (!server) throw new Error("Message from an unregistered page");
  const path = pathWithinServer(sender.url, server);
  if (isPage(path, "/setup")) return fromSetup(deps, server, m);
  throw new Error(`Message from an unexpected page: ${path}`);
}
