// The Add-on Modules tab: banners, toolbar, sidebar and organised list.
import { useUi } from "../context.ts";
import { useModulesModel } from "./derived.ts";
import { FolderList } from "./FolderList.tsx";
import { BulkBar } from "./BulkBar.tsx";
import { ModuleList } from "./ModuleList.tsx";
import { LibraryTools, PresetList } from "./PresetList.tsx";
import { AuthorList, GroupList, TagList } from "./SideSections.tsx";
import { Toolbar } from "./Toolbar.tsx";

export function Banners() {
  const { state, t } = useUi();
  const version = state.data.setup?.core.version ?? "";
  if (state.adapter.status === "safe-mode")
    return <p class="ml-banner ml-warn">{t("notice.safeMode", { version })}</p>;
  if (state.adapter.status === "untested-build")
    return <p class="ml-banner">{t("notice.untestedBuild", { version })}</p>;
  if (!state.data.adminVerified)
    return <p class="ml-banner ml-warn">{t("notice.notVerified")}</p>;
  return null;
}

function folderCounts(state: ReturnType<typeof useUi>["state"]) {
  const counts: Record<string, number> = {};
  const known = new Set(state.data.library.folders.map((f) => f.id));
  let unfiled = 0;
  for (const m of state.data.setup?.modules ?? []) {
    const f = state.data.library.modules[m.id]?.folderId ?? null;
    if (f !== null && known.has(f)) counts[f] = (counts[f] ?? 0) + 1;
    else unfiled++;
  }
  return { counts, unfiled };
}

export function ModulesView() {
  const ui = useUi();
  const { state } = ui;
  const model = useModulesModel(state);
  const { counts, unfiled } = folderCounts(state);
  return (
    <div class="ml-app ml-modules">
      <Banners />
      <Toolbar model={model} />
      {state.view === "organised" ? (
        <div class="ml-layout">
          <aside class="ml-sidebar">
            <FolderList
              counts={counts}
              total={model.all.length}
              unfiled={unfiled}
            />
            <GroupList model={model} />
            <TagList />
            <AuthorList model={model} />
            <PresetList model={model} />
            <LibraryTools />
          </aside>
          <main class="ml-main">
            <BulkBar model={model} />
            <ModuleList model={model} />
          </main>
        </div>
      ) : null}
    </div>
  );
}
