// Tags, as the prototype's panel: every tag with its colour and count, New
// tag, and the chosen tag's name, colour and modules, or Delete tag.
import type { Tag } from "@module-library/shared/library/schema";
import { newId, nextColor, PALETTE, PALETTE_NAMES } from "../../../actions.ts";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { ModuleChecks } from "./ModuleChecks.tsx";
import { PanelFrame } from "./PanelFrame.tsx";

function useTagCount(): (id: string) => number {
  const { state } = useUi();
  const installed = state.data.setup?.modules ?? [];
  return (id) =>
    installed.filter((m) => state.data.library.modules[m.id]?.tags.includes(id))
      .length;
}

function TagList(props: { readonly current: Tag | undefined }) {
  const { state, store, actions, t, canChange } = useUi();
  const count = useTagCount();
  const { tags } = state.data.library;
  const create = (): void => {
    const tag = {
      id: newId(),
      name: t("tags.newName"),
      color: nextColor(tags.length),
    };
    void actions.op({ op: "tag.create", tag });
    store.set({ side: { kind: "tags", id: tag.id } });
  };
  return (
    <ul class="mls-list">
      {tags.map((x) => (
        <li key={x.id} class={x.id === props.current?.id ? "active" : ""}>
          <button
            type="button"
            aria-pressed={x.id === props.current?.id}
            onClick={() => store.set({ side: { kind: "tags", id: x.id } })}
          >
            <span class="sw" style={{ "--ml-c": x.color }} />
            <span>{x.name}</span>
            <span class="c">{count(x.id)}</span>
          </button>
        </li>
      ))}
      {canChange ? (
        <li class="new">
          <button type="button" onClick={create}>
            <Icon name="plus" />
            <span>{t("tags.new")}</span>
            <span />
          </button>
        </li>
      ) : null}
    </ul>
  );
}

function Swatches(props: { readonly tag: Tag }) {
  const { actions, t, canChange } = useUi();
  const { tag } = props;
  return (
    <div class="mls-sws" role="group" aria-label={t("tags.colour")}>
      {PALETTE.map((c, i) => (
        <button
          key={c}
          type="button"
          class={`ml-swatch${c === tag.color ? " ml-on" : ""}`}
          style={{ "--ml-c": c, background: c }}
          aria-label={t(`color.${PALETTE_NAMES[i] ?? "grey"}`)}
          aria-pressed={c === tag.color}
          disabled={!canChange}
          onClick={() =>
            void actions.op({
              op: "tag.update",
              id: tag.id,
              baseRevision: tag.revision,
              changes: { color: c },
            })
          }
        />
      ))}
    </div>
  );
}

function TagFields(props: { readonly tag: Tag }) {
  const { actions, t, canChange } = useUi();
  const { tag } = props;
  return (
    <div class="mls-kv">
      <span>{t("tags.name")}</span>
      <input
        type="text"
        key={`${tag.id}:${String(tag.revision)}`}
        aria-label={t("tags.name")}
        defaultValue={tag.name}
        disabled={!canChange}
        onChange={(e) => {
          const name = e.currentTarget.value.trim();
          if (name && name !== tag.name)
            void actions.op({
              op: "tag.update",
              id: tag.id,
              baseRevision: tag.revision,
              changes: { name },
            });
        }}
      />
      <span>{t("tags.colour")}</span>
      <Swatches tag={tag} />
    </div>
  );
}

function TagEdit(props: { readonly tag: Tag }) {
  const { state, store, actions, t, ports, canChange } = useUi();
  const count = useTagCount();
  const { tag } = props;
  const tagged = (id: string): boolean =>
    state.data.library.modules[id]?.tags.includes(tag.id) ?? false;
  const remove = async (): Promise<void> => {
    if (!(await ports.confirm(t("tags.deleteConfirm", { name: tag.name }))))
      return;
    void actions.op({
      op: "tag.delete",
      id: tag.id,
      baseRevision: tag.revision,
    });
    store.set({ side: { kind: "tags" } });
  };
  return (
    <>
      <TagFields tag={tag} />
      <div class="mls-chg">
        <h4>
          <span>
            {t("tags.modules", { name: tag.name, n: String(count(tag.id)) })}
          </span>
          {canChange ? (
            <button
              type="button"
              class="ml-link"
              onClick={() => void actions.guard(remove)}
            >
              {t("tags.delete")}
            </button>
          ) : null}
        </h4>
        <ModuleChecks
          isOn={tagged}
          onToggle={(id, on) =>
            void actions.op({
              op: "module.setTags",
              moduleIds: [id],
              add: on ? [tag.id] : [],
              remove: on ? [] : [tag.id],
            })
          }
        />
      </div>
    </>
  );
}

export function TagsPanel(props: { readonly id: string | undefined }) {
  const { state, t } = useUi();
  const { tags } = state.data.library;
  const current = tags.find((x) => x.id === props.id) ?? tags[0];
  return (
    <PanelFrame title={t("tags.title")} label={t("tags.title")}>
      <TagList current={current} />
      {current ? <TagEdit key={current.id} tag={current} /> : null}
    </PanelFrame>
  );
}
