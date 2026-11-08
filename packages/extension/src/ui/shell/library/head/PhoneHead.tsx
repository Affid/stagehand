// The Library's head in the phone and tablet layouts (mockup: _phone.js
// phLibrary, "decluttered"): one row instead of four. Modules: the filter,
// View (Group by) and ⋮ for Select, Install, Update all, Tags, Presets, New
// folder, Collapse or expand all, and Import and export. Systems: the
// filter, Install and Update all as icons.
import { GROUP_BYS, type GroupBy } from "../../../model/library-groups.ts";
import { updateCount } from "../../../model/updates.ts";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { PopMenu, type PopItem } from "../common/PopMenu.tsx";
import { useTransfer } from "./Transfer.tsx";

function Filter(props: { readonly kind: "module" | "system" }) {
  const { state, store, t } = useUi();
  const setup = state.data.setup;
  const n =
    props.kind === "module"
      ? (setup?.modules.length ?? 0)
      : (setup?.systems.length ?? 0);
  const label = t(`lib.filter.${props.kind}`, { n: String(n) });
  return (
    <label class="filter search">
      <input
        type="search"
        aria-label={label}
        placeholder={label}
        value={state.filter.text}
        onInput={(e) => {
          const text = e.currentTarget.value;
          // A hidden card must not stay selected for a bulk action.
          store.set((s) => ({ filter: { ...s.filter, text }, selection: [] }));
        }}
      />
    </label>
  );
}

export interface PhoneHeadProps {
  readonly by: GroupBy;
  readonly onBy: (by: GroupBy) => void;
  readonly onSelect: () => void;
  readonly allClosed: boolean;
  readonly onCollapseAll: () => void;
  readonly onNewFolder: () => void;
}

/** View: how the modules are grouped, the current choice ticked. */
function View(props: Pick<PhoneHeadProps, "by" | "onBy">) {
  const { t } = useUi();
  const items: PopItem[] = GROUP_BYS.map((b) => ({
    key: b,
    label: t(`lib.groupBy.${b}`),
    icon: b === props.by ? <Icon name="check" /> : undefined,
    onPick: () => props.onBy(b),
  }));
  return (
    <PopMenu
      iconOnly
      label={t("mlp.libView", { by: t(`lib.groupBy.${props.by}`) })}
      icon="sliders"
      title={t("lib.groupBy")}
      items={items}
    />
  );
}

interface Entry {
  readonly key: string;
  readonly icon: string;
  readonly label: string;
  readonly onPick: () => void;
  /** Shown only when true (changes need the admin's verified Setup). */
  readonly on?: boolean;
}

const toItems = (entries: readonly Entry[]): PopItem[] =>
  entries
    .filter((e) => e.on !== false)
    .map((e) => ({
      key: e.key,
      label: e.label,
      icon: <Icon name={e.icon} />,
      onPick: e.onPick,
    }));

/** Export, import and import a preset, as the toolbar's Import and export. */
function useTransferEntries(): Entry[] {
  const { actions, t, canChange } = useUi();
  const x = useTransfer();
  const run = (fn: () => Promise<void>) => () => void actions.guard(fn);
  return [
    {
      key: "export",
      icon: "file-export",
      label: t("library.export"),
      onPick: run(x.exportAll),
      on: canChange,
    },
    {
      key: "import",
      icon: "file-import",
      label: t("library.import"),
      onPick: run(x.importAll),
      on: canChange,
    },
    {
      key: "preset",
      icon: "layer-group",
      label: t("preset.import"),
      onPick: run(x.importPreset),
      on: canChange,
    },
  ];
}

/** Select, and Foundry's Install and Update all (with its count). */
function useManageEntries(props: PhoneHeadProps): Entry[] {
  const { state, page, t, canChange } = useUi();
  const updates = updateCount(
    state.updates,
    state.data.setup?.modules ?? [],
    [],
  );
  const foundry = (action: "installPackage" | "updateAll") => () => {
    page.foundryAction({ action, packageType: "module" });
  };
  return [
    {
      key: "select",
      icon: "square-check",
      label: t("mlp.selectModules"),
      onPick: props.onSelect,
      on: canChange,
    },
    {
      key: "install",
      icon: "download",
      label: t("mlp.installModule"),
      onPick: foundry("installPackage"),
      on: canChange,
    },
    {
      key: "update",
      icon: "cloud-arrow-down",
      label: t("mlp.updateAll", { n: updates }),
      onPick: foundry("updateAll"),
      on: canChange && updates > 0,
    },
  ];
}

/** Tags, Presets, New folder, Collapse or expand all. */
function useOrganiseEntries(props: PhoneHeadProps): Entry[] {
  const { store, t, canChange } = useUi();
  const side = (kind: "tags" | "presets") => () => {
    store.set({ side: { kind }, panel: null });
  };
  const fold = props.allClosed ? "expandAll" : "collapseAll";
  return [
    { key: "tags", icon: "tags", label: t("mlp.tags"), onPick: side("tags") },
    {
      key: "presets",
      icon: "layer-group",
      label: t("mlp.presets"),
      onPick: side("presets"),
    },
    {
      key: "folder",
      icon: "folder-plus",
      label: t("lib.newFolder"),
      onPick: props.onNewFolder,
      on: canChange,
    },
    {
      key: "fold",
      icon: props.allClosed ? "angles-down" : "angles-up",
      label: t(`lib.${fold}`),
      onPick: props.onCollapseAll,
    },
  ];
}

function useMoreItems(props: PhoneHeadProps): PopItem[] {
  return toItems([
    ...useManageEntries(props),
    ...useOrganiseEntries(props),
    ...useTransferEntries(),
  ]);
}

/** The Modules tab's one row: the filter, View and ⋮. */
export function PhoneModulesHead(props: PhoneHeadProps) {
  const { t } = useUi();
  const more = useMoreItems(props);
  return (
    <header class="controls mll-controls mlp-libhead">
      <Filter kind="module" />
      <View by={props.by} onBy={props.onBy} />
      <PopMenu
        iconOnly
        label={t("mlp.libMore")}
        icon="ellipsis-vertical"
        title={t("shell.library")}
        items={more}
      />
    </header>
  );
}

/** The Systems tab's row: the filter, Install and Update all. */
export function PhoneSystemsHead() {
  const { page, t, canChange } = useUi();
  const act = (
    action: "installPackage" | "updateAll",
    label: string,
    icon: string,
  ) => (
    <button
      type="button"
      class="icon"
      aria-label={label}
      title={label}
      disabled={!canChange}
      onClick={() => page.foundryAction({ action, packageType: "system" })}
    >
      <Icon name={icon} />
    </button>
  );
  return (
    <header class="controls mll-controls mlp-libhead">
      <Filter kind="system" />
      {act("installPackage", t("lib.install.system"), "plus")}
      {act("updateAll", t("lib.updateAll"), "cloud-arrow-down")}
    </header>
  );
}
