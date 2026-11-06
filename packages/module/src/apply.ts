// Applies queued commands (PRD 8.4, 8.5): resolve against the live world,
// ask the GM, acknowledge, write core's module configuration, reload once.
// A launch reviewed on Setup was the GM's confirmation: it applies without
// asking again, unless the live result differs from what was reviewed.
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
  readonly info: (message: string) => void;
  readonly now: () => Date;
}

export type Outcome =
  "applied" | "unchanged" | "later" | "discarded" | "blocked" | "cancelled";

const K = "MODULE_LIBRARY.Apply";

/** Acknowledges every command; true only if the extension accepted all. */
async function ackAll(
  deps: ApplyDeps,
  commands: readonly WorldCommand[],
  payload: object,
): Promise<boolean> {
  const replies = await Promise.all(
    commands.map((c) =>
      deps.channel.request("COMMAND_ACK", {
        id: c.id,
        worldId: deps.game.world.id,
        ...payload,
      }),
    ),
  );
  return replies.every(
    (r) =>
      r.type === "OK" &&
      (r.payload as { accepted?: unknown } | null)?.accepted === true,
  );
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

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

async function writeConfiguration(
  deps: ApplyDeps,
  commands: readonly WorldCommand[],
  plan: Plan,
): Promise<void> {
  try {
    await deps.game.settings.set(
      "core",
      "moduleConfiguration",
      moduleConfiguration(deps.game, plan.target),
    );
  } catch (error: unknown) {
    await ackAll(deps, commands, { status: "failed", error: message(error) });
    throw error;
  }
}

async function write(
  deps: ApplyDeps,
  commands: readonly WorldCommand[],
  plan: Plan,
): Promise<Outcome> {
  const accepted = await ackAll(deps, commands, {
    status: "applying",
    target: plan.target,
  });
  if (!accepted) {
    // Cancelled on Setup while the dialog was open, or not recorded:
    // change nothing, and close whatever was marked applying.
    await ackAll(deps, commands, {
      status: "failed",
      error: "Not applied: a queued change was cancelled meanwhile.",
    });
    deps.warn(deps.game.i18n.localize(`${K}.Cancelled`));
    return "cancelled";
  }
  if (!plan.changed) {
    // Nothing to reload: a fresh snapshot closes the commands at once.
    await deps.channel.request(
      "SNAPSHOT_PUSH",
      takeSnapshot(deps.game, deps.now()),
    );
    return "unchanged";
  }
  await writeConfiguration(deps, commands, plan);
  deps.reload();
  return "applied";
}

/**
 * The live plan is what was reviewed on Setup, and needs no choice. The
 * dialog's only questions are conflicts, dependents, missing and blocked
 * modules: if the Plan grows another one, it must be checked here too.
 */
function asReviewed(plan: Plan, reviewed: readonly string[]): boolean {
  if (plan.conflicts.length > 0 || plan.dependents.length > 0) return false;
  if (plan.missing.length > 0 || plan.blocked.length > 0) return false;
  const want = new Set(reviewed);
  return (
    want.size === plan.target.length && plan.target.every((id) => want.has(id))
  );
}

export async function applyCommands(
  deps: ApplyDeps,
  commands: readonly WorldCommand[],
  reviewed?: readonly string[],
): Promise<Outcome> {
  if (commands.length === 0) return "unchanged";
  const plan = planFor(deps.game, commands, false);
  if (reviewed && asReviewed(plan, reviewed)) {
    const outcome = await write(deps, commands, plan);
    if (outcome === "applied")
      deps.info(deps.game.i18n.localize(`${K}.Reviewed`));
    return outcome;
  }
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
