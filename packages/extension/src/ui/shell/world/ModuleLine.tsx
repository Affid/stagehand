// One module on one line (View options › List), as the prototype: switch,
// name (opens the details), a risk or note mark, tag dots, and the change.
import { useUi } from "../../context.ts";
import { COMPANION_ID } from "../../model/preview.ts";
import type { WorldModuleRow } from "../../model/world-modules.ts";
import type { SectionsProps } from "./ModuleSections.tsx";
import { whyLine } from "./why.ts";

const MAX_DOTS = 3;

/** A risk mark, a note mark and up to three tag dots. */
function Marks(props: { readonly row: WorldModuleRow }) {
  const { state, t } = useUi();
  const { row } = props;
  const meta = state.data.library.modules[row.pkg.id];
  const tags = (meta?.tags ?? []).flatMap(
    (id) => state.data.library.tags.find((x) => x.id === id) ?? [],
  );
  const note = meta?.note.trim();
  return (
    <>
      {row.risk ? (
        <i
          class="fa-solid fa-code-branch mlc-warn"
          title={t("wp.why.unverifiedAny")}
          aria-label={t("wp.why.unverifiedAny")}
        />
      ) : null}
      {note ? (
        <i
          class="fa-solid fa-note-sticky mlc-note"
          title={note}
          aria-label={note}
        />
      ) : null}
      {tags.length ? (
        <span class="dots" title={tags.map((x) => x.name).join(", ")}>
          {tags.slice(0, MAX_DOTS).map((x) => (
            <i key={x.id} class="ml-dot" style={{ "--ml-c": x.color }} />
          ))}
        </span>
      ) : null}
    </>
  );
}

export function ModuleLine(props: {
  readonly row: WorldModuleRow;
  readonly p: SectionsProps;
}) {
  const { state, store, t, canChange } = useUi();
  const { row, p } = props;
  const { pkg } = row;
  const viewing = state.panel === pkg.id;
  const cls = [
    "mlc-row",
    row.next ? "on" : "off",
    row.delta === "on" ? "plus" : row.delta === "off" ? "minus" : "",
    row.problem ? "prob" : "",
    viewing ? "viewing" : "",
  ].join(" ");
  return (
    <li
      class={cls}
      data-module={pkg.id}
      title={row.problem ? whyLine(row, p.why).text : undefined}
    >
      <input
        type="checkbox"
        role="switch"
        class="mls-switch"
        checked={row.next}
        disabled={pkg.id === COMPANION_ID || !canChange}
        aria-label={t("wp.switch", { module: pkg.title, world: p.world.title })}
        onClick={(e) => {
          e.preventDefault();
          p.onFlip(pkg.id, !row.next);
        }}
      />
      <button
        type="button"
        class="t"
        aria-expanded={viewing}
        onClick={() => store.set({ panel: viewing ? null : pkg.id })}
      >
        {pkg.title}
      </button>
      <Marks row={row} />
      {row.delta ? <span class="d">{t(`wp.delta.${row.delta}`)}</span> : null}
    </li>
  );
}
