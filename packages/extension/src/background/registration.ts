// Registers a server's content scripts once its host permission is granted
// (R-1, R-2: one origin at a time, never <all_urls>).
import {
  type ContentScript,
  contentScriptsFor,
  normalizeServerUrl,
  permissionOrigin,
  type ServerId,
} from "./servers.ts";

export interface ScriptingPlatform {
  hasPermission(origin: string): Promise<boolean>;
  registeredIds(ids: readonly string[]): Promise<string[]>;
  unregister(ids: readonly string[]): Promise<void>;
  register(scripts: readonly ContentScript[]): Promise<void>;
  /** Gives a host permission back. */
  removePermission(origin: string): Promise<void>;
}

export async function registerServer(
  input: string,
  platform: ScriptingPlatform,
): Promise<ServerId> {
  const server = normalizeServerUrl(input);
  if (!(await platform.hasPermission(permissionOrigin(server))))
    throw new Error(`No host permission for ${server}`);
  const scripts = contentScriptsFor(server);
  const existing = await platform.registeredIds(scripts.map((s) => s.id));
  if (existing.length > 0) await platform.unregister(existing);
  await platform.register(scripts);
  return server;
}

/**
 * Takes a server off this browser: its content scripts go, and its host
 * permission too unless another registered server shares the origin.
 */
export async function unregisterServer(
  server: ServerId,
  others: readonly ServerId[],
  platform: ScriptingPlatform,
): Promise<void> {
  const scripts = contentScriptsFor(server).map((s) => s.id);
  const existing = await platform.registeredIds(scripts);
  if (existing.length > 0) await platform.unregister(existing);
  const origin = permissionOrigin(server);
  if (!others.some((o) => permissionOrigin(o) === origin))
    await platform.removePermission(origin);
}
