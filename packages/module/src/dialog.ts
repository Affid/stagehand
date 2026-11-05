// The in-world confirmation (UX 11): a short diff with warnings and the
// buttons "Apply & reload", "Not now" and "Discard". Escapes every value.
import type { Plan } from "@module-library/shared/resolver";
import type { WorldCommand } from "@module-library/shared/world";
import type { DialogV2, FoundryGame } from "./foundry.ts";

export type Choice =
  | {
      readonly kind: "apply";
      readonly removeDependents: boolean;
      readonly acceptConflicts: boolean;
    }
  | { readonly kind: "later" }
  | { readonly kind: "discard" };

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

const K = "MODULE_LIBRARY.Apply";

function section(
  game: FoundryGame,
  key: string,
  items: readonly string[],
): string {
  if (items.length === 0) return "";
  const li = items.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
  return `<h4>${escapeHtml(game.i18n.localize(`${K}.${key}`))}</h4><ul>${li}</ul>`;
}

function checkbox(name: string, label: string): string {
  return `<label class="checkbox"><input type="checkbox" name="${name}"> ${escapeHtml(label)}</label>`;
}

export function diffHtml(
  game: FoundryGame,
  plan: Plan,
  commands: readonly WorldCommand[],
): string {
  const deps = new Set(plan.dependencyAdditions);
  const presets = commands.flatMap((c) =>
    c.presets.map((p) => `${p.name} (${c.mode})`),
  );
  const parts = [
    `<p>${escapeHtml(game.i18n.localize(`${K}.Intro`))}</p>`,
    section(game, "Presets", presets),
    plan.changed
      ? ""
      : `<p>${escapeHtml(game.i18n.localize(`${K}.NoChange`))}</p>`,
    section(
      game,
      "Enable",
      plan.enable.filter((id) => !deps.has(id)),
    ),
    section(game, "Dependencies", plan.dependencyAdditions),
    section(game, "Disable", plan.disable),
    section(game, "Missing", plan.missing),
    section(
      game,
      "Blocked",
      plan.blocked.map((b) => `${b.id}: ${b.detail.join(", ")}`),
    ),
    section(
      game,
      "Incompatible",
      plan.incompatible.map((i) => `${i.id} (${i.reason})`),
    ),
    section(
      game,
      "Conflicts",
      plan.conflicts.map((c) => `${c.id} / ${c.with}`),
    ),
    section(
      game,
      "Dependents",
      plan.dependents.map((d) => `${d.id}: ${d.requiredBy.join(", ")}`),
    ),
  ];
  if (plan.conflicts.length > 0)
    parts.push(
      checkbox("acceptConflicts", game.i18n.localize(`${K}.AcceptConflicts`)),
    );
  if (plan.dependents.length > 0)
    parts.push(
      checkbox("removeDependents", game.i18n.localize(`${K}.RemoveDependents`)),
    );
  return `<div class="module-library-diff">${parts.join("")}</div>`;
}

const checked = (button: HTMLButtonElement, name: string): boolean =>
  (button.form?.elements.namedItem(name) as HTMLInputElement | null)
    ?.checked === true;

export async function askGm(
  dialog: DialogV2,
  game: FoundryGame,
  plan: Plan,
  commands: readonly WorldCommand[],
): Promise<Choice> {
  const result = await dialog.wait({
    window: { title: game.i18n.localize(`${K}.Title`) },
    content: diffHtml(game, plan, commands),
    rejectClose: false,
    modal: true,
    buttons: [
      {
        action: "apply",
        label: game.i18n.localize(`${K}.ApplyReload`),
        icon: "fa-solid fa-check",
        default: true,
        callback: (_event, button): Choice => ({
          kind: "apply",
          removeDependents: checked(button, "removeDependents"),
          acceptConflicts: checked(button, "acceptConflicts"),
        }),
      },
      {
        action: "later",
        label: game.i18n.localize(`${K}.NotNow`),
        icon: "fa-solid fa-clock",
      },
      {
        action: "discard",
        label: game.i18n.localize(`${K}.Discard`),
        icon: "fa-solid fa-trash",
      },
    ],
  });
  if (typeof result === "object" && result !== null && "kind" in result)
    return result as Choice;
  return result === "discard" ? { kind: "discard" } : { kind: "later" };
}
