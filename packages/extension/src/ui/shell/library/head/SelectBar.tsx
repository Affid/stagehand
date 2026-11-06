// While selecting, the toolbar row becomes the selection's (prototype
// selBar): how many, All shown, None, Move to, Tags, Add to preset, Turn on
// in a world…, and Done.
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import { orderedFolders } from "../../../model/modules.ts";
import { useFolderOps } from "../../../modules/folder-ops.ts";
import { PopMenu } from "../common/PopMenu.tsx";
import { useNewPreset } from "../panels/PresetsPanel.tsx";
import { WorldPick } from "../panels/WorldPick.tsx";
import { queueInParts } from "../../world/turn-all.ts";
import { TagsPop } from "./TagsPop.tsx";

function MoveTo(props: { readonly ids: readonly string[] }) {
  const { state, t } = useUi();
  const ops = useFolderOps();
  const folder = (color: string) => (
    <i
      class="fa-solid fa-folder"
      style={{ color: `color-mix(in srgb, ${color} 55%, white)` }}
      aria-hidden="true"
    />
  );
  const items = [
    ...orderedFolders(state.data.library).map((f) => ({
      key: f.id,
      label: f.name,
      icon: folder(f.color),
      onPick: () => ops.assign(props.ids, f.id),
    })),
    {
      key: "",
      label: t("folder.none"),
      icon: <Icon name="folder" />,
      onPick: () => ops.assign(props.ids, null),
    },
  ];
  return (
    <PopMenu
      label={t("sel.move")}
      icon="folder"
      title={t("sel.moveTitle", { n: String(props.ids.length) })}
      items={items}
      disabled={!props.ids.length}
    />
  );
}

function ToPreset(props: { readonly ids: readonly string[] }) {
  const { state, actions, t } = useUi();
  const create = useNewPreset();
  const items = [
    ...state.data.library.presets.map((p) => ({
      key: p.id,
      label: p.name,
      icon: <Icon name="layer-group" />,
      extra: String(p.modules.length),
      onPick: () =>
        void actions.op({
          op: "preset.update",
          id: p.id,
          baseRevision: p.revision,
          changes: { modules: [...new Set([...p.modules, ...props.ids])] },
        }),
    })),
    {
      key: "+new",
      label: t("presets.new"),
      icon: <Icon name="plus" />,
      onPick: () => create(props.ids),
    },
  ];
  return (
    <PopMenu
      label={t("sel.preset")}
      icon="layer-group"
      title={t("sel.presetTitle", { n: String(props.ids.length) })}
      items={items}
      disabled={!props.ids.length}
    />
  );
}

function WorldOn(props: { readonly ids: readonly string[] }) {
  const { actions, t } = useUi();
  const { ids } = props;
  return (
    <WorldPick
      label={t("sel.world")}
      title={t("sel.worldTitle", {
        what: plural(t, "sel.modules", ids.length),
      })}
      note={t("sel.worldNote")}
      disabled={!ids.length}
      onPick={(w) =>
        void queueInParts(
          (part) => actions.queueApply(w, "add", [], part),
          `${w}:on:${ids.join(",")}`,
          ids,
        )
      }
    />
  );
}

export function SelectBar(props: {
  readonly shown: readonly string[];
  readonly onDone: () => void;
}) {
  const { state, store, t } = useUi();
  const ids = state.selection;
  return (
    <div class="ml-row mls-selbar" role="toolbar" aria-label={t("sel.label")}>
      <Icon name="square-check" />
      <strong class="mls-selcount" title={t("sel.countHint")}>
        {ids.length ? t("sel.count", { n: String(ids.length) }) : t("sel.none")}
      </strong>
      <button
        type="button"
        onClick={() => store.set({ selection: [...props.shown] })}
      >
        {t("sel.allShown")}
      </button>
      <button
        type="button"
        disabled={!ids.length}
        onClick={() => store.set({ selection: [] })}
      >
        {t("sel.clear")}
      </button>
      <span class="mls-sep" />
      <MoveTo ids={ids} />
      <TagsPop ids={ids} />
      <ToPreset ids={ids} />
      <WorldOn ids={ids} />
      <span class="ml-spacer" />
      <button type="button" class="bright" onClick={props.onDone}>
        {t("lib.done")}
      </button>
    </div>
  );
}
