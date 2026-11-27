// The Library's Systems tab, as the prototype's system cards: the name with
// Foundry's star, lock and an update; which worlds use it (or that none
// does, so it is safe to uninstall); version and authors. The name opens
// the system's panel.
import type { SystemInfo } from "@stagehand/shared/world";
import { Icon } from "@stagehand/ui/common/widgets.tsx";
import { useUi } from "../../context.ts";
import { plural } from "@stagehand/ui/i18n.ts";
import { worldsUsing } from "../../model/systems.ts";
import { markFor } from "../../model/package-updates.ts";
import { installOf } from "../../tasks.ts";
import { waitingIn } from "../../package-install.ts";
import { checkUnlessKnown } from "../../package-check.ts";
import { hasUpdatesTab } from "./head/LibraryTabs.tsx";
import { useCheckDeps } from "./updates/useCheckDeps.ts";
import { InstallChip } from "./InstallChip.tsx";
import { shownVersion } from "@stagehand/shared/version";

/** A newer version: its panel opens and checks it (or Foundry's own update). */
function SysUpdateChip(props: {
  readonly s: SystemInfo;
  readonly version: string;
}) {
  const { state, store, page, t, canChange } = useUi();
  const checks = useCheckDeps();
  const { s } = props;
  return (
    <button
      type="button"
      class="stw-upd"
      disabled={!canChange}
      title={t("lib.updateFrom", { version: s.version })}
      aria-label={t("lib.updateTo", { title: s.title, version: props.version })}
      onClick={() => {
        if (hasUpdatesTab(state)) {
          store.set({ side: { kind: "system", id: s.id }, panel: null });
          checkUnlessKnown(checks, "system", s.id);
        } else
          page.foundryAction({
            action: "updatePackage",
            packageType: "system",
            id: s.id,
          });
      }}
    >
      <Icon name="arrow-up" />
      {props.version}
    </button>
  );
}

function Marks(props: { readonly s: SystemInfo }) {
  const { state, t } = useUi();
  const { s } = props;
  const update = markFor(state, "system", s);
  const installing = installOf(state, s.id);
  const waiting = waitingIn(state, s.id);
  return (
    <>
      {s.favorite ? (
        <i
          class="fa-solid fa-star stw-fav"
          title={t("lib.favourite")}
          aria-label={t("lib.favourite")}
        />
      ) : null}
      {s.locked ? (
        <i
          class="fa-solid fa-lock stw-lock"
          title={t("lib.locked")}
          aria-label={t("lib.locked")}
        />
      ) : null}
      {installing || waiting ? (
        <InstallChip task={installing} waiting={waiting} title={s.title} />
      ) : update ? (
        <SysUpdateChip s={s} version={update} />
      ) : null}
    </>
  );
}

function SysCard(props: { readonly s: SystemInfo }) {
  const { state, store, t } = useUi();
  const { s } = props;
  const used = worldsUsing(state.data.setup?.worlds ?? [], s.id).length;
  const open = state.side?.kind === "system" && state.side.id === s.id;
  const authors = (s.authors ?? []).map((a) => a.name).join(", ");
  return (
    <li class={`stl-card${open ? " viewing" : ""}`} data-system={s.id}>
      <div class="l1">
        <button
          type="button"
          class="t"
          aria-expanded={open}
          title={s.title}
          onClick={() =>
            store.set({
              side: open ? null : { kind: "system", id: s.id },
              panel: null,
            })
          }
        >
          {s.title}
        </button>
        <Marks s={s} />
      </div>
      <div class={`l2${used ? "" : " desc"}`}>
        <Icon name="globe" />
        <span>
          {used ? plural(t, "lib.usedBy", used) : t("lib.usedByNone")}
        </span>
      </div>
      <div class="l3">
        <span class="tg" />
        <span class="meta">
          {shownVersion(s.version)}
          {authors ? ` · ${authors}` : ""}
        </span>
      </div>
    </li>
  );
}

export function SystemsTab() {
  const { state, t } = useUi();
  const q = state.filter.text.trim().toLowerCase();
  const systems = [...(state.data.setup?.systems ?? [])]
    .filter((s) => !q || s.title.toLowerCase().includes(q))
    .sort((a, b) => a.title.localeCompare(b.title));
  if (!systems.length) return <p class="st-empty">{t("lib.noSystems")}</p>;
  return (
    <ol class="stw-grid stl-systems">
      {systems.map((s) => (
        <SysCard key={s.id} s={s} />
      ))}
    </ol>
  );
}
