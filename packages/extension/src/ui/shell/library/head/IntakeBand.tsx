// New modules since the Library was last sorted (prototype intakeBand):
// Sort them opens the New modules panel; Later leaves them in Unfiled and
// stops marking them.
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";

export function IntakeBand() {
  const { state, store, actions, t, canChange } = useUi();
  const fresh = state.data.fresh;
  if (!fresh.length) return null;
  const titles = (state.data.setup?.modules ?? [])
    .filter((m) => fresh.includes(m.id))
    .map((m) => m.title);
  return (
    <div class="mls-intake-band">
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
