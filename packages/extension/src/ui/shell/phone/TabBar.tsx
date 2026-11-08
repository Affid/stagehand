// The tab bar at the foot of the phone and tablet layouts: Worlds, Library,
// Backups, Configuration, with badges for worlds with queued changes and for
// newly installed modules (mockup: design/setup-page/src/_phone.js).
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { plural } from "../../i18n.ts";
import { worldRow } from "../../model/worlds.ts";
import type { Layout } from "./layout.ts";
import {
  currentTab,
  navOf,
  PHONE_TABS,
  type PhoneTab,
  tabPatch,
} from "./nav.ts";

const ICON: Readonly<Record<PhoneTab, string>> = {
  worlds: "globe",
  library: "books",
  backups: "floppy-disks",
  config: "gears",
};

/** The count as shown; the button's name says what it counts. */
function Badge(props: { readonly n: number; readonly label: string }) {
  if (!props.n) return null;
  return (
    <>
      <b class="pip" aria-hidden="true">
        {props.n}
      </b>
      <span class="ml-sr-only">, {props.label}</span>
    </>
  );
}

function useBadges(): Readonly<Partial<Record<PhoneTab, [number, string]>>> {
  const { state, t } = useUi();
  const worlds = state.data.setup?.worlds ?? [];
  const queued = worlds.filter(
    (w) => worldRow(state.data, w).pending.length > 0,
  ).length;
  const fresh = state.data.fresh.length;
  return {
    worlds: [queued, plural(t, "mlp.queuedWorlds", queued)],
    library: [fresh, plural(t, "mlp.newModules", fresh)],
  };
}

export function TabBar(props: { readonly layout: Layout }) {
  const { state, store, t } = useUi();
  const on = currentTab(navOf(state), state.route);
  const badges = useBadges();
  return (
    <nav class="mlp-tabs" aria-label={t("mlp.tabs")}>
      {PHONE_TABS.map((tab) => {
        const badge = badges[tab];
        return (
          <button
            key={tab}
            type="button"
            class={on === tab ? "on" : ""}
            aria-current={on === tab ? "page" : undefined}
            onClick={() => store.set(tabPatch(tab, props.layout, store.get()))}
          >
            <Icon name={ICON[tab]} />
            <span>{t(`mlp.tab.${tab}`)}</span>
            {badge ? <Badge n={badge[0]} label={badge[1]} /> : null}
          </button>
        );
      })}
    </nav>
  );
}
