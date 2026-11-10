// New modules since the Library was last sorted (prototype intakeBand):
// Sort them opens the New modules panel; Later leaves them in Unfiled and
// stops marking them.
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import { isCompact, useLayout } from "../../phone/layout.ts";

/** On a phone: one line, "3 new modules to sort", Sort and × (Later). */
function Short(props: { readonly fresh: readonly string[] }) {
  const { store, actions, t, canChange } = useUi();
  const { fresh } = props;
  return (
    <div class="sts-intake-band stp-intake">
      <Icon name="box-open" />
      <span>
        <b>{plural(t, "stp.toSort", fresh.length)}</b>
      </span>
      <button
        type="button"
        class="bright"
        onClick={() => store.set({ side: { kind: "intake" }, panel: null })}
      >
        {t("intake.sort")}
      </button>
      {canChange ? (
        <button
          type="button"
          class="icon"
          aria-label={t("stp.sortLater")}
          title={t("stp.sortLater")}
          onClick={() => {
            void actions.markSorted([...fresh]);
            actions.notify("info", t("intake.laterDone"));
          }}
        >
          <Icon name="xmark" />
        </button>
      ) : null}
    </div>
  );
}

export function IntakeBand() {
  const { state, store, actions, t, canChange } = useUi();
  const compact = isCompact(useLayout());
  const fresh = state.data.fresh;
  if (!fresh.length) return null;
  if (compact) return <Short fresh={fresh} />;
  const titles = (state.data.setup?.modules ?? [])
    .filter((m) => fresh.includes(m.id))
    .map((m) => m.title);
  return (
    <div class="sts-intake-band">
      <Icon name="box-open" />
      <span>
        {plural(t, "intake.band", fresh.length)}{" "}
        {titles.flatMap((x, i) => [
          i ? ", " : "",
          <b key={`${x}:${String(i)}`}>{x}</b>,
        ])}
        . {t("intake.bandRest")}
      </span>
      <button
        type="button"
        class="bright"
        onClick={() => store.set({ side: { kind: "intake" }, panel: null })}
      >
        <Icon name="wand-magic-sparkles" />
        {t("intake.sort")}
      </button>
      {canChange ? (
        <button
          type="button"
          onClick={() => {
            void actions.markSorted([...fresh]);
            actions.notify("info", t("intake.laterDone"));
          }}
        >
          {t("intake.later")}
        </button>
      ) : null}
    </div>
  );
}
