// One world's page: a banner with Foundry's artwork, the favourite star,
// Edit and Launch, a line for queued changes; then its modules, or how to
// set it up. Launch reviews queued changes first.
import type { WorldInfo } from "@module-library/shared/world";
import { useState } from "preact/hooks";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { systemTitle } from "../model/system.ts";
import { plural } from "../i18n.ts";
import { pendingFor } from "../model/preview.ts";
import { type WorldModules, worldModules } from "../model/world-modules.ts";
import { cssImage } from "./route.ts";
import { type LaunchChoice, LaunchReview } from "./world/LaunchReview.tsx";
import { useWhy } from "./world/useWhy.ts";
import { useBackups } from "./world/useBackups.ts";
import { lockReason } from "../tasks.ts";
import { WorldBody, type WorldTab } from "./world/WorldBody.tsx";
import { useLastPlayed } from "./WorldRail.tsx";

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
  /** The pencil: the About tab. */
  readonly onEdit: () => void;
}) {
  const { t, state } = useUi();
  const { changes } = props;
  // Locked worlds can't launch; nor can any while Foundry backs up or restores.
  const off = props.world.locked
    ? t("shell.launchLocked")
    : lockReason(t, state);
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

/** Launching, with the review when changes are queued. */
function useLaunch(world: WorldInfo, model: WorldModules) {
  const { page, actions, store, t, canChange } = useUi();
  const [review, setReview] = useState(false);
  // A change still saving must be reviewed too, not launched past (Phase 6):
  // wait for it, then read the queue as it now is.
  const start = async (): Promise<void> => {
    await actions.settled();
    if (pendingFor(store.get().data, world.id).length > 0) setReview(true);
    else page.foundryAction({ action: "launch", worldId: world.id });
  };
  const run = async (choice: LaunchChoice): Promise<void> => {
    setReview(false);
    // A hold left from an earlier "without changes" must not skip these.
    // A read-only browser can't hold, and its bridge is off anyway.
    if (canChange) {
      const plain = choice.kind === "plain";
      const reviewed = plain ? undefined : model.next;
      if (!(await actions.setLaunchHold(world.id, plain, reviewed))) return;
    }
    if (choice.kind === "apply" && choice.backup)
      page.foundryAction({
        action: "backupLaunch",
        worldId: world.id,
        note: t("lr.backupNote"),
      });
    else page.foundryAction({ action: "launch", worldId: world.id });
  };
  return { review, start, run, close: () => setReview(false) };
}

function Banner(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
  readonly image: string | undefined;
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
        onLaunch={props.onLaunch}
        onEdit={props.onEdit}
      />
    </div>
  );
}

export function WorldPage(props: { readonly world: WorldInfo }) {
  const { state, canChange } = useUi();
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
