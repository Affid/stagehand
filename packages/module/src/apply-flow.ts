// Applies queued commands: resolve against the live state, confirm with the
// GM, acknowledge, write core's module configuration and reload once.
// Interim (M1 phase 1): the full dialog comes with the module phase.
import { toPackageInfo } from "@module-library/shared/package";
import {
  type ApplyMode,
  type Plan,
  resolvePlan,
} from "@module-library/shared/resolver";
import { parseCoreVersion } from "@module-library/shared/version";
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

function resolve(game: FoundryGame, commands: readonly WorldCommand[]): Plan {
  return resolvePlan({
    commands: commands.map((c) => c.payload),
    current: [...game.modules.values()]
      .filter((m) => m.active)
      .map((m) => m.id),
    installed: [...game.modules.values()].map(toPackageInfo),
    core: parseCoreVersion(`${game.release.generation}.${game.release.build}`),
    system: { id: game.system.id, version: game.system.version },
    companionId: MODULE_ID,
  });
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

function diffHtml(game: FoundryGame, plan: Plan): string {
  const fromDeps = new Set(plan.dependencyAdditions);
  return [
    `<p>${escapeHtml(game.i18n.localize("MODULE_LIBRARY.Apply.Intro"))}</p>`,
    section(
      game,
      "Enable",
      plan.enable.filter((id) => !fromDeps.has(id)),
    ),
    section(game, "Dependencies", plan.dependencyAdditions),
    section(game, "Disable", plan.disable),
    section(game, "Missing", plan.missing),
    section(
      game,
      "Blocked",
      plan.blocked.map((b) => b.id),
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
