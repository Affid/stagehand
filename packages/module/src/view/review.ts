// The review before saving (design/in-world-library): what turns on, what
// comes along as a dependency, what turns off and what still needs it,
// then Save & Reload or Back. Saving writes core's module configuration
// and reloads everyone, as Foundry's own save does once confirmed.
import type { Plan } from "@stagehand/shared/resolver";
import type { ModulesData } from "@stagehand/ui/model/data.ts";
import { previewApply } from "@stagehand/ui/model/preview.ts";
import { checkbox, escapeHtml } from "../dialog.ts";
import type { DialogV2, DialogButton, FoundryGame } from "../foundry.ts";
import { presetLines, titleOf } from "./words.ts";

export interface ReviewDeps {
  readonly dialog: DialogV2;
  readonly game: FoundryGame;
  readonly warn: (message: string) => void;
  /** Writes these modules as the world's and reloads. */
  readonly save: (target: readonly string[]) => Promise<void>;
}

export type ReviewOutcome = "saved" | "back" | "blocked";

const K = "STAGEHAND.Manage";

interface Choice {
  readonly removeDependents: boolean;
  readonly acceptConflicts: boolean;
}

function section(title: string, items: readonly string[]): string {
  if (items.length === 0) return "";
  const li = items.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
  return `<h4>${escapeHtml(title)} · ${String(items.length)}</h4><ul>${li}</ul>`;
}

function sections(game: FoundryGame, data: ModulesData, plan: Plan): string[] {
  const say = (key: string): string => game.i18n.localize(`${K}.${key}`);
  const name = (id: string): string => titleOf(data, id);
  const deps = new Set(plan.dependencyAdditions);
  const neededBy = (d: Plan["dependents"][number]): string =>
    game.i18n.format(`${K}.NeededBy`, {
      module: name(d.id),
      users: d.requiredBy.map(name).join(", "),
    });
  return [
    section(say("Presets"), presetLines(game, data)),
    section(
      say("TurnsOn"),
      plan.enable.filter((id) => !deps.has(id)).map(name),
    ),
    section(say("Dependencies"), plan.dependencyAdditions.map(name)),
    section(say("TurnsOff"), plan.disable.map(name)),
    section(say("Missing"), plan.missing.map(name)),
    section(
      say("Blocked"),
      plan.blocked.map((b) => name(b.id)),
    ),
    section(
      say("Incompatible"),
      plan.incompatible.map((i) => name(i.id)),
    ),
    section(
      say("Conflicts"),
      plan.conflicts.map((c) => `${name(c.id)} / ${name(c.with)}`),
    ),
    section(say("Dependents"), plan.dependents.map(neededBy)),
  ];
}

function reviewHtml(game: FoundryGame, data: ModulesData, plan?: Plan): string {
  const say = (key: string): string => game.i18n.localize(`${K}.${key}`);
  if (!plan?.changed)
    return `<div class="stagehand-diff"><p>${escapeHtml(say("NoChange"))}</p></div>`;
  const parts = [
    `<p>${escapeHtml(say("Intro"))}</p>`,
    ...sections(game, data, plan),
  ];
  if (plan.conflicts.length > 0)
    parts.push(checkbox("acceptConflicts", say("AcceptConflicts")));
  if (plan.dependents.length > 0)
    parts.push(checkbox("removeDependents", say("RemoveDependents")));
  return `<div class="stagehand-diff">${parts.join("")}</div>`;
}

const ticked = (button: HTMLButtonElement, name: string): boolean =>
  (button.form?.elements.namedItem(name) as HTMLInputElement | null)
    ?.checked === true;

function buttons(game: FoundryGame, changed: boolean): DialogButton[] {
  const back: DialogButton = {
    action: "back",
    label: game.i18n.localize(`${K}.Back`),
    icon: "fa-solid fa-arrow-left",
  };
  if (!changed) return [back];
  const save: DialogButton = {
    action: "save",
    label: game.i18n.localize(`${K}.SaveReload`),
    icon: "fa-solid fa-check",
    default: true,
    callback: (_event, button): Choice => ({
      removeDependents: ticked(button, "removeDependents"),
      acceptConflicts: ticked(button, "acceptConflicts"),
    }),
  };
  return [save, back];
}

const refusal = (plan: Plan, choice: Choice): string | undefined => {
  if (plan.conflicts.length > 0 && !choice.acceptConflicts)
    return `${K}.NeedConflictConsent`;
  if (plan.dependents.length > 0 && !choice.removeDependents)
    return `${K}.NeedDependentsChoice`;
  return undefined;
};

const isChoice = (v: unknown): v is Choice =>
  typeof v === "object" && v !== null && "removeDependents" in v;

export async function reviewChanges(
  deps: ReviewDeps,
  data: ModulesData,
): Promise<ReviewOutcome> {
  const worldId = data.setup?.worlds[0]?.id ?? "";
  const request = { worldId, removeDependents: false };
  const plan = previewApply(data, request).plan;
  const result = await deps.dialog.wait({
    window: { title: deps.game.i18n.localize(`${K}.ReviewTitle`) },
    content: reviewHtml(deps.game, data, plan),
    buttons: buttons(deps.game, plan?.changed === true),
    rejectClose: false,
    modal: true,
    classes: ["stagehand-dialog"],
  });
  if (!plan || !isChoice(result)) return "back";
  const reason = refusal(plan, result);
  if (reason) {
    deps.warn(deps.game.i18n.localize(reason));
    return "blocked";
  }
  const final = result.removeDependents
    ? previewApply(data, { ...request, removeDependents: true }).plan
    : plan;
  await deps.save(final?.target ?? plan.target);
  return "saved";
}
