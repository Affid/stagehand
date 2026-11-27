// The Library's Updates tab (docs/UPDATES-PLAN.md): our own check of every
// package, and what it found in sections, before anything installs. Opening
// the tab checks again when the last check is missing or over an hour old.
import type { Row, Section } from "@stagehand/shared/updates/model";
import { usageCounts } from "@stagehand/shared/organise/usage";
import { plural } from "@stagehand/ui/i18n.ts";
import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { useUi } from "../../../context.ts";
import {
  hasChecked,
  isStale,
  rowsFor,
} from "../../../model/package-updates.ts";
import { checkAll } from "../../../package-check.ts";
import { UpdateRow } from "./UpdateRow.tsx";
import { UpdatesHead } from "./UpdatesHead.tsx";
import { useCheckDeps } from "./useCheckDeps.ts";

export const SECTIONS: readonly Section[] = [
  "ready",
  "attention",
  "blocked",
  "noaccess",
  "error",
];
/** A long list of failed checks starts folded (no answer from anywhere). */
const FOLD_ERRORS_OVER = 5;

export interface SectionsProps {
  readonly rows: readonly Row[];
  /** Draws one row; the tab's own by default. */
  readonly render?: (row: Row, usage: number | undefined) => ComponentChildren;
  /** Extra controls in a section's head (phase 3: Tick all). */
  readonly headExtra?: (
    section: Section,
    rows: readonly Row[],
  ) => ComponentChildren;
}

function SectionBlock(props: {
  readonly section: Section;
  readonly rows: readonly Row[];
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly usage: Readonly<Record<string, number>>;
  readonly parent: SectionsProps;
}) {
  const { t } = useUi();
  const { section, rows, open, usage, parent } = props;
  return (
    <li class={`spu-sec ${section}`}>
      <div class="spu-sh">
        <button type="button" aria-expanded={open} onClick={props.onToggle}>
          <i
            class={`fa-solid fa-angle-${open ? "down" : "right"}`}
            aria-hidden="true"
          />
          <span class="n">{t(`upd.sec.${section}`)}</span>
          <span class="c">{rows.length}</span>
        </button>
        <span class="st-spacer" />
        {parent.headExtra?.(section, rows)}
      </div>
      {open ? (
        <ul class="spu-rows">
          {rows.map((r) =>
            parent.render ? (
              parent.render(r, usage[r.id])
            ) : (
              <UpdateRow key={r.id} row={r} usage={usage[r.id]} />
            ),
          )}
        </ul>
      ) : null}
    </li>
  );
}

export function Sections(props: SectionsProps) {
  const { state } = useUi();
  const usage = useMemo(
    () => usageCounts(Object.values(state.data.snapshots)),
    [state.data.snapshots],
  );
  const errors = props.rows.filter((r) => r.section === "error").length;
  const [closed, setClosed] = useState<ReadonlySet<Section>>(
    () => new Set(errors > FOLD_ERRORS_OVER ? (["error"] as const) : []),
  );
  const toggle = (s: Section): void => {
    setClosed((c) => {
      const next = new Set(c);
      if (!next.delete(s)) next.add(s);
      return next;
    });
  };
  return (
    <>
      {SECTIONS.map((s) => {
        const rows = props.rows.filter((r) => r.section === s);
        return rows.length ? (
          <SectionBlock
            key={s}
            section={s}
            rows={rows}
            open={!closed.has(s)}
            onToggle={() => toggle(s)}
            usage={usage}
            parent={props}
          />
        ) : null;
      })}
    </>
  );
}

function Locked() {
  const { state, t } = useUi();
  const setup = state.data.setup;
  const locked = [...(setup?.modules ?? []), ...(setup?.systems ?? [])].filter(
    (p) => p.locked,
  );
  if (!locked.length) return null;
  return (
    <li class="spu-locked">
      <i class="fa-solid fa-lock" aria-hidden="true" />
      {plural(t, "upd.locked", locked.length, {
        names: locked.map((p) => p.title).join(", "),
      })}
    </li>
  );
}

export function UpdatesTab(props: { readonly children?: ComponentChildren }) {
  const { state, t, canChange } = useUi();
  const deps = useCheckDeps();
  useEffect(() => {
    if (
      canChange &&
      !deps.store.get().check.running &&
      isStale(deps.store.get(), Date.now())
    )
      checkAll(deps);
    // Only when the tab opens.
  }, []);
  const rows = rowsFor(state);
  const empty = !rows.length && !state.check.running && hasChecked(state);
  return (
    <div class="spu">
      <UpdatesHead rows={rows} />
      <ol class="spu-list">
        <Sections rows={rows} />
        {empty ? (
          <li class="spu-empty">
            <i class="fa-solid fa-mug-hot" aria-hidden="true" />
            <p>
              {t("upd.empty", {
                version: state.data.setup?.core.version ?? "",
              })}
            </p>
          </li>
        ) : null}
        <Locked />
      </ol>
      {props.children}
    </div>
  );
}
