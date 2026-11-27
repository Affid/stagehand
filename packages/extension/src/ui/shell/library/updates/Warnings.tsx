// What an update would leave unmet (updates plan, phase 4), worked out by
// the shared model before anything installs: a row's warnings, its notes
// when another ticked update meets its need, and the fixes as buttons in
// the row's right-hand column, naming what they tick.
import {
  type Row,
  type Warning,
  warningsOf,
} from "@stagehand/shared/updates/model";
import { plural, type Translate } from "@stagehand/ui/i18n.ts";
import { useUi } from "../../../context.ts";
import { updatesInput } from "../../../model/package-updates.ts";
import { setTicks, tickedIds } from "../../../package-install.ts";
import type { UiState } from "../../../store.ts";

type Titles = (id: string) => string;

export function titlesOf(state: Pick<UiState, "data">): Titles {
  const setup = state.data.setup;
  const all = [...(setup?.modules ?? []), ...(setup?.systems ?? [])];
  return (id) => all.find((p) => p.id === id)?.title ?? id;
}

export function warningText(
  t: Translate,
  w: Warning,
  title: Titles,
  target: string,
): string {
  if (w.kind === "impact") {
    const names = w.dependents
      .map((d) =>
        t(d.fix ? "upd.warn.fits" : "upd.warn.noUpdate", {
          title: title(d.id),
        }),
      )
      .join(", ");
    return plural(t, "upd.warn.impact", w.dependents.length, {
      title: title(target),
      max: w.dependents[0]?.maximum ?? "",
      names,
    });
  }
  const key = `upd.warn.${w.kind === "needs" ? "needs" : "system"}${w.minimum ? "Min" : "Max"}`;
  return t(key, {
    title: title(w.id),
    min: w.minimum ?? "",
    max: w.maximum ?? "",
    have: w.have,
  });
}

/** The updates that would meet a warning, by id. */
export const fixesOf = (w: Warning): string[] =>
  w.kind === "impact"
    ? w.dependents.flatMap((d) => (d.fix ? [d.fix] : []))
    : w.fix
      ? [w.fix]
      : [];

/** The last run's failure for this package: shown until the next run. */
export function lastFailure(
  state: Pick<UiState, "install">,
  id: string,
): { readonly error?: string } | undefined {
  return state.install.last?.failed.find((f) => f.id === id);
}

/** "The update failed", with Foundry's reason when it gave one. */
export function FailedLine(props: { readonly error?: string | undefined }) {
  const { t } = useUi();
  return (
    <div class="spu-warn failed" role="status">
      <i class="fa-solid fa-circle-xmark" aria-hidden="true" />
      <span>
        {props.error
          ? t("upd.failed", { error: props.error })
          : t("upd.failedNoReason")}
      </span>
    </div>
  );
}

/** A row's warnings as things stand: with what is ticked, and the row itself. */
export function rowWarnings(
  state: Pick<UiState, "data" | "check" | "install">,
  row: Row,
): Warning[] {
  const ticked = tickedIds(state);
  if (row.section === "ready" && !ticked.includes(row.id)) return [];
  return warningsOf(updatesInput(state), row.id, new Set([...ticked, row.id]));
}

/** A ticked row's needs that another ticked update meets: it updates first. */
function notesOf(
  state: Pick<UiState, "data" | "check" | "install">,
  row: Row,
): { id: string; version: string }[] {
  const ticked = new Set(tickedIds(state));
  if (!ticked.has(row.id)) return [];
  const input = updatesInput(state);
  const needs = [...(row.check.requires ?? []), ...(row.check.systems ?? [])];
  return needs.flatMap((n) => {
    if (!ticked.has(n.id) || !n.minimum) return [];
    const unmet = warningsOf(input, row.id, new Set([row.id])).some(
      (w) => w.kind !== "impact" && w.id === n.id,
    );
    return unmet ? [{ id: n.id, version: n.minimum }] : [];
  });
}

export function RowWarnings(props: { readonly row: Row }) {
  const { state, t } = useUi();
  const title = titlesOf(state);
  const warnings = rowWarnings(state, props.row);
  const notes = notesOf(state, props.row);
  const failed = lastFailure(state, props.row.id);
  return (
    <>
      {failed ? <FailedLine error={failed.error} /> : null}
      {warnings.map((w, i) => (
        <div key={`w${String(i)}`} class="spu-warn">
          <i class="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <span>{warningText(t, w, title, props.row.id)}</span>
        </div>
      ))}
      {notes.map((n) => (
        <div key={`n${n.id}`} class="spu-note">
          <i class="fa-solid fa-link" aria-hidden="true" />
          <span>
            {t("upd.note.first", { title: title(n.id), version: n.version })}
          </span>
        </div>
      ))}
    </>
  );
}

/** The fixes for a row's warnings: each ticks the update that meets it. */
export function FixButtons(props: { readonly row: Row }) {
  const { state, store, t, canChange } = useUi();
  if (state.install.running) return null;
  const title = titlesOf(state);
  const fixes = [...new Set(rowWarnings(state, props.row).flatMap(fixesOf))];
  if (!fixes.length) return null;
  return (
    <>
      {fixes.map((id) => (
        <button
          key={id}
          type="button"
          class="spu-act"
          title={t("upd.fix.hint")}
          disabled={!canChange}
          onClick={() => {
            setTicks(store, [...new Set([...tickedIds(store.get()), id])]);
          }}
        >
          <i class="fa-solid fa-check fa-fw" aria-hidden="true" />
          {t("upd.fix.tick", { title: title(id) })}
        </button>
      ))}
    </>
  );
}
