// Apply Preset (design/in-world-library): the library's presets, each
// marked Active when all of its installed modules are on here, and how to
// apply them (Add, Replace, Remove). Mark Changes marks them on the cards;
// nothing is saved until the review. Modules the server lacks are named.
import type { ApplyMode } from "@stagehand/shared/resolver";
import type { ModulesData } from "@stagehand/ui/model/data.ts";
import { presetState } from "@stagehand/ui/model/presets.ts";
import { escapeHtml } from "../dialog.ts";
import type { DialogButton, DialogV2, FoundryGame } from "../foundry.ts";
import { idsOn } from "./changes.ts";
import { titleOf } from "./words.ts";

export interface PickDeps {
  readonly dialog: DialogV2;
  readonly game: FoundryGame;
  readonly warn: (message: string) => void;
  readonly onPick: (mode: ApplyMode, presetIds: readonly string[]) => void;
}

const K = "STAGEHAND.Manage";
const MODES: readonly { readonly id: ApplyMode; readonly key: string }[] = [
  { id: "add", key: "ModeAdd" },
  { id: "replace", key: "ModeReplace" },
  { id: "remove", key: "ModeRemove" },
];

type Preset = ModulesData["library"]["presets"][number];

function presetRow(game: FoundryGame, data: ModulesData, p: Preset): string {
  const say = (key: string, values: Record<string, number> = {}): string =>
    escapeHtml(game.i18n.format(`${K}.${key}`, values));
  const installed = new Set(data.setup?.modules.map((m) => m.id));
  const on = new Set(idsOn(data, data.setup?.worlds[0]?.id ?? ""));
  const st = presetState(p, installed, on);
  const count = st.active
    ? say("AllOn", { n: st.installed })
    : say("SomeOn", { n: st.installed, on: st.on });
  const missing = st.missing
    ? ` · ${say("NotInstalled", { n: st.missing })}`
    : "";
  const badge = st.active
    ? ` <span class="sts-badge ok" title="${say("ActiveHint")}"><i class="fa-solid fa-check" inert></i>${say("Active")}</span>`
    : "";
  const names = escapeHtml(p.modules.map((id) => titleOf(data, id)).join(", "));
  return `<label class="stagehand-preset${st.active ? " active" : ""}">
    <input type="checkbox" name="preset" value="${escapeHtml(p.id)}">
    <span class="name">${escapeHtml(p.name)}${badge}</span>
    <span class="meta" title="${names}">${count}${missing}</span>
    <span class="about">${escapeHtml(p.description)}</span></label>`;
}

function modeRow(game: FoundryGame, m: (typeof MODES)[number]): string {
  const say = (key: string): string =>
    escapeHtml(game.i18n.localize(`${K}.${key}`));
  return `<label class="stagehand-mode">
    <input type="radio" name="mode" value="${m.id}"${m.id === "add" ? " checked" : ""}>
    <span class="name">${say(m.key)}</span><span class="about">${say(`${m.key}Hint`)}</span></label>`;
}

function pickHtml(game: FoundryGame, data: ModulesData): string {
  const say = (key: string): string =>
    escapeHtml(game.i18n.localize(`${K}.${key}`));
  const presets = data.library.presets;
  const list = presets.length
    ? presets.map((p) => presetRow(game, data, p)).join("")
    : `<p class="hint">${say("NoPresets")}</p>`;
  return `<p class="hint">${say("PickHint")}</p>
    <fieldset><legend>${say("PickPresets")}</legend><div class="stagehand-presets">${list}</div></fieldset>
    <fieldset><legend>${say("PickHow")}</legend><div class="stagehand-modes">${MODES.map((m) => modeRow(game, m)).join("")}</div></fieldset>`;
}

interface Picked {
  readonly mode: ApplyMode;
  readonly presetIds: readonly string[];
}

function picked(button: HTMLButtonElement): Picked {
  const form = button.form;
  const checked = (sel: string): HTMLInputElement[] =>
    form ? [...form.querySelectorAll<HTMLInputElement>(sel)] : [];
  const mode = checked('input[name="mode"]:checked')[0]?.value;
  return {
    mode: MODES.find((m) => m.id === mode)?.id ?? "add",
    presetIds: checked('input[name="preset"]:checked').map((i) => i.value),
  };
}

/** Mark Changes is on once a preset is ticked. */
function watchTicks(element: HTMLElement): void {
  const mark = element.querySelector<HTMLButtonElement>(
    'button[data-action="mark"]',
  );
  element.addEventListener("change", () => {
    if (mark)
      mark.disabled = !element.querySelector('input[name="preset"]:checked');
  });
}

function buttons(game: FoundryGame): DialogButton[] {
  return [
    {
      action: "mark",
      label: game.i18n.localize(`${K}.Mark`),
      icon: "fa-solid fa-check",
      default: true,
      disabled: true,
      callback: (_event, button): Picked => picked(button),
    },
    {
      action: "cancel",
      label: game.i18n.localize(`${K}.Cancel`),
      icon: "fa-solid fa-xmark",
    },
  ];
}

const isPicked = (v: unknown): v is Picked =>
  typeof v === "object" && v !== null && "presetIds" in v;

function warnMissing(
  deps: PickDeps,
  data: ModulesData,
  ids: readonly string[],
): void {
  const installed = new Set(data.setup?.modules.map((m) => m.id));
  const missing = [
    ...new Set(
      data.library.presets
        .filter((p) => ids.includes(p.id))
        .flatMap((p) => p.modules)
        .filter((id) => !installed.has(id)),
    ),
  ];
  if (missing.length)
    deps.warn(
      deps.game.i18n.format(`${K}.Skipped`, {
        // Ids come from the library file: shown as text in Foundry's notice.
        modules: missing.map(escapeHtml).join(", "),
      }),
    );
}

export async function pickPreset(
  deps: PickDeps,
  data: ModulesData,
): Promise<void> {
  const result = await deps.dialog.wait({
    window: { title: deps.game.i18n.localize(`${K}.PickTitle`) },
    content: pickHtml(deps.game, data),
    buttons: buttons(deps.game),
    rejectClose: false,
    modal: true,
    classes: ["stagehand-dialog"],
    render: (_event, dialog) => {
      watchTicks(dialog.element);
    },
  });
  if (!isPicked(result) || result.presetIds.length === 0) return;
  deps.onPick(result.mode, result.presetIds);
  warnMissing(deps, data, result.presetIds);
}
