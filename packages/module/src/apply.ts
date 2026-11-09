// Applies queued commands (PRD 8.4, 8.5): resolve against the live world,
// ask the GM, record the outcome in the world's flags, write core's module
// configuration, reload once. A launch reviewed on Setup was the GM's
// confirmation: it applies without asking again, unless the live result
// differs from what was reviewed. Nothing is changed unless the record was
// saved first: an unrecorded change would be applied again next time.
import type { Plan } from "@module-library/shared/resolver";
import type { WorldCommand } from "@module-library/shared/world";
import { activeKey, type Result } from "@module-library/shared/world-flags";
import { askGm, type Choice } from "./dialog.ts";
import type { DialogV2, FoundryGame } from "./foundry.ts";
import { moduleConfiguration, planFor } from "./world-state.ts";

/** Saves these results for the commands in the world; false when it couldn't. */
export type Recorder = (results: readonly Result[]) => Promise<boolean>;

export interface ApplyDeps {
  readonly game: FoundryGame;
  readonly dialog: DialogV2;
  readonly record: Recorder;
  readonly reload: () => void;
  readonly warn: (message: string) => void;
  readonly info: (message: string) => void;
}

export type Outcome =
  "applied" | "unchanged" | "later" | "discarded" | "blocked" | "unsaved";

const K = "STAGEHAND.Apply";

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const each = (
  commands: readonly WorldCommand[],
  result: Omit<Result, "id">,
): Result[] => commands.map((c) => ({ id: c.id, ...result }));

/** Records, or says it couldn't: then nothing may change. */
async function recorded(
  deps: ApplyDeps,
  results: readonly Result[],
): Promise<boolean> {
  if (await deps.record(results)) return true;
  deps.warn(deps.game.i18n.localize(`${K}.Unsaved`));
  return false;
}

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
    await deps.record(
      each(commands, { status: "failed", error: message(error).slice(0, 500) }),
    );
    throw error;
  }
}

async function write(
  deps: ApplyDeps,
  commands: readonly WorldCommand[],
  plan: Plan,
): Promise<Outcome> {
  if (!plan.changed) {
    // Nothing to reload: done at once.
    const saved = await recorded(deps, each(commands, { status: "applied" }));
    return saved ? "unchanged" : "unsaved";
  }
  const applying = each(commands, {
    status: "applying",
    targetKey: activeKey(plan.target),
  });
  if (!(await recorded(deps, applying))) return "unsaved";
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
    const saved = await recorded(deps, each(commands, { status: "declined" }));
    return saved ? "discarded" : "unsaved";
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
