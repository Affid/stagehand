// The Library's toolbar, as the prototype: Group by, then Select, Collapse
// all, New folder, Tags, Presets and Import and export.
import { GROUP_BYS, type GroupBy } from "../../../model/library-groups.ts";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { SyncState } from "./SyncState.tsx";
import { Transfer } from "./Transfer.tsx";

export interface ToolbarProps {
  readonly by: GroupBy;
  readonly onBy: (by: GroupBy) => void;
  readonly onSelect: () => void;
  readonly allClosed: boolean;
  readonly onCollapseAll: () => void;
  readonly onNewFolder: () => void;
}

function PanelToggle(props: {
  readonly kind: "tags" | "presets";
  readonly icon: string;
}) {
  const { state, store, t } = useUi();
  const on = state.side?.kind === props.kind;
  return (
    <button
      type="button"
      class={on ? "st-on" : ""}
      aria-pressed={on}
      onClick={() =>
        store.set({ side: on ? null : { kind: props.kind }, panel: null })
      }
    >
      <Icon name={props.icon} />
      {t(`lib.${props.kind}`)}
    </button>
  );
}

export function Toolbar(props: ToolbarProps) {
  const { t, canChange } = useUi();
  return (
    <div class="st-row stl-toolbar">
      <span class="st-label">{t("lib.groupBy")}</span>
      <select
        aria-label={t("lib.groupBy")}
        value={props.by}
        onChange={(e) => props.onBy(e.currentTarget.value as GroupBy)}
      >
        {GROUP_BYS.map((b) => (
          <option key={b} value={b}>
            {t(`lib.groupBy.${b}`)}
          </option>
        ))}
      </select>
      <span class="st-spacer" />
      {canChange ? (
        <button type="button" onClick={props.onSelect}>
          <Icon name="square-check" />
          {t("lib.select")}
        </button>
      ) : null}
      <button
        type="button"
        class="icon"
        aria-label={t(props.allClosed ? "lib.expandAll" : "lib.collapseAll")}
        title={t(props.allClosed ? "lib.expandAll" : "lib.collapseAll")}
        onClick={props.onCollapseAll}
      >
        <Icon name={props.allClosed ? "angles-down" : "angles-up"} />
      </button>
      {canChange ? (
        <button
          type="button"
          class="icon"
          aria-label={t("lib.newFolder")}
          title={t("lib.newFolder")}
          onClick={props.onNewFolder}
        >
          <Icon name="folder-plus" />
        </button>
      ) : null}
      <PanelToggle kind="tags" icon="tags" />
      <PanelToggle kind="presets" icon="layer-group" />
      <SyncState />
      <Transfer />
    </div>
  );
}
