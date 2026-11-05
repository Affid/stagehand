// The preset editor's module list: filterable checkboxes over installed
// modules, with a warning for chosen modules that aren't installed.
import { useMemo, useState } from "preact/hooks";
import { useUi } from "../context.ts";
import { sortByTitle } from "../model/modules.ts";

const COMPANION = "module-library";

export function ModuleChecklist(props: {
  readonly chosen: readonly string[];
  readonly onToggle: (id: string) => void;
}) {
  const { state, t } = useUi();
  const [query, setQuery] = useState("");
  const installed = useMemo(
    () => sortByTitle(state.data.setup?.modules ?? []),
    [state.data.setup],
  );
  const missing = props.chosen.filter(
    (m) => !installed.some((p) => p.id === m),
  );
  const shown = installed.filter(
    (m) =>
      m.id !== COMPANION &&
      `${m.title} ${m.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <fieldset class="ml-field">
      <legend>{t("preset.modules", { n: props.chosen.length })}</legend>
      {missing.length > 0 ? (
        <p class="ml-warn-text">
          {t("preset.notInstalled", { n: missing.length })}
        </p>
      ) : null}
      <input
        type="search"
        placeholder={t("preset.filter")}
        aria-label={t("preset.filter")}
        value={query}
        onInput={(e) => setQuery(e.currentTarget.value)}
      />
      <ul class="ml-checklist">
        {shown.map((m) => (
          <li key={m.id}>
            <label>
              <input
                type="checkbox"
                checked={props.chosen.includes(m.id)}
                onChange={() => props.onToggle(m.id)}
              />
              <span>{m.title}</span> <span class="ml-id">{m.id}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
