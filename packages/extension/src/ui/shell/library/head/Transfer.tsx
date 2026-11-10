// Import and export (the toolbar's last icon): the whole library to a file,
// a library file back, or a shared preset file as a new preset.
import { parsePresetImport } from "@stagehand/shared/library/transfer";
import { newId } from "../../../actions.ts";
import { fileStamp } from "../../../common/files.ts";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { PopMenu } from "../common/PopMenu.tsx";

/** Export, import and import a preset; the phone's ⋮ menu lists them too. */
export function useTransfer() {
  const { actions, t, ports } = useUi();
  return {
    exportAll: async (): Promise<void> => {
      const text = await actions.exportLibrary();
      if (text)
        await ports.files.save(`stagehand-${fileStamp(new Date())}.json`, text);
    },
    importAll: async (): Promise<void> => {
      const text = await ports.files.open();
      if (text === undefined) return;
      if (await ports.confirm(t("library.importConfirm")))
        await actions.importLibrary(text);
    },
    importPreset: async (): Promise<void> => {
      const text = await ports.files.open();
      if (text === undefined) return;
      const parsed = parsePresetImport(text);
      if (!parsed.ok) {
        actions.notify(
          "error",
          t("notice.importFailed", { error: parsed.error }),
        );
        return;
      }
      const preset = {
        ...parsed.preset,
        id: newId(),
        source: "import" as const,
      };
      await actions.op({ op: "preset.create", preset });
    },
  };
}

export function Transfer() {
  const { t, actions, canChange } = useUi();
  const x = useTransfer();
  return (
    <PopMenu
      iconOnly
      label={t("lib.transfer")}
      icon="file-export"
      title={t("lib.transfer")}
      disabled={!canChange}
      items={[
        {
          key: "export",
          label: t("library.export"),
          icon: <Icon name="file-export" />,
          onPick: () => void actions.guard(x.exportAll),
        },
        {
          key: "import",
          label: t("library.import"),
          icon: <Icon name="file-import" />,
          onPick: () => void actions.guard(x.importAll),
        },
        {
          key: "preset",
          label: t("preset.import"),
          icon: <Icon name="layer-group" />,
          onPick: () => void actions.guard(x.importPreset),
        },
      ]}
    />
  );
}
