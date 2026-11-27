// The filter, and Foundry's own Install (and Update All, where our Updates
// tab isn't: safe mode) for modules or
// systems (prototype controls row).
import { Icon } from "@stagehand/ui/common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { hasUpdatesTab } from "./LibraryTabs.tsx";

/** Foundry's own Update All (safe mode, where our Updates tab isn't). */
function UpdateAll(props: { readonly kind: "module" | "system" }) {
  const { page, t, canChange } = useUi();
  return (
    <button
      type="button"
      disabled={!canChange}
      onClick={() =>
        page.foundryAction({ action: "updateAll", packageType: props.kind })
      }
    >
      <Icon name="cloud-arrow-down" />
      <span>{t("lib.updateAll")}</span>
    </button>
  );
}

export function FilterRow(props: {
  readonly kind: "module" | "system";
  readonly count: number;
}) {
  const { state, store, page, t, canChange } = useUi();
  const label = t(`lib.filter.${props.kind}`, { n: String(props.count) });
  return (
    <header class="controls flexrow stl-controls">
      <label class="filter search">
        <input
          type="search"
          aria-label={label}
          placeholder={label}
          value={state.filter.text}
          onInput={(e) => {
            const text = e.currentTarget.value;
            // A hidden card must not stay selected for a bulk action.
            store.set((s) => ({
              filter: { ...s.filter, text },
              selection: [],
            }));
          }}
        />
      </label>
      <button
        type="button"
        disabled={!canChange}
        onClick={() =>
          page.foundryAction({
            action: "installPackage",
            packageType: props.kind,
          })
        }
      >
        <Icon name="download" />
        <span>{t(`lib.install.${props.kind}`)}</span>
      </button>
      {hasUpdatesTab(state) ? null : <UpdateAll kind={props.kind} />}
    </header>
  );
}
