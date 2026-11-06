// Modules installed since they were last sorted: give each a folder and
// tags beside the cards, then mark it done (SETUP-REDESIGN.md: intake).
import { useUi } from "../../context.ts";
import { FolderField, TagsField } from "./LibraryTab.tsx";

export function IntakePanel(props: { readonly onClose: () => void }) {
  const { state, actions, t, canChange } = useUi();
  const fresh = state.data.fresh;
  const modules = (state.data.setup?.modules ?? []).filter((m) =>
    fresh.includes(m.id),
  );
  return (
    <aside class="mll-side mll-panel ml-app" aria-label={t("intake.title")}>
      <header class="mll-panel-head">
        <h3>{t("intake.title")}</h3>
      </header>
      <p class="ml-hint">{t("intake.lead")}</p>
      <ul class="mll-intake-list">
        {modules.map((m) => (
          <li key={m.id}>
            <strong>{m.title}</strong>
            <FolderField id={m.id} />
            <TagsField id={m.id} />
            {canChange ? (
              <button
                type="button"
                aria-label={t("intake.doneWith", { module: m.title })}
                onClick={() => void actions.markSorted([m.id])}
              >
                {t("intake.done")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {canChange && modules.length ? (
        <button
          type="button"
          class="ml-primary"
          onClick={() => {
            props.onClose();
            void actions.markSorted(fresh);
          }}
        >
          {t("intake.all")}
        </button>
      ) : null}
    </aside>
  );
}
