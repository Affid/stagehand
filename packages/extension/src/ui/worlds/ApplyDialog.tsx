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

function Diff(props: { readonly plan: Plan; readonly t: Translate }) {
  const { plan, t } = props;
  const deps = new Set(plan.dependencyAdditions);
  if (
    !plan.changed &&
    plan.missing.length + plan.blocked.length + plan.incompatible.length === 0
  )
    return <p>{t("apply.noChange")}</p>;
  return (
    <div class="ml-diff" data-testid="apply-diff">
      <List
        title={t("apply.enable")}
        items={plan.enable.filter((id) => !deps.has(id))}
        kind="ml-add"
      />
      <List
        title={t("apply.dependencies")}
        items={plan.dependencyAdditions}
        kind="ml-add"
      />
      <List title={t("apply.disable")} items={plan.disable} kind="ml-remove" />
      <List title={t("apply.missing")} items={plan.missing} kind="ml-warn" />
      <List
        title={t("apply.blocked")}
        items={plan.blocked.map((b) => `${b.id} (${b.detail.join(", ")})`)}
        kind="ml-warn"
      />
      <List
        title={t("apply.incompatible")}
        items={plan.incompatible.map(
          (i) => `${i.id} (${t(`apply.incompatible.${i.reason}`)})`,
        )}
        kind="ml-warn"
      />
      <List
        title={t("apply.conflicts")}
        items={plan.conflicts.map((c) =>
          t("apply.conflict", { a: c.id, b: c.with }),
        )}
        kind="ml-warn"
      />
      <List
        title={t("apply.dependents")}
        items={plan.dependents.map((d) =>
          t("apply.dependent", { id: d.id, by: d.requiredBy.join(", ") }),
        )}
        kind="ml-warn"
      />
    </div>
  );
}

export function ApplyDialog(props: { readonly worldId: string }) {
  const { state, store, actions, t, canChange } = useUi();
  const [presetIds, setPresetIds] = useState<readonly string[]>([]);
  const [mode, setMode] = useState<ApplyMode>("add");
  const [removeDependents, setRemoveDependents] = useState(false);
  const world = state.data.setup?.worlds.find((w) => w.id === props.worldId);
  const preview = useMemo(
    () =>
      previewApply(state.data, {
        worldId: props.worldId,
        presetIds,
        mode,
        removeDependents,
      }),
    [state.data, props.worldId, presetIds, mode, removeDependents],
  );
  const close = (): void => {
    store.set({ applyWorld: null });
  };
  const queue = async (): Promise<void> => {
    if (await actions.queueApply(props.worldId, mode, presetIds)) {
      store.set({
        applyWorld: null,
        notice: { kind: "info", text: t("apply.queued") },
      });
    }
  };
  const toggle = (id: string): void => {
    setPresetIds(
      presetIds.includes(id)
        ? presetIds.filter((p) => p !== id)
        : [...presetIds, id],
    );
  };
  const presets = state.data.library.presets;
  const footer = (
    <button
      type="button"
      class="ml-primary"
      disabled={!canChange || presetIds.length === 0}
      onClick={() => void queue()}
    >
      {t("apply.queue")}
    </button>
  );
  return (
    <Modal
      title={t("apply.title", { world: world?.title ?? props.worldId })}
      onClose={close}
      footer={footer}
    >
      <fieldset class="ml-field">
        <legend>{t("apply.presets")}</legend>
        {presets.length === 0 ? <p>{t("apply.noPresets")}</p> : null}
        {presets.map((p) => (
          <label key={p.id} class="ml-check">
            <input
              type="checkbox"
              checked={presetIds.includes(p.id)}
              onChange={() => toggle(p.id)}
            />
            {p.name} <span class="ml-count">{p.modules.length}</span>
          </label>
        ))}
      </fieldset>
      <fieldset class="ml-field">
        <legend>{t("apply.mode")}</legend>
        {MODES.map((m) => (
          <label key={m} class="ml-check">
            <input
              type="radio"
              name="ml-mode"
              value={m}
              checked={mode === m}
              onChange={() => setMode(m)}
            />
            {t(`apply.mode.${m}`)}
          </label>
        ))}
        {mode !== "add" ? (
          <label class="ml-check">
            <input
              type="checkbox"
              checked={removeDependents}
              onChange={(e) => setRemoveDependents(e.currentTarget.checked)}
            />
            {t("apply.removeDependents")}
          </label>
        ) : null}
      </fieldset>
      {presetIds.length > 0 && preview.plan ? (
        <section aria-label={t("apply.preview")}>
          <h3>{t("apply.preview")}</h3>
          {preview.warnings.includes("no-snapshot") ? (
            <p class="ml-warn-text">{t("apply.noSnapshot")}</p>
          ) : null}
          <Diff plan={preview.plan} t={t} />
        </section>
      ) : null}
    </Modal>
  );
}
