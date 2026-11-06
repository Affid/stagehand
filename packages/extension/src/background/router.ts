// Routes background messages after checking who sent them (PRD 7.11, 8.6):
// the server comes from the sender's page URL, never from the message.
import {
  exportLibrary,
  parseLibraryImport,
} from "@module-library/shared/library/transfer";
import { parseCoreVersion } from "@module-library/shared/version";
import type { SetupConfig } from "../adapters/config.ts";
import { allowsChanges, selectAdapter } from "../adapters/select.ts";
import {
  type ExtensionMessage,
  ExtensionMessageSchema,
  type SetupState,
} from "../messages.ts";
import { cancel, queue } from "./commands.ts";
import { registerServer, type ScriptingPlatform } from "./registration.ts";
import { handleRelay } from "./relay.ts";
import { pathWithinServer, type ServerId, serverIdOfPage } from "./servers.ts";
import type { ServerState } from "./state.ts";

export interface SenderInfo {
  readonly id?: string | undefined;
  readonly url?: string | undefined;
  readonly fromTab: boolean;
}

export interface RouterDeps {
  readonly state: ServerState;
  readonly scripting: ScriptingPlatform;
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

async function state(deps: RouterDeps, server: ServerId): Promise<SetupState> {
  const s = deps.state;
  return {
    server,
    adminVerified: await isVerified(deps, server),
    library: await s.library(server),
    setup: await s.setup(server),
    snapshots: await s.snapshots(server),
    commands: await s.commands(server),
    hellos: await s.hellos(server),
    config: await deps.loadConfig(),
    prefs: await s.prefs(server),
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

async function queueApply(
  deps: RouterDeps,
  server: ServerId,
  m: Msg<"queue-apply">,
) {
  const known = new Set(
    (await deps.state.library(server)).presets.map((p) => p.id),
  );
  const unknown = m.presetIds.filter((id) => !known.has(id));
  if (unknown.length > 0)
    throw new Error(`Unknown preset ${unknown.join(", ")}`);
  const snap = (await deps.state.snapshots(server))[m.worldId];
  const id = deps.uuid();
  await deps.state.updateCommands(server, (list) =>
    queue(list, {
      id,
      worldId: m.worldId,
      mode: m.mode,
      presetIds: m.presetIds,
      modules: m.modules,
      createdAt: deps.now(),
      baseSnapshotAt: snap?.takenAt ?? null,
    }),
  );
  return { queued: id };
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
  "launch-hold",
]);

async function fromSetup(
  deps: RouterDeps,
  server: ServerId,
  m: ExtensionMessage,
): Promise<unknown> {
  if (m.kind === "setup-seen") return setupSeen(deps, server, m);
  if (m.kind === "get-state") return state(deps, server);
  // A display preference for this browser: no admin verification needed.
  if (m.kind === "set-pref") return deps.state.setPref(server, m.key, m.value);
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
    case "launch-hold":
      return deps.state.setLaunchHold(server, m.worldId, m.hold);
    default:
      throw new Error(`Unexpected ${m.kind} from Setup`);
  }
}

async function fromGame(
  deps: RouterDeps,
  server: ServerId,
  m: ExtensionMessage,
): Promise<unknown> {
  // PR-7 and 8.6: the bridge stays off unless this browser verified the admin.
  const enabled = await isVerified(deps, server);
  if (m.kind === "bridge-init")
    return { enabled, extensionVersion: deps.extensionVersion };
  if (m.kind === "relay" && enabled && m.msg.from === "module")
    return handleRelay({ state: deps.state, now: deps.now }, server, m.msg);
  throw new Error(`Unexpected ${m.kind} from the game page`);
}

async function fromExtension(
  deps: RouterDeps,
  m: ExtensionMessage,
): Promise<unknown> {
  if (m.kind !== "register-server")
    throw new Error(`Unexpected ${m.kind} from the extension`);
  const server = await registerServer(m.server, deps.scripting);
  await deps.state.addServer(server, deps.now());
  return { server };
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
  if (isPage(path, "/game")) return fromGame(deps, server, m);
  throw new Error(`Message from an unexpected page: ${path}`);
}
