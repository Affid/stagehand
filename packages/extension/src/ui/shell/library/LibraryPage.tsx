// The Library, as the prototype: tabs (Modules, Systems, By world), the
// filter with Foundry's Install and Update All, new installs to sort, the
// toolbar (or the selection's bar), and the modules in quiet groups. Tags,
// Presets and New modules open in the panel column.
import { useUi } from "../../context.ts";
import { groupLibrary, type LibGroup } from "../../model/library-groups.ts";
import { Banners } from "../../modules/banners.tsx";
import { CompanionBand } from "../CompanionBand.tsx";
import { type ModulesModel, useModulesModel } from "../../modules/derived.ts";
import { FilterRow } from "./head/FilterRow.tsx";
import { IntakeBand } from "./head/IntakeBand.tsx";
import { LIBRARY_TABS, LibraryTabs, shownTab } from "./head/LibraryTabs.tsx";
import { PhoneModulesHead, PhoneSystemsHead } from "./head/PhoneHead.tsx";
import { Docked } from "../phone/Dock.tsx";
import { isCompact, useLayout } from "../phone/layout.ts";
import { TabPanel } from "../../common/tabs.tsx";
import { SelectBar } from "./head/SelectBar.tsx";
import { Toolbar } from "./head/Toolbar.tsx";
import { Sections } from "./Sections.tsx";
import { SystemsTab } from "./SystemsTab.tsx";
import { type PageState, usePageState } from "./usePageState.ts";
import { WorldGrid } from "./grid/WorldGrid.tsx";

/** What the toolbar, or the phone's head, needs from the page. */
function headProps(page: PageState, groups: readonly LibGroup[]) {
  const keys = groups.map((g) => g.key);
  return {
    by: page.by,
    onBy: page.setBy,
    onSelect: () => page.onSelecting(true),
    allClosed: keys.length > 0 && keys.every((k) => page.closed.has(k)),
    onCollapseAll: () => page.collapseAll(keys),
    onNewFolder: page.newFolder,
  };
}

function ModulesTab(props: {
  readonly model: ModulesModel;
  readonly page: PageState;
  readonly groups: readonly LibGroup[];
}) {
  const { model, page, groups } = props;
  const compact = isCompact(useLayout());
  const head = headProps(page, groups);
  const select = page.selecting ? (
    <SelectBar
      shown={model.visible.map((m) => m.id)}
      onDone={() => page.onSelecting(false)}
    />
  ) : null;
  if (compact)
    return (
      <>
        <PhoneModulesHead {...head} />
        <IntakeBand />
        {/* While selecting: the count and the actions above the tabs. */}
        {select ? <Docked>{select}</Docked> : null}
        <Sections groups={groups} model={model} page={page} />
      </>
    );
  return (
    <>
      <FilterRow kind="module" count={model.all.length} />
      <IntakeBand />
      {page.selecting ? select : <Toolbar {...head} />}
      <Sections groups={groups} model={model} page={page} />
    </>
  );
}

export function LibraryPage() {
  const { state } = useUi();
  const layout = useLayout();
  const model = useModulesModel(state);
  const page = usePageState();
  const context = {
    library: state.data.library,
    smart: model.groups,
    authors: model.authors,
  };
  const groups = groupLibrary(model.visible, page.by, context);
  // The Modules tab shows empty folders too, so a new one can be filled.
  const withEmpty = groupLibrary(model.visible, page.by, {
    ...context,
    keepEmptyFolders: !state.filter.text.trim(),
  });
  const setup = state.data.setup;
  return (
    <div class="stl-page st-app">
      <Banners />
      <CompanionBand />
      <LibraryTabs tab={page.tab} onTab={page.setTab} />
      <TabPanel id={LIBRARY_TABS} tab={shownTab(page.tab, layout)}>
        {shownTab(page.tab, layout) === "grid" ? (
          <WorldGrid
            groups={groups}
            folding={{ closed: page.closed, onToggle: page.toggle }}
            by={page.by}
            onBy={page.setBy}
          />
        ) : page.tab === "systems" ? (
          <>
            {isCompact(layout) ? (
              <PhoneSystemsHead />
            ) : (
              <FilterRow kind="system" count={setup?.systems.length ?? 0} />
            )}
            <SystemsTab />
          </>
        ) : (
          <ModulesTab model={model} page={page} groups={withEmpty} />
        )}
      </TabPanel>
    </div>
  );
}
