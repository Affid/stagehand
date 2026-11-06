// The Library's groups: a header with the name and how many modules it
// holds (renamed in place after New folder), and its cards when open.
import { InlineInput } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { plural } from "../../i18n.ts";
import type { LibGroup } from "../../model/library-groups.ts";
import type { ModulesModel } from "../../modules/derived.ts";
import { useFolderOps } from "../../modules/folder-ops.ts";
import { LibCard } from "./LibCard.tsx";
import type { PageState } from "./usePageState.ts";

function Head(props: {
  readonly group: LibGroup;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly renaming: boolean;
  readonly onRenamed: () => void;
}) {
  const { state, t } = useUi();
  const ops = useFolderOps();
  const { group } = props;
  const name =
    group.name ??
    t(group.label ?? "", group.param ? { param: group.param } : {});
  const folder = state.data.library.folders.find((f) => f.id === group.key);
  if (props.renaming && folder)
    return (
      <div class="mlw-head mll-renaming">
        <InlineInput
          initial={folder.name}
          label={t("folder.rename")}
          onCommit={(v) => {
            if (v !== folder.name) ops.update(folder, { name: v });
            props.onRenamed();
          }}
          onCancel={props.onRenamed}
        />
      </div>
    );
  return (
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
      <span class="count">{plural(t, "lib.count", group.modules.length)}</span>
    </button>
  );
}

function Section(props: {
  readonly group: LibGroup;
  readonly model: ModulesModel;
  readonly page: PageState;
}) {
  const { state, store } = useUi();
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
      />
      {open ? (
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
