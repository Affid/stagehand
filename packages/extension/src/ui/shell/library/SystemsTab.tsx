// The Library's Systems tab, as the prototype's system cards: the name with
// Foundry's star, lock and an update; which worlds use it (or that none
// does, so it is safe to uninstall); version and authors. The name opens
// the system's panel.
import type { SystemInfo } from "@module-library/shared/world";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { plural } from "../../i18n.ts";
import { worldsUsing } from "../../model/systems.ts";
import { updateFor } from "../../model/updates.ts";

function Marks(props: { readonly s: SystemInfo }) {
  const { state, page, t, canChange } = useUi();
  const { s } = props;
  const update = updateFor(state.updates.system, s);
  return (
    <>
      {s.favorite ? (
        <i
          class="fa-solid fa-star mlw-fav"
          title={t("lib.favourite")}
          aria-label={t("lib.favourite")}
        />
      ) : null}
      {s.locked ? (
        <i
          class="fa-solid fa-lock mlw-lock"
          title={t("lib.locked")}
          aria-label={t("lib.locked")}
        />
      ) : null}
      {update ? (
        <button
          type="button"
          class="mlw-upd"
          disabled={!canChange}
          title={t("lib.updateFrom", { version: s.version })}
          aria-label={t("lib.updateTo", { title: s.title, version: update })}
          onClick={() =>
            page.foundryAction({
              action: "updatePackage",
              packageType: "system",
              id: s.id,
            })
          }
        >
          <Icon name="arrow-up" />
          {update}
        </button>
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
    <li class={`mll-card${open ? " viewing" : ""}`} data-system={s.id}>
      <div class="l1">
        <button
          type="button"
          class="t"
          aria-expanded={open}
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
          v{s.version}
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
  if (!systems.length) return <p class="ml-empty">{t("lib.noSystems")}</p>;
  return (
    <ol class="mlw-grid mll-systems">
      {systems.map((s) => (
        <SysCard key={s.id} s={s} />
      ))}
    </ol>
  );
}
