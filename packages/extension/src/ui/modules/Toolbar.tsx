// View toggle (S-8), search (S-4), tag AND/OR (S-3) and filter state,
// and the switch to the new Setup page.
import { allowsChanges } from "../../adapters/select.ts";
import { Icon } from "../common/widgets.tsx";
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

/** Opt-in until the new page does everything; safe mode never offers it. */
function TryShell() {
  const { state, actions, t } = useUi();
  if (!allowsChanges(state.adapter) || state.data.prefs.newSetupPage)
    return null;
  return (
    <button
      type="button"
      class="ml-try-shell"
      onClick={() => void actions.setPref("newSetupPage", true)}
    >
      <Icon name="wand-magic-sparkles" />
      {t("shell.try")}
    </button>
  );
}

export function Toolbar(props: { readonly model: ModulesModel }) {
  const { state } = useUi();
  return (
    <div class="ml-toolbar">
      <ViewToggle />
      {state.view === "organised" ? <Filters model={props.model} /> : null}
      <TryShell />
    </div>
  );
}
