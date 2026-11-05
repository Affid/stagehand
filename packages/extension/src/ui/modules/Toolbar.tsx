// View toggle (S-8), search (S-4), tag AND/OR (S-3) and filter state.
import { useUi } from "../context.ts";
import { EMPTY_FILTER } from "../store.ts";
import type { ModulesModel } from "./derived.ts";

function ViewToggle() {
  const { state, store, t } = useUi();
  return (
    <div class="ml-segmented" role="group" aria-label={t("app.name")}>
      {(["organised", "core"] as const).map((v) => (
        <button
          type="button"
          key={v}
          class={state.view === v ? "ml-on" : ""}
          aria-pressed={state.view === v}
          onClick={() => store.set({ view: v })}
        >
          {t(`view.${v}`)}
        </button>
      ))}
    </div>
  );
}

function Filters(props: { readonly model: ModulesModel }) {
  const { state, store, t } = useUi();
  const { filter } = state;
  const setFilter = (change: Partial<typeof filter>): void => {
    store.set((s) => ({ filter: { ...s.filter, ...change }, selection: [] }));
  };
  const clear = (): void => {
    store.set({ filter: EMPTY_FILTER, scope: { kind: "all" }, selection: [] });
  };
  return (
    <>
      <input
        type="search"
        class="ml-search"
        aria-label={t("search.placeholder")}
        placeholder={t("search.placeholder")}
        value={filter.text}
        onInput={(e) => setFilter({ text: e.currentTarget.value })}
      />
      {filter.tags.length > 1 ? (
        <button
          type="button"
          class="ml-chip-button"
          onClick={() =>
            setFilter({ tagOp: filter.tagOp === "and" ? "or" : "and" })
          }
        >
          {t(`filter.tags.${filter.tagOp}`)}
        </button>
      ) : null}
      {props.model.filtered ? (
        <button type="button" class="ml-link" onClick={clear}>
          {t("filter.clear")}
        </button>
      ) : null}
      <span class="ml-count">
        {t("list.count", { n: props.model.visible.length })}
      </span>
    </>
  );
}

export function Toolbar(props: { readonly model: ModulesModel }) {
  const { state } = useUi();
  return (
    <div class="ml-toolbar">
      <ViewToggle />
      {state.view === "organised" ? <Filters model={props.model} /> : null}
    </div>
  );
}
