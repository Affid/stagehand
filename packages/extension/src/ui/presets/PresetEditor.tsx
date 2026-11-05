// Create or edit a preset: name, description and module list (P-1, P-2),
// export for sharing (P-7). Saves with the revision it was opened at (D-2).
import { exportPreset } from "@module-library/shared/library/transfer";
import { useMemo, useState } from "preact/hooks";
import { newId } from "../actions.ts";
import { downloadText } from "../common/files.ts";
import { Modal } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { sortByTitle } from "../model/modules.ts";

const COMPANION = "module-library";

export function PresetEditor() {
  const { state, store, actions, t, canChange } = useUi();
  const id = state.editingPreset;
  const existing = state.data.library.presets.find((p) => p.id === id);
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [chosen, setChosen] = useState<readonly string[]>(
    existing?.modules ?? state.draftModules.filter((m) => m !== COMPANION),
  );
  const [query, setQuery] = useState("");
  const installed = useMemo(
    () => sortByTitle(state.data.setup?.modules ?? []),
    [state.data.setup],
  );
  const missing = chosen.filter((m) => !installed.some((p) => p.id === m));
  const shown = installed.filter(
    (m) =>
      m.id !== COMPANION &&
      `${m.title} ${m.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  const close = (): void => {
    store.set({ editingPreset: null, draftModules: [] });
  };
  const save = async (): Promise<void> => {
    const fields = { name: name.trim(), description, modules: [...chosen] };
    const ok = existing
      ? await actions.op({
          op: "preset.update",
          id: existing.id,
          baseRevision: existing.revision,
          changes: fields,
        })
      : await actions.op({
          op: "preset.create",
          preset: { ...fields, id: newId(), source: "user" },
        });
    if (!ok) return;
    // The selection became this preset: start the next one from scratch.
    if (!existing) store.set({ selection: [] });
    close();
  };
  const remove = async (): Promise<void> => {
    if (
      existing &&
      window.confirm(t("preset.deleteConfirm", { name: existing.name }))
    )
      if (
        await actions.op({
          op: "preset.delete",
          id: existing.id,
          baseRevision: existing.revision,
        })
      )
        close();
  };
  const toggle = (moduleId: string): void => {
    setChosen(
      chosen.includes(moduleId)
        ? chosen.filter((m) => m !== moduleId)
        : [...chosen, moduleId],
    );
  };
  const footer = (
    <>
      {existing && canChange ? (
        <button type="button" class="ml-danger" onClick={() => void remove()}>
          {t("preset.delete")}
        </button>
      ) : null}
      {existing ? (
        <button
          type="button"
          onClick={() =>
            downloadText(
              `preset-${existing.name}.json`,
              exportPreset(existing, new Date().toISOString()),
            )
          }
        >
          {t("preset.export")}
        </button>
      ) : null}
      <button
        type="button"
        class="ml-primary"
        disabled={!canChange || name.trim() === ""}
        onClick={() => void save()}
      >
        {t("preset.save")}
      </button>
    </>
  );
  return (
    <Modal
      title={existing ? t("preset.edit") : t("preset.new")}
      onClose={close}
      footer={footer}
    >
      <label class="ml-field">
        {t("preset.name")}
        <input
          value={name}
          maxLength={80}
          onInput={(e) => setName(e.currentTarget.value)}
        />
      </label>
      <label class="ml-field">
        {t("preset.description")}
        <textarea
          value={description}
          maxLength={4000}
          onInput={(e) => setDescription(e.currentTarget.value)}
        />
      </label>
      <fieldset class="ml-field">
        <legend>{t("preset.modules", { n: chosen.length })}</legend>
        {missing.length > 0 ? (
          <p class="ml-warn-text">
            {t("preset.notInstalled", { n: missing.length })}
          </p>
        ) : null}
        <input
          type="search"
          placeholder={t("preset.filter")}
          aria-label={t("preset.filter")}
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <ul class="ml-checklist">
          {shown.map((m) => (
            <li key={m.id}>
              <label>
                <input
                  type="checkbox"
                  checked={chosen.includes(m.id)}
                  onChange={() => toggle(m.id)}
                />
                <span>{m.title}</span> <span class="ml-id">{m.id}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    </Modal>
  );
}
