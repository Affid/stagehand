// One world's sheet, in a Foundry window docked on the right (W-1 to W-3):
// status, the queue for the next launch with its combined result (P-6),
// history, and the world's actions, launching included.
import { useState } from "preact/hooks";
import { FoundryWindow } from "../common/FoundryWindow.tsx";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { ago } from "../i18n.ts";
import { COMPANION_ID, effectOf } from "../model/preview.ts";
import { age, type WorldRow, worldRow } from "../model/worlds.ts";
import { HistoryList, QueuedList } from "./commands.tsx";
import { launchControl } from "./launch.ts";
import { EffectPills, PlanDiff } from "./PlanView.tsx";

const SIZE = { width: 520, height: 760, dock: "right" } as const;
const STATUS_ICON = {
  ok: "circle-check",
  "no-companion": "plug-circle-xmark",
  stale: "clock-rotate-left",
  outdated: "triangle-exclamation",
};

const played = (row: WorldRow): string => {
  const d = new Date(row.world.lastPlayed ?? "");
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
};

function Status(props: { readonly row: WorldRow }) {
  const { store, t, canChange } = useUi();
  const { status, snapshot } = props.row;
  const when = snapshot ? ago(t, age(snapshot.takenAt, Date.now())) : "";
  const fromWorld = (): void => {
    const active = (snapshot?.active ?? [])
      .map((m) => m.id)
      .filter((id) => id !== COMPANION_ID);
    store.set({ editingPreset: "new", draftModules: active });
  };
  return (
    <section class={`ml-sheet-status ml-status-${status}`}>
      <Icon name={STATUS_ICON[status]} />
      <div>
        <strong>
          {t(`sheet.status.${status}`, { n: snapshot?.active.length ?? 0 })}
        </strong>
        <span>{t(`sheet.status.${status}.sub`, { age: when })}</span>
      </div>
      {snapshot && canChange ? (
        <button type="button" class="ml-link" onClick={fromWorld}>
          {t("sheet.fromWorld")}
        </button>
      ) : null}
    </section>
  );
}

function NextLaunch(props: { readonly row: WorldRow }) {
  const { t } = useUi();
  const [showResult, setShowResult] = useState(false);
  const { pending, plan } = props.row;
  return (
    <section class="ml-sheet-next">
      <h3>
        <Icon name="hourglass-half" />
        {t("sheet.next")}
        {pending.length > 0 ? (
          <span class="ml-count-badge">
            {t("sheet.queuedCount", { n: pending.length })}
          </span>
        ) : null}
      </h3>
      {pending.length === 0 ? (
        <p class="ml-empty">{t("sheet.nothingQueued")}</p>
      ) : null}
      {plan ? <EffectPills effect={effectOf(plan)} /> : null}
      {pending.length > 0 ? <QueuedList commands={pending} /> : null}
      {pending.length > 1 ? <p class="ml-hint">{t("sheet.note")}</p> : null}
      {plan ? (
        <div class="ml-sheet-result">
          <p>
            {t("sheet.result", {
              from: plan.start.length,
              to: plan.target.length,
            })}
            <button
              type="button"
              class="ml-link"
              aria-expanded={showResult}
              onClick={() => setShowResult(!showResult)}
            >
              {showResult ? t("sheet.hide") : t("sheet.show")}
            </button>
          </p>
          {showResult ? <PlanDiff plan={plan} /> : null}
        </div>
      ) : null}
    </section>
  );
}

function SheetFooter(props: { readonly row: WorldRow }) {
  const { state, store, actions, t, canChange } = useUi();
  const { world, pending } = props.row;
  const launch = launchControl(document, state.selectors, world.id);
  const cancelAll = async (): Promise<void> => {
    for (const c of pending) await actions.cancelCommand(c.id);
  };
  return (
    <>
      {canChange && pending.length > 1 ? (
        <button
          type="button"
          class="ml-link ml-footer-start"
          onClick={() => void cancelAll()}
        >
          {t("sheet.cancelAll")}
        </button>
      ) : (
        <span class="ml-footer-start" />
      )}
      <button
        type="button"
        disabled={!launch}
        onClick={() => {
          store.set({ sheetWorld: null });
          launch?.click();
        }}
      >
        <Icon name="circle-play" />
        {t("sheet.launch")}
      </button>
      {canChange ? (
        <button
          type="button"
          class="ml-primary"
          onClick={() => store.set({ apply: { worldId: world.id } })}
        >
          <Icon name="layer-group" />
          {t("worlds.apply")}
        </button>
      ) : null}
    </>
  );
}

export function WorldSheet(props: { readonly worldId: string }) {
  const { state, store, t } = useUi();
  const world = state.data.setup?.worlds.find((w) => w.id === props.worldId);
  const close = (): void => {
    store.set({ sheetWorld: null });
  };
  const row = world ? worldRow(state.data, world) : undefined;
  return (
    <FoundryWindow
      kind="sheet"
      title={world?.title ?? props.worldId}
      icon="fa-solid fa-globe"
      size={SIZE}
      onClose={close}
      footer={row ? <SheetFooter row={row} /> : undefined}
    >
      {row ? (
        <>
          <p class="ml-sheet-meta">
            {t("sheet.meta", {
              system: row.world.system,
              systemVersion: row.world.systemVersion,
              core: row.world.coreVersion,
            })}
            {played(row)
              ? ` · ${t("sheet.lastPlayed", { date: played(row) })}`
              : ""}
          </p>
          <Status row={row} />
          <NextLaunch row={row} />
          {row.recent.length > 0 ? (
            <section class="ml-sheet-history">
              <h3>{t("sheet.history")}</h3>
              <HistoryList commands={row.recent} />
            </section>
          ) : null}
        </>
      ) : (
        <p>{t("sheet.gone")}</p>
      )}
    </FoundryWindow>
  );
}
