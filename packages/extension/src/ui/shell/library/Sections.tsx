// The Library's groups: a header with the name and how many modules it
// holds (renamed in place after New folder), and its cards when open.
import type { Folder } from "@module-library/shared/library/schema";
import { InlineInput } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { plural } from "../../i18n.ts";
import type { LibGroup } from "../../model/library-groups.ts";
import type { ModulesModel } from "../../modules/derived.ts";
import { useFolderOps } from "../../modules/folder-ops.ts";
import { GroupMenu } from "./GroupMenu.tsx";
import { LibCard } from "./LibCard.tsx";
import type { PageState } from "./usePageState.ts";

/** A folder named in place (after New folder, or Rename in its menu). */
function RenameHead(props: {
  readonly folder: Folder;
  readonly onDone: () => void;
}) {
  const { t } = useUi();
  const ops = useFolderOps();
  const { folder } = props;
  return (
    <div class="mlw-head mll-renaming">
      <InlineInput
        initial={folder.name}
        label={t("folder.rename")}
        onCommit={(v) => {
          if (v !== folder.name) ops.update(folder, { name: v });
          props.onDone();
        }}
        onCancel={props.onDone}
      />
    </div>
  );
}

function Head(props: {
  readonly group: LibGroup;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly renaming: boolean;
  readonly onRenamed: () => void;
  readonly page: PageState;
}) {
  const { state, store, t, canChange } = useUi();
  const { group } = props;
  const name =
    group.name ??
    t(group.label ?? "", group.param ? { param: group.param } : {});
  const folder = state.data.library.folders.find((f) => f.id === group.key);
  if (props.renaming && folder)
    return <RenameHead folder={folder} onDone={props.onRenamed} />;
  return (
    <div class="mlw-headrow">
      {props.page.selecting ? <GroupCheck group={group} name={name} /> : null}
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
        <span class="count">
          {plural(t, "lib.count", group.modules.length)}
        </span>
      </button>
      {canChange ? (
        <GroupMenu
          name={name}
          folder={folder}
          ids={group.modules.map((m) => m.id)}
          onRename={() => props.page.setRenaming(group.key)}
          onSelect={() => {
            props.page.onSelecting(true);
            store.set({ selection: group.modules.map((m) => m.id) });
          }}
        />
      ) : null}
    </div>
  );
}

/** In select mode: the whole group at once (prototype mls-gcheck). */
function GroupCheck(props: {
  readonly group: LibGroup;
  readonly name: string;
}) {
  const { state, store, t } = useUi();
  const ids = props.group.modules.map((m) => m.id);
  const n = ids.filter((id) => state.selection.includes(id)).length;
  if (!ids.length) return null;
  return (
    <input
      type="checkbox"
      class="mls-gcheck"
      checked={n === ids.length}
      ref={(el) => {
        if (el) el.indeterminate = n > 0 && n < ids.length;
      }}
      aria-label={t("lib.g.check", { group: props.name })}
      title={t("lib.g.check", { group: props.name })}
      onChange={() =>
        store.set((s) => ({
          selection:
            n === ids.length
              ? s.selection.filter((id) => !ids.includes(id))
              : [...new Set([...s.selection, ...ids])],
        }))
      }
    />
  );
}

function Section(props: {
  readonly group: LibGroup;
  readonly model: ModulesModel;
  readonly page: PageState;
}) {
  const { state, store, t } = useUi();
  const { group, page } = props;
  const open = !page.closed.has(group.key);
  return (
    <li class="mll-sec" style={{ "--c": group.color ?? "var(--color-cool-3)" }}>
      <Head
        group={group}
        open={open}
        onToggle={() => page.toggle(group.key)}
        renaming={page.renaming === group.key}
        onRenamed={() => page.setRenaming(null)}
        page={page}
      />
      {open && !group.modules.length ? (
        <p class="ml-muted mll-emptygroup">{t("lib.emptyGroup")}</p>
      ) : null}
      {open && group.modules.length ? (
        <ol class="mlw-grid">
          {group.modules.map((m) => (
            <LibCard
              key={m.id}
              pkg={m}
              core={props.model.core}
              worlds={props.model.usage[m.id]}
              selecting={page.selecting}
              open={state.panel === m.id}
              onOpen={(id) =>
                store.set({ panel: state.panel === id ? null : id, side: null })
              }
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

export function Sections(props: {
  readonly groups: readonly LibGroup[];
  readonly model: ModulesModel;
  readonly page: PageState;
}) {
  const { t } = useUi();
  if (props.groups.length === 0)
    return <p class="ml-empty">{t("lib.empty")}</p>;
  return (
    <ol class="mll-sections">
      {props.groups.map((g) => (
        <Section key={g.key} group={g} model={props.model} page={props.page} />
      ))}
    </ol>
  );
}
