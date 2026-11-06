// One release's notes in Release history (prototype updHistoryView): its
// title, date, how many changes, and every section open.
import { useMemo } from "preact/hooks";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import { entriesOf, type Notes, parseNotes } from "./notes.ts";
import { Intro, Items } from "./NotesView.tsx";
import type { ReleaseItem } from "./releases.ts";
import type { NotesState } from "./useHistory.ts";

function Body(props: { readonly notes: Notes }) {
  const { notes } = props;
  return (
    <>
      <Intro blocks={notes.intro} />
      {notes.sections.map((s) => (
        <section key={s.h} class={`mlu-sec ${s.kind}`}>
          <h3 class="plain">
            {s.h} <span class="c">{entriesOf(s).length}</span>
          </h3>
          {s.items.length ? <Items items={s.items} /> : null}
          {s.areas.map((a) => (
            <div key={a.h}>
              <h4>{a.h}</h4>
              <Items items={a.items} />
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

function Failed(props: {
  readonly error: string;
  readonly onRetry: () => void;
}) {
  const { t } = useUi();
  return (
    <div class="mlu-hask">
      <p>{t("up.hist.failed", { error: props.error || "?" })}</p>
      <button type="button" onClick={props.onRetry}>
        {t("up.hist.again")}
      </button>
    </div>
  );
}

export function HistoryNotes(props: {
  readonly r: ReleaseItem;
  readonly state: NotesState | undefined;
  readonly onRetry: () => void;
}) {
  const { t } = useUi();
  const { r, state } = props;
  const html = state?.kind === "ready" ? state.html : "";
  const notes = useMemo(() => parseNotes(html), [html]);
  const count = notes.sections.reduce((n, s) => n + entriesOf(s).length, 0);
  const title = notes.title;
  return (
    <div class="mlu-hnotes">
      <div class="mlu-hhead">
        <strong>{title || t("up.hist.release", { version: r.version })}</strong>
        <span>
          {r.date}
          {state?.kind === "ready"
            ? ` · ${plural(t, "up.hist.changes", count)}`
            : ""}
          {" · "}
          <a
            href={`https://foundryvtt.com/releases/${r.version}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("up.hist.onSite")}
          </a>
        </span>
      </div>
      {state?.kind === "ready" ? (
        <Body notes={notes} />
      ) : state?.kind === "error" ? (
        <Failed error={state.error} onRetry={props.onRetry} />
      ) : (
        <p class="ml-muted" role="status">
          {t("up.hist.loading")}
        </p>
      )}
    </div>
  );
}
