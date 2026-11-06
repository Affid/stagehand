// The Library's Systems tab: each installed game system with its version and
// the worlds that use it, narrowed by the filter.
import { useUi } from "../../context.ts";
import { plural } from "../../i18n.ts";

export function SystemsTab() {
  const { state, t } = useUi();
  const setup = state.data.setup;
  const q = state.filter.text.trim().toLowerCase();
  const systems = [...(setup?.systems ?? [])]
    .filter((s) => !q || s.title.toLowerCase().includes(q))
    .sort((a, b) => a.title.localeCompare(b.title));
  if (!systems.length) return <p class="ml-empty">{t("lib.noSystems")}</p>;
  const used = (id: string): number =>
    (setup?.worlds ?? []).filter((w) => w.system === id).length;
  return (
    <ol class="mlw-grid mll-systems">
      {systems.map((s) => (
        <li key={s.id} class="mll-card" data-system={s.id}>
          <div class="l1">
            <strong class="title">{s.title}</strong>
          </div>
          <div class="l2">
            {s.id}
            {s.version ? ` · v${s.version}` : ""}
          </div>
          <div class="l3">
            <span class="meta">
              {used(s.id)
                ? plural(t, "lib.usedBy", used(s.id))
                : t("lib.usedByNone")}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
