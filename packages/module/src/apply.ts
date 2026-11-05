// Applies queued commands (PRD 8.4, 8.5): resolve against the live world,
// ask the GM, acknowledge, write core's module configuration, reload once.
import type { Plan } from "@module-library/shared/resolver";
import type { WorldCommand } from "@module-library/shared/world";
import type { Channel } from "./channel.ts";
import { askGm, type Choice } from "./dialog.ts";
import type { DialogV2, FoundryGame } from "./foundry.ts";
import { moduleConfiguration, planFor, takeSnapshot } from "./world-state.ts";

export interface ApplyDeps {
  readonly game: FoundryGame;
  readonly dialog: DialogV2;
  readonly channel: Channel;
  readonly reload: () => void;
  readonly warn: (message: string) => void;
  readonly now: () => Date;
}

export type Outcome =
  "applied" | "unchanged" | "later" | "discarded" | "blocked";

const K = "MODULE_LIBRARY.Apply";

const ackAll = (
  deps: ApplyDeps,
  commands: readonly WorldCommand[],
  payload: object,
) =>
  Promise.all(
    commands.map((c) =>
      deps.channel.request("COMMAND_ACK", { id: c.id, ...payload }),
    ),
  );

/** Conflicts need explicit consent; removals that break others need a choice. */
function refusal(
  plan: Plan,
  choice: Extract<Choice, { kind: "apply" }>,
): string | undefined {
  if (plan.conflicts.length > 0 && !choice.acceptConflicts)
    return `${K}.NeedConflictConsent`;
  if (plan.dependents.length > 0 && !choice.removeDependents)
    return `${K}.NeedDependentsChoice`;
  return undefined;
}

async function write(
  deps: ApplyDeps,
  commands: readonly WorldCommand[],
  plan: Plan,
): Promise<Outcome> {
  await ackAll(deps, commands, { status: "applying", target: plan.target });
  if (!plan.changed) {
    // Nothing to reload: a fresh snapshot closes the commands at once.
    await deps.channel.request(
      "SNAPSHOT_PUSH",
      takeSnapshot(deps.game, deps.now()),
    );
    return "unchanged";
  }
  await deps.game.settings.set(
    "core",
    "moduleConfiguration",
    moduleConfiguration(deps.game, plan.target),
  );
  deps.reload();
  return "applied";
}

export async function applyCommands(
  deps: ApplyDeps,
  commands: readonly WorldCommand[],
): Promise<Outcome> {
  if (commands.length === 0) return "unchanged";
  const plan = planFor(deps.game, commands, false);
  const choice = await askGm(deps.dialog, deps.game, plan, commands);
  if (choice.kind === "later") return "later";
  if (choice.kind === "discard") {
    await ackAll(deps, commands, { status: "declined" });
    return "discarded";
  }
  const reason = refusal(plan, choice);
  if (reason) {
    deps.warn(deps.game.i18n.localize(reason));
    return "blocked";
  }
  const final = choice.removeDependents
    ? planFor(deps.game, commands, true)
    : plan;
  return write(deps, commands, final);
}
