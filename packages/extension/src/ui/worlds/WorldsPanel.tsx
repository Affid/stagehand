// The Game Worlds tab's strip above Foundry's own world list: which worlds
// change at their next launch and how (P-5, P-6), which need attention
// (W-2), and the way in to Apply presets. Foundry's list stays the only list.
import { useState } from "preact/hooks";
import { useDismiss } from "../common/popover.ts";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { plural } from "../i18n.ts";
import { effectOf } from "../model/preview.ts";
import { type WorldRow, worldRows } from "../model/worlds.ts";
import { EffectPills } from "./PlanView.tsx";

const ROWS = 3;

function QueuedRow(props: { readonly row: WorldRow }) {
  const { store, t, canChange } = useUi();
  const { world, pending, plan } = props.row;
  return (
    <li class="ml-next-row" data-world={world.id}>
      <span class="ml-next-world">{world.title}</span>
      <span class="ml-next-count">
        {plural(t, "worlds.changes", pending.length)}
      </span>
      {plan ? <EffectPills effect={effectOf(plan)} /> : <span />}
      <button
        type="button"
        class="ml-small"
        aria-label={t("worlds.reviewFor", { world: world.title })}
        onClick={() => store.set({ sheetWorld: world.id })}
      >
        {canChange ? t("worlds.review") : t("worlds.view")}
        <Icon name="chevron-right" />
      </button>
    </li>
  );
}

/** Closes a disclosure menu on Escape or a click outside it. */
function AttentionMenu(props: { readonly rows: readonly WorldRow[] }) {
  const { store, t } = useUi();
  const ref = useDismiss();
  if (props.rows.length === 0) return null;
  return (
    <details class="ml-attention" ref={ref}>
      <summary>
        <Icon name="triangle-exclamation" />
        {plural(t, "worlds.attention", props.rows.length)}
        <Icon name="caret-down" />
      </summary>
      <ul role="list">
        {props.rows.map(({ world, attention }) => (
          <li key={world.id}>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.closest("details")?.removeAttribute("open");
                store.set({ sheetWorld: world.id });
              }}
            >
              <strong>{world.title}</strong>
              <span>{t(`worlds.reason.${attention ?? "stale"}`)}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

function ApplyOrLock() {
  const { state, store, t, canChange } = useUi();
  if (canChange)
    return (
      <button
        type="button"
        class="ml-primary"
        onClick={() => store.set({ apply: { worldId: null } })}
      >
        <Icon name="layer-group" />
        {t("worlds.apply")}
      </button>
    );
  const version = state.data.setup?.core.version ?? "";
  const why =
    state.adapter.status === "safe-mode"
      ? t("notice.safeMode", { version })
      : t("notice.notVerified");
  return (
    <span class="ml-read-only" data-tooltip-text={why} aria-label={why}>
      <Icon name="lock" />
      {t("worlds.readOnly")}
    </span>
  );
}

function Onboarding() {
  const { store, t, canChange } = useUi();
  return (
    <div class="ml-onboard">
      <div>
        <p>{t("worlds.onboard.intro")}</p>
        <ol>
          <li>{t("worlds.onboard.step1")}</li>
          <li>{t("worlds.onboard.step2")}</li>
          <li>{t("worlds.onboard.step3")}</li>
        </ol>
      </div>
      {canChange ? (
        <button
          type="button"
          onClick={() => store.set({ apply: { worldId: null } })}
        >
          <Icon name="layer-group" />
          {t("worlds.onboard.anyway")}
        </button>
      ) : null}
    </div>
  );
}

function QueuedRows(props: { readonly rows: readonly WorldRow[] }) {
  const { t } = useUi();
  const [all, setAll] = useState(false);
  const shown = all ? props.rows : props.rows.slice(0, ROWS);
  return (
    <>
      <ul class="ml-next-rows">
        {shown.map((r) => (
          <QueuedRow key={r.world.id} row={r} />
        ))}
      </ul>
      {props.rows.length > ROWS ? (
        <button
          type="button"
          class="ml-link ml-next-more"
          onClick={() => setAll(!all)}
        >
          {all
            ? t("worlds.less")
            : t("worlds.more", { n: props.rows.length - ROWS })}
        </button>
      ) : null}
    </>
  );
}

export function WorldsPanel() {
  const { state, t, canChange } = useUi();
  const rows = worldRows(state.data);
  const queued = rows.filter((r) => r.pending.length > 0);
  const tracked = rows.some((r) => r.snapshot !== undefined);
  const first = !tracked && queued.length === 0 && rows.length > 0;
  return (
    <section class="ml-app ml-next" aria-labelledby="ml-next-title">
      <header class="ml-next-head">
        <h3 id="ml-next-title">
          <Icon name={first ? "layer-group" : "hourglass-half"} />
          {first ? t("app.name") : t("worlds.next")}
        </h3>
        <span class="ml-next-sub">
          {first
            ? t("worlds.onboard.sub")
            : queued.length > 0
              ? plural(t, "worlds.next.sub", queued.length)
              : t("worlds.next.none")}
        </span>
        {first ? null : (
          <AttentionMenu rows={rows.filter((r) => r.attention)} />
        )}
        {first && canChange ? null : <ApplyOrLock />}
      </header>
      {first ? <Onboarding /> : null}
      {queued.length > 0 ? <QueuedRows rows={queued} /> : null}
    </section>
  );
}
