// One world's page: a banner with Foundry's artwork, the favourite star,
// Edit and Launch, a line for queued changes; then its modules, or how to
// set it up. Launch reviews queued changes first.
import type { WorldInfo } from "@module-library/shared/world";
import { useRef, useState } from "preact/hooks";
import { Icon } from "../common/widgets.tsx";
import { logError } from "@module-library/shared/log";
import { type LaunchWritten, writeLaunchNote } from "../../app/launch-note.ts";
import { startLaunch } from "../launching.ts";
import { useUi } from "../context.ts";
import { systemTitle } from "../model/system.ts";
import { plural } from "../i18n.ts";
import { type WorldModules, worldModules } from "../model/world-modules.ts";
import { cssImage } from "./route.ts";
import { type LaunchChoice, LaunchReview } from "./world/LaunchReview.tsx";
import { useWhy } from "./world/useWhy.ts";
import { useBackups } from "./world/useBackups.ts";
import { launchOff } from "../tasks.ts";
import { WorldBody, type WorldTab } from "./world/WorldBody.tsx";
import { useLastPlayed } from "./WorldRail.tsx";
import { Docked, InSheetHost } from "./phone/Dock.tsx";
import { isCompact, useLayout } from "./phone/layout.ts";
import { LaunchBar } from "./world/LaunchBar.tsx";
import { NextLaunch } from "./world/NextLaunch.tsx";

function BannerMeta(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
}) {
  const { state, t } = useUi();
  const { world, model } = props;
  const lastPlayed = useLastPlayed();
  return (
    <div class="meta">
      <span>
        <Icon name="dice-d20" />
        {systemTitle(state.data.setup, world.system)}
      </span>
      <span>
        <Icon name="clock" />
        {t("shell.lastPlayed", { when: lastPlayed(world) })}
      </span>
      <span>
        <Icon name="plug" />
        {model.tracked
          ? plural(t, "wp.modulesOn", model.nowCount)
          : t("wp.modulesUnknown")}
      </span>
    </div>
  );
}

/** The title, then the Favourite star and the Locked tag beside it (not in the heading). */
function BannerTitle(props: { readonly world: WorldInfo }) {
  const { page, t } = useUi();
  const { world } = props;
  return (
    <div class="mls-titlerow">
      <h2>{world.title}</h2>
      <button
        type="button"
        class={`mlw-star${world.favorite ? " on" : ""}`}
        aria-label={t("shell.favorite")}
        title={t("shell.favorite")}
        aria-pressed={world.favorite === true}
        onClick={() =>
          page.foundryAction({ action: "favorite", worldId: world.id })
        }
      >
        <i
          class={`fa-${world.favorite ? "solid" : "regular"} fa-star`}
          aria-hidden="true"
        />
      </button>
      {world.locked ? (
        <span class="mlw-locktag">
          <Icon name="lock" />
          {t("shell.locked")}
        </span>
      ) : null}
    </div>
  );
}

function PendingLine(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
  readonly onReview: () => void;
}) {
  const { actions, t, canChange } = useUi();
  const { changes, problems, queued } = props.model;
  if (!changes && !problems && !queued) return null;
  const parts = [
    changes
      ? plural(t, "wp.pending.changes", changes)
      : queued
        ? plural(t, "wp.pending.noEffect", queued)
        : "",
    problems ? plural(t, "wp.pending.problems", problems) : "",
  ].filter(Boolean);
  return (
    <div class={`mlc-pending${problems ? " warn" : ""}`}>
      <Icon name={problems ? "triangle-exclamation" : "clock-rotate-left"} />
      <span>{parts.join(" · ")}</span>
      {queued ? (
        <button type="button" class="ml-link" onClick={props.onReview}>
          {t("wp.review")}
        </button>
      ) : null}
      {queued && canChange ? (
        <button
          type="button"
          class="ml-link"
          onClick={() => void actions.discard(props.world.id)}
        >
          {t("wp.discard")}
        </button>
      ) : null}
    </div>
  );
}

function BannerActions(props: {
  readonly world: WorldInfo;
  readonly changes: number;
  readonly onLaunch: () => void;
  /** Launch is reading the queue (changes still saving). */
  readonly busy: boolean;
  /** The pencil: the About tab. */
  readonly onEdit: () => void;
}) {
  const { t, state } = useUi();
  const { changes } = props;
  const off = launchOff(t, state, props.world);
  return (
    <div class="acts">
      <button
        type="button"
        class="icon"
        aria-label={t("shell.edit")}
        title={t("shell.edit")}
        onClick={props.onEdit}
      >
        <Icon name="pen" />
      </button>
      {/* A locked world can't launch: the reason sits on a wrapper that gets the hover. */}
      <span
        class={off === null ? "mls-launchwrap" : "mlw-tipwrap"}
        title={off ?? undefined}
      >
        <button
          type="button"
          class="bright mls-launch"
          disabled={off !== null}
          aria-busy={props.busy || undefined}
          onClick={props.onLaunch}
        >
          <Icon name="play" />
          {t("shell.launch")}
          {changes ? (
            <span
              class="mlc-badge"
              aria-label={plural(t, "wp.launchBadge", changes)}
            >
              {changes}
            </span>
          ) : null}
        </button>
      </span>
    </div>
  );
}

/**
 * Asks Foundry to launch, with the note for the app's running screen (the
 * changes going with it) and our launching screen from this moment.
 */
