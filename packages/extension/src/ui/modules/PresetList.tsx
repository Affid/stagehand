// Presets in the sidebar (P-1, P-2, P-7) and library export/import (D-1).
import { parsePresetImport } from "@module-library/shared/library/transfer";
import { newId } from "../actions.ts";
import { downloadText, fileStamp, pickTextFile } from "../common/files.ts";
import { useUi } from "../context.ts";
import type { ModulesModel } from "./derived.ts";

export function PresetList(props: { readonly model: ModulesModel }) {
  const { state, store, actions, t, canChange } = useUi();
  const presets = state.data.library.presets;
  const startNew = (modules: readonly string[]): void => {
    store.set({ editingPreset: "new", draftModules: modules });
  };
  const importPreset = async (): Promise<void> => {
    const text = await pickTextFile();
    if (text === undefined) return;
    const parsed = parsePresetImport(text);
    if (!parsed.ok) {
      store.set({
        notice: {
          kind: "error",
          text: t("notice.importFailed", { error: parsed.error }),
        },
      });
      return;
    }
    await actions.op({
      op: "preset.create",
      preset: { ...parsed.preset, id: newId(), source: "import" },
    });
  };
  return (
    <section class="ml-side-section" aria-label={t("sidebar.presets")}>
      <h3>{t("sidebar.presets")}</h3>
      <ul>
        {presets.map((p) => (
          <li key={p.id} class="ml-side-item">
            <button
              type="button"
              class="ml-side-label"
              data-preset={p.id}
              onClick={() => store.set({ editingPreset: p.id })}
            >
              <span>{p.name}</span>
              <span class="ml-count">{p.modules.length}</span>
            </button>
          </li>
        ))}
      </ul>
      {canChange ? (
        <div class="ml-stack">
          <button type="button" class="ml-link" onClick={() => startNew([])}>
            + {t("preset.new")}
          </button>
          {props.model.filtered ? (
            <button
              type="button"
              class="ml-link"
              onClick={() => startNew(props.model.visible.map((m) => m.id))}
            >
              + {t("preset.fromFilter")}
            </button>
          ) : null}
          <button
            type="button"
            class="ml-link"
            onClick={() => void importPreset()}
          >
            {t("preset.import")}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function LibraryTools() {
  const { actions, t, canChange } = useUi();
  if (!canChange) return null;
  const doExport = async (): Promise<void> => {
    const text = await actions.exportLibrary();
    if (text)
      downloadText(`module-library-${fileStamp(new Date())}.json`, text);
  };
  const doImport = async (): Promise<void> => {
    const text = await pickTextFile();
    if (text !== undefined && window.confirm(t("library.importConfirm")))
      await actions.importLibrary(text);
  };
  return (
    <section class="ml-side-section" aria-label={t("sidebar.library")}>
      <h3>{t("sidebar.library")}</h3>
      <div class="ml-stack">
        <button type="button" class="ml-link" onClick={() => void doExport()}>
          {t("library.export")}
        </button>
        <button type="button" class="ml-link" onClick={() => void doImport()}>
          {t("library.import")}
        </button>
      </div>
    </section>
  );
}
