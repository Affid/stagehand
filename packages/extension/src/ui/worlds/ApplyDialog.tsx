// Apply presets to a world: choose presets and mode (P-3), preview the diff
// (P-4) and queue it for the next launch (P-5).
import type { Plan } from "@module-library/shared/resolver";
import type { ApplyMode } from "@module-library/shared/resolver";
import { useMemo, useState } from "preact/hooks";
import { Modal } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { previewApply } from "../model/preview.ts";
import type { Translate } from "../i18n.ts";

const MODES: readonly ApplyMode[] = ["add", "replace", "remove"];

function List(props: {
  readonly title: string;
  readonly items: readonly string[];
  readonly kind?: string;
}) {
  if (props.items.length === 0) return null;
  return (
    <div class={`ml-diff-section ${props.kind ?? ""}`}>
      <h4>{props.title}</h4>
      <ul>
        {props.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** The plan's sections in display order: [i18n key, items, style]. */
function diffSections(plan: Plan, t: Translate): [string, string[], string][] {
  const deps = new Set(plan.dependencyAdditions);
  return [
    ["apply.enable", plan.enable.filter((id) => !deps.has(id)), "ml-add"],
    ["apply.dependencies", [...plan.dependencyAdditions], "ml-add"],
    ["apply.disable", [...plan.disable], "ml-remove"],
    ["apply.missing", [...plan.missing], "ml-warn"],
    [
      "apply.blocked",
      plan.blocked.map((b) => `${b.id} (${b.detail.join(", ")})`),
      "ml-warn",
    ],
    [
      "apply.incompatible",
      plan.incompatible.map(
        (i) => `${i.id} (${t(`apply.incompatible.${i.reason}`)})`,
      ),
      "ml-warn",
    ],
    [
      "apply.conflicts",
      plan.conflicts.map((c) => t("apply.conflict", { a: c.id, b: c.with })),
      "ml-warn",
    ],
    [
      "apply.dependents",
      plan.dependents.map((d) =>
        t("apply.dependent", { id: d.id, by: d.requiredBy.join(", ") }),
      ),
      "ml-warn",
    ],
  ];
}

function Diff(props: { readonly plan: Plan; readonly t: Translate }) {
  const { plan, t } = props;
  const problems =
    plan.missing.length + plan.blocked.length + plan.incompatible.length;
  if (!plan.changed && problems === 0) return <p>{t("apply.noChange")}</p>;
  return (
    <div class="ml-diff" data-testid="apply-diff">
      {diffSections(plan, t).map(([key, items, kind]) => (
        <List key={key} title={t(key)} items={items} kind={kind} />
      ))}
    </div>
  );
}

function PresetChoice(props: {
  readonly chosen: readonly string[];
  readonly onToggle: (id: string) => void;
}) {
  const { state, t } = useUi();
  const presets = state.data.library.presets;
  return (
    <fieldset class="ml-field">
      <legend>{t("apply.presets")}</legend>
      {presets.length === 0 ? <p>{t("apply.noPresets")}</p> : null}
      {presets.map((p) => (
        <label key={p.id} class="ml-check">
          <input
            type="checkbox"
            checked={props.chosen.includes(p.id)}
            onChange={() => props.onToggle(p.id)}
          />
          {p.name} <span class="ml-count">{p.modules.length}</span>
        </label>
      ))}
    </fieldset>
  );
}

function ModeChoice(props: {
  readonly mode: ApplyMode;
  readonly onMode: (mode: ApplyMode) => void;
  readonly removeDependents: boolean;
  readonly onRemoveDependents: (on: boolean) => void;
}) {
  const { t } = useUi();
  return (
    <fieldset class="ml-field">
      <legend>{t("apply.mode")}</legend>
      {MODES.map((m) => (
        <label key={m} class="ml-check">
          <input
            type="radio"
            name="ml-mode"
            value={m}
            checked={props.mode === m}
            onChange={() => props.onMode(m)}
          />
          {t(`apply.mode.${m}`)}
        </label>
      ))}
      {props.mode !== "add" ? (
        <label class="ml-check">
          <input
            type="checkbox"
            checked={props.removeDependents}
            onChange={(e) => props.onRemoveDependents(e.currentTarget.checked)}
          />
          {t("apply.removeDependents")}
        </label>
      ) : null}
    </fieldset>
  );
}

function Preview(props: { readonly preview: ReturnType<typeof previewApply> }) {
  const { t } = useUi();
  const { plan, warnings } = props.preview;
  if (!plan) return null;
  return (
    <section aria-label={t("apply.preview")}>
      <h3>{t("apply.preview")}</h3>
      {warnings.includes("no-snapshot") ? (
        <p class="ml-warn-text">{t("apply.noSnapshot")}</p>
      ) : null}
      <Diff plan={plan} t={t} />
    </section>
  );
}

/** The dialog's choices and the preview they produce. */
function useApplyForm(worldId: string) {
  const { state } = useUi();
  const [presetIds, setPresetIds] = useState<readonly string[]>([]);
  const [mode, setMode] = useState<ApplyMode>("add");
  const [removeDependents, setRemoveDependents] = useState(false);
  const preview = useMemo(
    () =>
      previewApply(state.data, { worldId, presetIds, mode, removeDependents }),
    [state.data, worldId, presetIds, mode, removeDependents],
  );
  const toggle = (id: string): void => {
    setPresetIds(
      presetIds.includes(id)
        ? presetIds.filter((p) => p !== id)
        : [...presetIds, id],
    );
  };
  return {
    presetIds,
    toggle,
    mode,
    setMode,
    removeDependents,
    setRemoveDependents,
    preview,
  };
}

export function ApplyDialog(props: { readonly worldId: string }) {
  const { state, store, actions, t, canChange } = useUi();
  const { worldId } = props;
  const form = useApplyForm(worldId);
  const world = state.data.setup?.worlds.find((w) => w.id === worldId);
  const queue = async (): Promise<void> => {
    if (await actions.queueApply(worldId, form.mode, form.presetIds))
      store.set({
        applyWorld: null,
        notice: { kind: "info", text: t("apply.queued") },
      });
  };
  const footer = (
    <button
      type="button"
      class="ml-primary"
      disabled={!canChange || form.presetIds.length === 0}
      onClick={() => void queue()}
    >
      {t("apply.queue")}
    </button>
  );
  return (
    <Modal
      title={t("apply.title", { world: world?.title ?? worldId })}
      onClose={() => store.set({ applyWorld: null })}
      footer={footer}
    >
      <PresetChoice chosen={form.presetIds} onToggle={form.toggle} />
      <ModeChoice
        mode={form.mode}
        onMode={form.setMode}
        removeDependents={form.removeDependents}
        onRemoveDependents={form.setRemoveDependents}
      />
      {form.presetIds.length > 0 ? <Preview preview={form.preview} /> : null}
    </Modal>
  );
}
