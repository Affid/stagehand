// Import and export (the toolbar's last icon): the whole library to a file,
// a library file back, or a shared preset file as a new preset.
import { parsePresetImport } from "@module-library/shared/library/transfer";
import { newId } from "../../../actions.ts";
import {
  downloadText,
  fileStamp,
  pickTextFile,
} from "../../../common/files.ts";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { PopMenu } from "../common/PopMenu.tsx";

function useTransfer() {
  const { actions, t } = useUi();
  return {
    async exportAll(): Promise<void> {
      const text = await actions.exportLibrary();
      if (text)
        downloadText(`module-library-${fileStamp(new Date())}.json`, text);
    },
    async importAll(): Promise<void> {
      const text = await pickTextFile();
      if (text !== undefined && window.confirm(t("library.importConfirm")))
        await actions.importLibrary(text);
    },
    async importPreset(): Promise<void> {
      const text = await pickTextFile();
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
  const { t, canChange } = useUi();
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
          onPick: () => void x.exportAll(),
        },
        {
          key: "import",
          label: t("library.import"),
          icon: <Icon name="file-import" />,
          onPick: () => void x.importAll(),
        },
        {
          key: "preset",
          label: t("preset.import"),
          icon: <Icon name="layer-group" />,
          onPick: () => void x.importPreset(),
        },
      ]}
    />
  );
}
