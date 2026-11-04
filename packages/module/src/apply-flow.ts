// Applies queued commands: resolve against the live state, confirm with the
// GM, acknowledge, write core's module configuration and reload once.
import {
  type ApplyMode,
  type ApplyResult,
  computeTarget,
} from "@module-library/shared/apply";
import type { Channel } from "./channel.ts";
import { type FoundryGame, foundryGlobals, MODULE_ID } from "./foundry.ts";

export interface WorldCommand {
  readonly id: string;
  readonly payload: {
    readonly mode: ApplyMode;
    readonly modules: readonly string[];
  };
}

const escapeHtml = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] ?? c,
  );

const activeIds = (game: FoundryGame): string[] =>
  [...game.modules.values()].filter((m) => m.active).map((m) => m.id);

/** Folds the commands in queue order into one target (P-6). */
function resolve(game: FoundryGame, commands: readonly WorldCommand[]) {
  const installed = [...game.modules.values()].map((m) => ({
    id: m.id,
    requires: [...m.relationships.requires]
      .filter((r) => r.type === "module")
      .map((r) => r.id),
  }));
  const start = activeIds(game);
  let current: readonly string[] = start;
  const results: ApplyResult[] = [];
  for (const c of commands) {
    const result = computeTarget({
      mode: c.payload.mode,
      current,
      requested: c.payload.modules,
      installed,
      companionId: MODULE_ID,
    });
    results.push(result);
    current = result.target;
  }
  return { start, target: current, results };
}

function section(
  game: FoundryGame,
  key: string,
  ids: readonly string[],
): string {
  if (ids.length === 0) return "";
  const label = game.i18n.localize(`MODULE_LIBRARY.Apply.${key}`);
  const items = ids.map((id) => `<li>${escapeHtml(id)}</li>`).join("");
  return `<p><strong>${escapeHtml(label)}</strong></p><ul>${items}</ul>`;
}

function diffHtml(game: FoundryGame, plan: ReturnType<typeof resolve>): string {
  const enable = plan.target.filter((id) => !plan.start.includes(id));
  const disable = plan.start.filter((id) => !plan.target.includes(id));
  const r = plan.results;
  return [
    `<p>${escapeHtml(game.i18n.localize("MODULE_LIBRARY.Apply.Intro"))}</p>`,
    section(game, "Enable", enable),
    section(game, "Disable", disable),
    section(
      game,
      "Dependencies",
      r.flatMap((x) => x.dependencyAdditions),
    ),
    section(
      game,
      "Missing",
      r.flatMap((x) => x.missing),
    ),
    section(
      game,
      "Blocked",
      r.flatMap((x) => x.blocked.map((b) => b.id)),
    ),
  ].join("");
}

export async function applyCommands(
  channel: Channel,
  commands: readonly WorldCommand[],
): Promise<void> {
  const { game, foundry } = foundryGlobals();
  const plan = resolve(game, commands);
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("MODULE_LIBRARY.Apply.Title") },
    content: diffHtml(game, plan),
    rejectClose: false,
    modal: true,
  });
  const ack = (status: string, extra: object = {}) =>
    Promise.all(
      commands.map((c) =>
        channel.request("COMMAND_ACK", { id: c.id, status, ...extra }),
      ),
    );
  if (confirmed !== true) {
    await ack("declined");
    return;
  }
  await ack("applying", { target: plan.target });
  const config = Object.fromEntries(
    [...game.modules.keys()].map((id) => [id, plan.target.includes(id)]),
  );
  await game.settings.set("core", "moduleConfiguration", config);
  foundry.utils.debouncedReload();
}
