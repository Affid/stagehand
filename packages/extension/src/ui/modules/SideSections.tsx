// Sidebar sections: smart groups (7.3), tags (S-3), authors (S-7).
import type { Tag } from "@module-library/shared/library/schema";
import { useState } from "preact/hooks";
import { newId, nextColor } from "../actions.ts";
import { safeUrl } from "../common/files.ts";
import { Dot, IconButton, InlineInput } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import type { ModulesModel } from "./derived.ts";

export function GroupList(props: { readonly model: ModulesModel }) {
  const { state, store, t } = useUi();
  return (
    <section class="ml-side-section" aria-label={t("sidebar.groups")}>
      <h3>{t("sidebar.groups")}</h3>
      <ul>
        {props.model.groups.map((g) => {
          const on = state.scope.kind === "group" && state.scope.key === g.key;
          return (
            <li key={g.key} class={`ml-side-item${on ? " ml-on" : ""}`}>
              <button
                type="button"
                class="ml-side-label"
                data-group={g.key}
                onClick={() =>
                  store.set({
                    scope: { kind: "group", key: g.key },
                    selection: [],
                  })
                }
              >
                <span>{t(g.label, g.param ? { param: g.param } : {})}</span>
                <span class="ml-count">{g.moduleIds.length}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TagChip(props: { readonly tag: Tag }) {
  const { state, store, actions, t, canChange } = useUi();
  const { tag } = props;
  const on = state.filter.tags.includes(tag.id);
  const toggle = (): void => {
    store.set((s) => ({
      filter: {
        ...s.filter,
        tags: on
          ? s.filter.tags.filter((x) => x !== tag.id)
          : [...s.filter.tags, tag.id],
      },
      selection: [],
    }));
  };
  const remove = (): void => {
    if (window.confirm(t("tag.deleteConfirm", { name: tag.name })))
      void actions.op({
        op: "tag.delete",
        id: tag.id,
        baseRevision: tag.revision,
      });
  };
  return (
    <li class={`ml-tag-item${on ? " ml-on" : ""}`}>
      <button
        type="button"
        class="ml-tag"
        style={{ borderColor: tag.color }}
        aria-pressed={on}
        onClick={toggle}
      >
        <Dot color={tag.color} />
        {tag.name}
      </button>
      {canChange ? (
        <IconButton icon="xmark" label={t("tag.delete")} onClick={remove} />
      ) : null}
    </li>
  );
}

export function TagList() {
  const { state, actions, t, canChange } = useUi();
  const [creating, setCreating] = useState(false);
  const tags = state.data.library.tags;
  const create = (name: string): void => {
    setCreating(false);
    void actions.op({
      op: "tag.create",
      tag: { id: newId(), name, color: nextColor(tags.length) },
    });
  };
  return (
    <section class="ml-side-section" aria-label={t("sidebar.tags")}>
      <h3>{t("sidebar.tags")}</h3>
      <ul class="ml-tags">
        {tags.map((tag) => (
          <TagChip key={tag.id} tag={tag} />
        ))}
      </ul>
      {creating ? (
        <InlineInput
          initial=""
          label={t("tag.namePrompt")}
          onCommit={create}
          onCancel={() => setCreating(false)}
        />
      ) : null}
      {canChange && !creating ? (
        <button type="button" class="ml-link" onClick={() => setCreating(true)}>
          + {t("tag.new")}
        </button>
      ) : null}
    </section>
  );
}

export function AuthorList(props: { readonly model: ModulesModel }) {
  const { state, store, t } = useUi();
  const [open, setOpen] = useState(false);
  const authors = [...props.model.authors].sort(
    (a, b) => b.moduleIds.length - a.moduleIds.length,
  );
  const shown = open ? authors : authors.slice(0, 8);
  const toggle = (key: string): void => {
    store.set((s) => {
      const has = s.filter.authors.includes(key);
      return {
        filter: { ...s.filter, authors: has ? [] : [key] },
        selection: [],
      };
    });
  };
  return (
    <section class="ml-side-section" aria-label={t("sidebar.authors")}>
      <h3>{t("sidebar.authors")}</h3>
      <ul>
        {shown.map((a) => {
          const url = safeUrl(a.url);
          return (
            <li
              key={a.key}
              class={`ml-side-item${state.filter.authors.includes(a.key) ? " ml-on" : ""}`}
            >
              <button
                type="button"
                class="ml-side-label"
                onClick={() => toggle(a.key)}
              >
                <span>{a.name}</span>
                <span class="ml-count">{a.moduleIds.length}</span>
              </button>
              {url ? (
                <a
                  class="ml-icon"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={url}
                  aria-label={url}
                >
                  <i
                    class="fa-solid fa-arrow-up-right-from-square fa-fw"
                    aria-hidden="true"
                  />
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
      {authors.length > shown.length || open ? (
        <button type="button" class="ml-link" onClick={() => setOpen(!open)}>
          {open ? "−" : `+${String(authors.length - shown.length)}`}
        </button>
      ) : null}
    </section>
  );
}
