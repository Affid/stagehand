// Create or edit a preset: name, description and module list (P-1, P-2),
// export for sharing (P-7). Saves with the revision it was opened at (D-2):
// after a conflict the editor closes, so a stale form can't overwrite.
import { exportPreset } from "@module-library/shared/library/transfer";
import type { Preset } from "@module-library/shared/library/schema";
import { useState } from "preact/hooks";
import { newId } from "../actions.ts";
import { downloadText } from "../common/files.ts";
import { FoundryWindow } from "../common/FoundryWindow.tsx";
import { useUi } from "../context.ts";
import { ModuleChecklist } from "./ModuleChecklist.tsx";

const COMPANION = "module-library";

/** The form, frozen at the revision the editor opened with. */
function usePresetForm(existing: Preset | undefined, draft: readonly string[]) {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [chosen, setChosen] = useState<readonly string[]>(
    existing?.modules ?? draft.filter((m) => m !== COMPANION),
  );
  const [baseRevision] = useState(existing?.revision ?? 0);
  const toggle = (id: string): void => {
    setChosen(
      chosen.includes(id) ? chosen.filter((m) => m !== id) : [...chosen, id],
    );
  };
  return {
    name,
    setName,
    description,
    setDescription,
    chosen,
    toggle,
    baseRevision,
  };
}

function Footer(props: {
  readonly existing: Preset | undefined;
  readonly canSave: boolean;
  readonly onSave: () => void;
  readonly onDelete: () => void;
}) {
  const { t, canChange } = useUi();
  const { existing } = props;
  const exportIt = (p: Preset): void => {
    downloadText(
      `preset-${p.name}.json`,
      exportPreset(p, new Date().toISOString()),
    );
  };
  return (
    <>
      {existing && canChange ? (
        <button type="button" class="ml-danger" onClick={props.onDelete}>
          {t("preset.delete")}
        </button>
      ) : null}
      {existing ? (
        <button type="button" onClick={() => exportIt(existing)}>
          {t("preset.export")}
        </button>
      ) : null}
      <button
        type="button"
        class="ml-primary"
        disabled={!canChange || !props.canSave}
        onClick={props.onSave}
      >
        {t("preset.save")}
      </button>
    </>
  );
}

const ICON = "fa-solid fa-layer-group";
const SIZE = { width: 640, height: 760 } as const;

/** Shown when the preset was deleted elsewhere while the editor was open. */
function Gone(props: { readonly onClose: () => void }) {
  const { t } = useUi();
  return (
    <FoundryWindow
      kind="preset"
      title={t("preset.edit")}
      icon={ICON}
      size={SIZE}
      onClose={props.onClose}
    >
      <p>{t("preset.gone")}</p>
    </FoundryWindow>
  );
}

type Form = ReturnType<typeof usePresetForm>;

/** Save and delete; any outcome but an error closes the editor (D-2). */
function usePresetActions(
  existing: Preset | undefined,
  form: Form,
  close: () => void,
) {
  const { store, actions, t } = useUi();
  const save = async (): Promise<void> => {
    const fields = {
      name: form.name.trim(),
      description: form.description,
      modules: [...form.chosen],
    };
    const outcome = existing
      ? await actions.op({
          op: "preset.update",
          id: existing.id,
          baseRevision: form.baseRevision,
          changes: fields,
        })
      : await actions.op({
          op: "preset.create",
          preset: { ...fields, id: newId(), source: "user" },
        });
    if (outcome === "error") return;
    // The selection became this preset: start the next one from scratch.
    if (outcome === "ok" && !existing) store.set({ selection: [] });
    close();
  };
  const remove = async (): Promise<void> => {
    if (
      !existing ||
      !window.confirm(t("preset.deleteConfirm", { name: existing.name }))
    )
      return;
    const outcome = await actions.op({
      op: "preset.delete",
      id: existing.id,
      baseRevision: form.baseRevision,
    });
    if (outcome !== "error") close();
  };
  return { save, remove };
}

export function PresetEditor() {
  const { state, store, t } = useUi();
  const id = state.editingPreset;
  const existing = state.data.library.presets.find((p) => p.id === id);
  const form = usePresetForm(existing, state.draftModules);
  const close = (): void => {
    store.set({ editingPreset: null, draftModules: [] });
  };
  const ops = usePresetActions(existing, form, close);
  if (id !== "new" && !existing) return <Gone onClose={close} />;
  const footer = (
    <Footer
      existing={existing}
      canSave={form.name.trim() !== ""}
      onSave={() => void ops.save()}
      onDelete={() => void ops.remove()}
    />
  );
  return (
    <FoundryWindow
      kind="preset"
      title={existing ? t("preset.edit") : t("preset.new")}
      icon={ICON}
      size={SIZE}
      onClose={close}
      footer={footer}
    >
      <label class="ml-field">
        {t("preset.name")}
        <input
          value={form.name}
          maxLength={80}
          onInput={(e) => form.setName(e.currentTarget.value)}
        />
      </label>
      <label class="ml-field">
        {t("preset.description")}
        <textarea
          value={form.description}
          maxLength={4000}
          onInput={(e) => form.setDescription(e.currentTarget.value)}
        />
      </label>
      <ModuleChecklist chosen={form.chosen} onToggle={form.toggle} />
    </FoundryWindow>
  );
}
