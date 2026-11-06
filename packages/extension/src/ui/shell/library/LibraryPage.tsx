// The new Library (build plan, Phase 3): calm cards in quiet groups (by
// folder, tag, author or smart group), a filter, a selection band, and
// today's folders, tags, presets and import/export in an Organise panel.
import { useState } from "preact/hooks";
import { useUi } from "../../context.ts";
import { plural } from "../../i18n.ts";
import {
  GROUP_BYS,
  type GroupBy,
  groupLibrary,
  type LibGroup,
} from "../../model/library-groups.ts";
import { BulkBar } from "../../modules/BulkBar.tsx";
import { type ModulesModel, useModulesModel } from "../../modules/derived.ts";
import { FolderList } from "../../modules/FolderList.tsx";
import { Banners, folderCounts } from "../../modules/ModulesView.tsx";
import { LibraryTools, PresetList } from "../../modules/PresetList.tsx";
import { TagList } from "../../modules/SideSections.tsx";
import { LibCard } from "./LibCard.tsx";
import { ModulePanel } from "./ModulePanel.tsx";

interface ToolsProps {
  readonly model: ModulesModel;
  readonly by: GroupBy;
  readonly onBy: (by: GroupBy) => void;
  readonly selecting: boolean;
  readonly onSelecting: (on: boolean) => void;
  readonly organise: boolean;
  readonly onOrganise: (on: boolean) => void;
}

function Modes(props: ToolsProps) {
  const { t, canChange } = useUi();
  return (
    <>
      {canChange ? (
        <button
          type="button"
          aria-pressed={props.selecting}
          class={props.selecting ? "ml-on" : ""}
          onClick={() => props.onSelecting(!props.selecting)}
        >
          {props.selecting ? t("lib.done") : t("lib.select")}
        </button>
      ) : null}
      <button
        type="button"
        aria-pressed={props.organise}
        class={props.organise ? "ml-on" : ""}
        title={t("lib.organiseHint")}
        onClick={() => props.onOrganise(!props.organise)}
      >
        {t("lib.organise")}
      </button>
    </>
  );
}

function Tools(props: ToolsProps) {
  const { state, store, t } = useUi();
  return (
    <div class="mll-tools">
      <input
        type="search"
        aria-label={t("lib.filter", { n: props.model.all.length })}
        placeholder={t("lib.filter", { n: props.model.all.length })}
        value={state.filter.text}
        onInput={(e) => {
          const text = e.currentTarget.value;
          store.set((s) => ({ filter: { ...s.filter, text } }));
        }}
      />
      <label class="mll-by">
        <span>{t("lib.groupBy")}</span>
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
      </label>
      <span class="ml-count">
        {plural(t, "lib.count", props.model.visible.length)}
      </span>
      <span class="ml-spacer" />
      <Modes {...props} />
    </div>
  );
}

function Section(props: {
  readonly group: LibGroup;
  readonly model: ModulesModel;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly selecting: boolean;
  readonly detail: string | null;
  readonly onOpen: (id: string) => void;
}) {
  const { t } = useUi();
  const { group } = props;
  const name =
    group.name ??
    t(group.label ?? "", group.param ? { param: group.param } : {});
  return (
    <li class="mll-sec" style={{ "--c": group.color ?? "var(--color-cool-3)" }}>
      <button
        type="button"
        class="mlw-head"
        aria-expanded={props.open}
        onClick={props.onToggle}
      >
        <i
          class={`fa-solid fa-chevron-${props.open ? "down" : "right"} fa-fw`}
          aria-hidden="true"
        />
        <span class="name">{name}</span>
        <span class="count">{group.modules.length}</span>
      </button>
      {props.open ? (
        <ol class="mlw-grid">
          {group.modules.map((m) => (
            <LibCard
              key={m.id}
              pkg={m}
              core={props.model.core}
              worlds={props.model.usage[m.id]}
              selecting={props.selecting}
              open={props.detail === m.id}
              onOpen={props.onOpen}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function Organise(props: { readonly model: ModulesModel }) {
  const { state } = useUi();
  const { counts, unfiled } = folderCounts(state);
  return (
    <aside class="mll-side ml-sidebar">
      <FolderList
        counts={counts}
        total={props.model.all.length}
        unfiled={unfiled}
      />
      <TagList />
      <PresetList model={props.model} />
      <LibraryTools />
    </aside>
  );
}

/** The side slot: a module's details, else Organise when asked for. */
function Side(props: {
  readonly model: ModulesModel;
  readonly page: ReturnType<typeof usePageState>;
}) {
  const { detail, setDetail, organise } = props.page;
  const pkg = detail ? props.model.all.find((m) => m.id === detail) : undefined;
  if (pkg) return <ModulePanel pkg={pkg} onClose={() => setDetail(null)} />;
  return organise ? <Organise model={props.model} /> : null;
}

/** The page's own view state: grouping, select mode, panel, folded groups. */
function usePageState() {
  const { store } = useUi();
  const [by, setBy] = useState<GroupBy>("folder");
  const [selecting, setSelecting] = useState(false);
  const [organise, setOrganise] = useState(false);
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [detail, setDetail] = useState<string | null>(null);
  const toggle = (key: string): void => {
    const next = new Set(closed);
    if (!next.delete(key)) next.add(key);
    setClosed(next);
  };
  const onSelecting = (on: boolean): void => {
    setSelecting(on);
    if (!on) store.set({ selection: [] });
  };
  return {
    by,
    setBy,
    selecting,
    onSelecting,
    organise,
    setOrganise,
    closed,
    toggle,
    detail,
    setDetail,
  };
}

function Groups(props: {
  readonly groups: readonly LibGroup[];
  readonly model: ModulesModel;
  readonly page: ReturnType<typeof usePageState>;
}) {
  const { t } = useUi();
  const { page } = props;
  if (props.groups.length === 0)
    return <p class="ml-empty">{t("lib.empty")}</p>;
  return (
    <ol class="mll-sections">
      {props.groups.map((g) => (
        <Section
          key={g.key}
          group={g}
          model={props.model}
          open={!page.closed.has(g.key)}
          onToggle={() => page.toggle(g.key)}
          selecting={page.selecting}
          detail={page.detail}
          onOpen={(id) => page.setDetail(page.detail === id ? null : id)}
        />
      ))}
    </ol>
  );
}

export function LibraryPage() {
  const { state } = useUi();
  const model = useModulesModel(state);
  const page = usePageState();
  const { by, selecting } = page;
  const groups = groupLibrary(model.visible, by, {
    library: state.data.library,
    smart: model.groups,
    authors: model.authors,
  });
  return (
    <div class="mll-page ml-app">
      <Banners />
      <Tools
        model={model}
        by={by}
        onBy={page.setBy}
        selecting={selecting}
        onSelecting={page.onSelecting}
        organise={page.organise}
        onOrganise={page.setOrganise}
      />
      <div class="mll-body">
        <div class="mll-main">
          {selecting ? <BulkBar model={model} /> : null}
          <Groups groups={groups} model={model} page={page} />
        </div>
        <Side model={model} page={page} />
      </div>
    </div>
  );
}
