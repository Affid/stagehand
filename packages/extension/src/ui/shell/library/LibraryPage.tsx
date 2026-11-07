// The Library, as the prototype: tabs (Modules, Systems, By world), the
// filter with Foundry's Install and Update All, new installs to sort, the
// toolbar (or the selection's bar), and the modules in quiet groups. Tags,
// Presets and New modules open in the panel column.
import { useUi } from "../../context.ts";
import { groupLibrary, type LibGroup } from "../../model/library-groups.ts";
import { Banners } from "../../modules/banners.tsx";
import { type ModulesModel, useModulesModel } from "../../modules/derived.ts";
import { FilterRow } from "./head/FilterRow.tsx";
import { IntakeBand } from "./head/IntakeBand.tsx";
import { LIBRARY_TABS, LibraryTabs } from "./head/LibraryTabs.tsx";
import { TabPanel } from "../../common/tabs.tsx";
import { SelectBar } from "./head/SelectBar.tsx";
import { Toolbar } from "./head/Toolbar.tsx";
import { Sections } from "./Sections.tsx";
import { SystemsTab } from "./SystemsTab.tsx";
import { type PageState, usePageState } from "./usePageState.ts";
import { WorldGrid } from "./grid/WorldGrid.tsx";

function ModulesTab(props: {
  readonly model: ModulesModel;
  readonly page: PageState;
  readonly groups: readonly LibGroup[];
}) {
  const { model, page, groups } = props;
  const keys = groups.map((g) => g.key);
  return (
    <>
      <FilterRow kind="module" count={model.all.length} />
      <IntakeBand />
      {page.selecting ? (
        <SelectBar
          shown={model.visible.map((m) => m.id)}
          onDone={() => page.onSelecting(false)}
        />
      ) : (
        <Toolbar
          by={page.by}
          onBy={page.setBy}
          onSelect={() => page.onSelecting(true)}
          allClosed={keys.length > 0 && keys.every((k) => page.closed.has(k))}
          onCollapseAll={() => page.collapseAll(keys)}
          onNewFolder={page.newFolder}
        />
      )}
      <Sections groups={groups} model={model} page={page} />
    </>
  );
}

export function LibraryPage() {
  const { state } = useUi();
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
    <div class="mll-page ml-app">
      <Banners />
      <LibraryTabs tab={page.tab} onTab={page.setTab} />
      <TabPanel id={LIBRARY_TABS} tab={page.tab}>
        {page.tab === "grid" ? (
          <WorldGrid
            groups={groups}
            folding={{ closed: page.closed, onToggle: page.toggle }}
            by={page.by}
            onBy={page.setBy}
          />
        ) : page.tab === "systems" ? (
          <>
            <FilterRow kind="system" count={setup?.systems.length ?? 0} />
            <SystemsTab />
          </>
        ) : (
          <ModulesTab model={model} page={page} groups={withEmpty} />
        )}
      </TabPanel>
    </div>
  );
}