function launchNow(
  ui: Pick<ReturnType<typeof useUi>, "page" | "store" | "t" | "ports">,
  world: WorldInfo,
  changes: number,
  backup: boolean,
  written?: LaunchWritten,
): void {
  writeLaunchNote(
    globalThis.sessionStorage,
    world.id,
    changes,
    Date.now(),
    written,
  );
  // The app applies them out of sight only for a launch native has on record.
  if (changes > 0)
    ui.ports.markLaunch?.(world.id, changes).catch((error: unknown) => {
      logError("launch record", error);
    });
  startLaunch(ui.store, world, backup);
  if (backup)
    ui.page.foundryAction({
      action: "backupLaunch",
      worldId: world.id,
      note: ui.t("lr.backupNote"),
    });
  else ui.page.foundryAction({ action: "launch", worldId: world.id });
}

/** Launching, with the review when changes are queued. */
function useLaunch(world: WorldInfo, model: WorldModules) {
  const { page, actions, t, canChange, store, ports } = useUi();
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  /** The changes counted when Launch was pressed, for the launch note. */
  const counted = useRef(0);
  // A change still saving must be reviewed too, not launched past (Phase 6):
  // wait for it, read the queue as it now is, and never twice at once.
  const start = async (): Promise<void> => {
    if (running.current) return;
    // Whichever Launch called: a locked world or a busy Foundry stays put.
    const off = launchOff(t, store.get(), world);
    if (off !== null) {
      actions.notify("info", off);
      return;
    }
    running.current = true;
    setBusy(true);
    try {
      const queued = await actions.queuedFor(world.id);
      // Unreadable: the notice says why, and nothing launches past it.
      if (queued === undefined) return;
      counted.current = queued;
      if (queued > 0) setReview(true);
      else {
        // The world's queue as we have it, and no intent: whatever anyone
        // left there never rides along with a launch of ours (reviews).
        if (canChange && !(await actions.setLaunchHold(world.id, false)))
          return;
        launchNow({ page, store, t, ports }, world, 0, false);
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const run = async (choice: LaunchChoice): Promise<void> => {
    setReview(false);
    // The queue and this launch's intent go into the world's flags first;
    // a read-only browser can't write them.
    let written: LaunchWritten | undefined;
    if (canChange) {
      const plain = choice.kind === "plain";
      const reviewed = plain ? undefined : model.next;
      const r = await actions.setLaunchHold(world.id, plain, reviewed);
      if (!r) return;
      if (!plain && r.launchId) written = { launchId: r.launchId, ids: r.ids };
    }
    // For the app's running screen (counted when Launch was pressed).
    const changes = choice.kind === "plain" ? 0 : counted.current;
    const backup = choice.kind === "apply" && choice.backup;
    launchNow({ page, store, t, ports }, world, changes, backup, written);
  };
  return { review, busy, start, run, close: () => setReview(false) };
}

function Banner(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
  readonly image: string | undefined;
  readonly busy: boolean;
  readonly onLaunch: () => void;
  readonly onEdit: () => void;
}) {
  const { world, model, image } = props;
  return (
    <div class="mls-banner" style={image ? { "--img": image } : undefined}>
      <div>
        <BannerTitle world={world} />
        <BannerMeta world={world} model={model} />
        {/* Review goes through Launch: it waits for changes still saving. */}
        <PendingLine world={world} model={model} onReview={props.onLaunch} />
      </div>
      <BannerActions
        world={world}
        changes={model.changes}
        busy={props.busy}
        onLaunch={props.onLaunch}
        onEdit={props.onEdit}
      />
    </div>
  );
}

/** The phone and tablet layouts: Launch in the dock, the Next launch sheet. */
function PhoneLaunch(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
  readonly why: ReturnType<typeof useWhy>;
  readonly launch: ReturnType<typeof useLaunch>;
}) {
  const { state, store } = useUi();
  const layout = useLayout();
  const { world, model, launch } = props;
  const close = (): void => {
    store.set({ nextLaunch: null });
  };
  return (
    <>
      <Docked>
        <LaunchBar
          world={world}
          model={model}
          busy={launch.busy}
          onLaunch={() => void launch.start()}
          onQueue={() => store.set({ nextLaunch: world.id })}
        />
      </Docked>
      {state.nextLaunch === world.id ? (
        <InSheetHost>
          <NextLaunch
            layout={layout}
            world={world}
            model={model}
            why={props.why}
            onClose={close}
            onLaunch={() => {
              close();
              void launch.start();
            }}
          />
        </InSheetHost>
      ) : null}
    </>
  );
}

export function WorldPage(props: { readonly world: WorldInfo }) {
  const { state, canChange } = useUi();
  const compact = isCompact(useLayout());
  const { world } = props;
  const route = state.route;
  const opening = route?.kind === "world" ? route.tab : undefined;
  const model = worldModules(state.data, world.id);
  const why = useWhy();
  const launch = useLaunch(world, model);
  const backups = useBackups(world.id);
  const [tab, setTab] = useState<WorldTab>(opening ?? "modules");
  const image = cssImage(world.background, location.origin);
  return (
    <section class="application framed mls-main">
      <Banner
        world={world}
        model={model}
        image={image}
        busy={launch.busy}
        onLaunch={() => void launch.start()}
        onEdit={() => setTab("about")}
      />
      <div class="mls-body-main ml-app">
        <WorldBody
          world={world}
          model={model}
          backups={backups}
          tab={tab}
          onTab={setTab}
        />
      </div>
      {compact ? (
        <PhoneLaunch world={world} model={model} why={why} launch={launch} />
      ) : null}
      {launch.review ? (
        <LaunchReview
          world={world}
          model={model}
          why={why}
          backups={backups.view.list}
          onClose={launch.close}
          onLaunch={(c) => void launch.run(c)}
          canHold={canChange}
        />
      ) : null}
    </section>
  );
}
