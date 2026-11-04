// Extension background: the source of truth for servers, setup data,
// snapshots and the command queue. Checks every sender before acting.
import type { Command } from "./commands.ts";
import type { ExtensionMessage } from "./messages.ts";
import { handleRelay } from "./relay.ts";
import {
  contentScriptsFor,
  normalizeServerUrl,
  pathWithinServer,
  permissionOrigin,
  type ServerId,
  serverIdOfPage,
} from "./servers.ts";
import {
  getCommands,
  getServers,
  putCommands,
  putServer,
  putSetupData,
} from "./store.ts";

type Sender = chrome.runtime.MessageSender;

const isExtensionPage = (sender: Sender): boolean =>
  sender.id === chrome.runtime.id &&
  (sender.url ?? "").startsWith(chrome.runtime.getURL(""));

async function registerServer(input: string): Promise<{ server: ServerId }> {
  const server = normalizeServerUrl(input);
  const granted = await chrome.permissions.contains({
    origins: [permissionOrigin(server)],
  });
  if (!granted) throw new Error(`No host permission for ${server}`);
  const scripts = contentScriptsFor(server);
  const existing = await chrome.scripting.getRegisteredContentScripts({
    ids: scripts.map((s) => s.id),
  });
  if (existing.length > 0)
    await chrome.scripting.unregisterContentScripts({
      ids: existing.map((s) => s.id),
    });
  await chrome.scripting.registerContentScripts(
    scripts.map((s) => ({
      ...s,
      matches: [...s.matches],
      js: [...s.js],
      persistAcrossSessions: true,
    })),
  );
  const servers = await getServers();
  await putServer(servers[server] ?? { id: server });
  return { server };
}

/** The registered server of a content script's page, and the page path. */
async function pageServer(
  sender: Sender,
): Promise<{ server: ServerId; path: string } | undefined> {
  if (sender.id !== chrome.runtime.id || !sender.tab || !sender.url) return;
  const servers = Object.keys(await getServers());
  const server = serverIdOfPage(sender.url, servers);
  if (!server) return;
  return { server, path: pathWithinServer(sender.url, server) };
}

async function isAdminVerified(server: ServerId): Promise<boolean> {
  return (await getServers())[server]?.adminVerifiedAt !== undefined;
}

async function fromSetup(
  message: ExtensionMessage,
  server: ServerId,
): Promise<unknown> {
  if (message.kind === "setup-seen") {
    await putSetupData(server, message.data);
    // PR-1: only an authenticated Setup page (Foundry says isAdmin) verifies.
    if (message.data.isAdmin)
      await putServer({
        id: server,
        adminVerifiedAt: new Date().toISOString(),
      });
    return { adminVerified: await isAdminVerified(server) };
  }
  if (message.kind === "queue-command") {
    if (!(await isAdminVerified(server))) throw new Error("Not admin-verified");
    const command: Command = {
      id: crypto.randomUUID(),
      worldId: message.worldId,
      type: "preset.apply",
      payload: { mode: message.mode, modules: message.modules },
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    await putCommands(server, [...(await getCommands(server)), command]);
    return { queued: command.id };
  }
  throw new Error(`Unexpected ${message.kind} from Setup`);
}

async function fromGame(
  message: ExtensionMessage,
  server: ServerId,
): Promise<unknown> {
  // PR-7 and 8.6: the bridge stays off unless this browser verified the admin.
  const enabled = await isAdminVerified(server);
  if (message.kind === "bridge-init")
    return { enabled, extensionVersion: chrome.runtime.getManifest().version };
  if (message.kind === "relay" && enabled)
    return handleRelay(server, message.msg);
  throw new Error(`Unexpected ${message.kind} from the game page`);
}

async function handle(
  message: ExtensionMessage,
  sender: Sender,
): Promise<unknown> {
  if (message.kind === "register-server") {
    if (!isExtensionPage(sender)) throw new Error("Not from the extension");
    return registerServer(message.server);
  }
  const page = await pageServer(sender);
  if (!page) throw new Error("Message from an unregistered page");
  if (page.path.startsWith("/setup")) return fromSetup(message, page.server);
  if (page.path.startsWith("/game")) return fromGame(message, page.server);
  throw new Error(`Message from an unexpected page: ${page.path}`);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handle(message as ExtensionMessage, sender).then(
    (result) => {
      sendResponse({ ok: true, result });
    },
    (error: unknown) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  );
  return true;
});
