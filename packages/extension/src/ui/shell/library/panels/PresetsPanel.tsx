// Presets, as the prototype's panel: every preset with its size, New
// preset, and the chosen preset's name, about, Add to a world…, its modules
// and Delete preset.
import type { Preset } from "@module-library/shared/library/schema";
import { newId } from "../../../actions.ts";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { ModuleChecks } from "./ModuleChecks.tsx";
import { PanelFrame } from "./PanelFrame.tsx";
import { WorldPick } from "./WorldPick.tsx";

/** A new preset, chosen in the panel; `modules` start it (group menu, selection). */
export function useNewPreset() {
  const { store, actions, t } = useUi();
  return (modules: readonly string[] = []): void => {
    const preset = {
      id: newId(),
      name: t("presets.newName"),
      description: "",
      modules: [...modules],
      source: "user" as const,
    };
    void actions.op({ op: "preset.create", preset });
    store.set({ side: { kind: "presets", id: preset.id }, panel: null });
  };
}

function PresetList(props: { readonly current: Preset | undefined }) {
  const { state, store, t, canChange } = useUi();
  const create = useNewPreset();
  return (
    <ul class="mls-list">
      {state.data.library.presets.map((p) => (
        <li key={p.id} class={p.id === props.current?.id ? "active" : ""}>
          <button
            type="button"
            aria-pressed={p.id === props.current?.id}
            onClick={() => store.set({ side: { kind: "presets", id: p.id } })}
          >
            <Icon name="layer-group" />
            <span>{p.name}</span>
            <span class="c">{p.modules.length}</span>
          </button>
        </li>
      ))}
      {canChange ? (
        <li class="new">
          <button type="button" onClick={() => create()}>
            <Icon name="plus" />
            <span>{t("presets.new")}</span>
            <span />
          </button>
        </li>
      ) : null}
    </ul>
  );
}

function useUpdate(p: Preset) {
  const { actions } = useUi();
  return (changes: Partial<Pick<Preset, "name" | "description" | "modules">>) =>
    void actions.op({
      op: "preset.update",
      id: p.id,
      baseRevision: p.revision,
      changes,
    });
}

function Fields(props: { readonly p: Preset }) {
  const { t, canChange } = useUi();
  const { p } = props;
  const update = useUpdate(p);
  const key = `${p.id}:${String(p.revision)}`;
  return (
    <div class="mls-kv">
      <span>{t("presets.name")}</span>
      <input
        type="text"
        key={key}
        aria-label={t("presets.name")}
        defaultValue={p.name}
        disabled={!canChange}
        onChange={(e) => {
          const name = e.currentTarget.value.trim();
          if (name && name !== p.name) update({ name });
        }}
      />
      <span>{t("presets.about")}</span>
      <textarea
        key={key}
        aria-label={t("presets.about")}
        defaultValue={p.description}
        disabled={!canChange}
        onChange={(e) => {
          const description = e.currentTarget.value;
          if (description !== p.description) update({ description });
        }}
      />
    </div>
  );
}

function PresetEdit(props: { readonly p: Preset }) {
  const { store, actions, t, canChange } = useUi();
  const { p } = props;
  const update = useUpdate(p);
  const remove = (): void => {
    if (!window.confirm(t("presets.deleteConfirm", { name: p.name }))) return;
    void actions.op({
      op: "preset.delete",
      id: p.id,
      baseRevision: p.revision,
    });
    store.set({ side: { kind: "presets" } });
  };
  return (
    <>
      <Fields p={p} />
      <WorldPick
        bright
        label={t("presets.toWorld")}
        title={t("presets.toWorldTitle", { name: p.name })}
        note={t("presets.toWorldNote")}
        onPick={(w) => void actions.queueApply(w, "add", [p.id])}
      />
      <div class="mls-chg">
        <h4>
          <span>{t("presets.modules", { n: String(p.modules.length) })}</span>
          {canChange ? (
            <button type="button" class="ml-link" onClick={remove}>
              {t("presets.delete")}
            </button>
          ) : null}
        </h4>
        <ModuleChecks
          isOn={(id) => p.modules.includes(id)}
          onToggle={(id, on) =>
            update({
              modules: on
                ? [...p.modules, id]
                : p.modules.filter((m) => m !== id),
            })
          }
        />
      </div>
    </>
  );
}

export function PresetsPanel(props: { readonly id: string | undefined }) {
  const { state, t } = useUi();
  const { presets } = state.data.library;
  const current = presets.find((x) => x.id === props.id) ?? presets[0];
  return (
    <PanelFrame title={t("presets.title")} label={t("presets.title")}>
      <PresetList current={current} />
      {current ? <PresetEdit key={current.id} p={current} /> : null}
    </PanelFrame>
  );
}
