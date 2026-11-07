// A system's details, as the prototype's systemPanel: the worlds that use
// it (each opens its page; none means safe to uninstall), then its Package
// details and Foundry's own settings and actions.
import type { SystemInfo } from "@module-library/shared/world";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import { asPackage, worldsUsing } from "../../../model/systems.ts";
import { PackageTab } from "../PackageTab.tsx";
import { PanelFrame } from "./PanelFrame.tsx";
import { shownVersion } from "@module-library/shared/version";

function UsedBy(props: { readonly s: SystemInfo }) {
  const { state, store, t } = useUi();
  const worlds = worldsUsing(state.data.setup?.worlds ?? [], props.s.id);
  return (
    <div class="mls-chg mls-usedby">
      <h4>
        <span>{plural(t, "sys.usedBy", worlds.length)}</span>
      </h4>
      <ul>
        {worlds.length ? (
          worlds.map((w) => (
            <li key={w.id}>
              <span class="s">
                <Icon name="globe" />
              </span>
              <span>{w.title}</span>
              <button
                type="button"
                class="ml-link x"
                aria-label={t("sys.openWorld", { title: w.title })}
                onClick={() =>
                  store.set({
                    route: { kind: "world", worldId: w.id },
                    side: null,
                  })
                }
              >
                {t("sys.open")}
              </button>
            </li>
          ))
        ) : (
          <li class="none">{t("sys.unused")}</li>
        )}
      </ul>
    </div>
  );
}

export function SystemPanel(props: { readonly id: string }) {
  const { state, t } = useUi();
  const s = state.data.setup?.systems.find((x) => x.id === props.id);
  if (!s) return null;
  const authors = (s.authors ?? []).map((a) => a.name).join(", ");
  return (
    <PanelFrame title={t("sys.title")} label={s.title}>
      <div class="mls-modhead">
        <h3>{s.title}</h3>
        <div class="sub">
          {[s.id, shownVersion(s.version), authors].filter(Boolean).join(" · ")}
        </div>
      </div>
      <UsedBy s={s} />
      <PackageTab pkg={asPackage(s)} kind="system" />
    </PanelFrame>
  );
}
