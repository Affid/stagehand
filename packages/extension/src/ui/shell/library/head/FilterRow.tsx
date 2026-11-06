// The filter, and Foundry's own Install and Update All for modules or
// systems (prototype controls row).
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";

export function FilterRow(props: {
  readonly kind: "module" | "system";
  readonly count: number;
}) {
  const { state, store, page, t, canChange } = useUi();
  const label = t(`lib.filter.${props.kind}`, { n: String(props.count) });
  return (
    <header class="controls flexrow mll-controls">
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
    </header>
  );
}
