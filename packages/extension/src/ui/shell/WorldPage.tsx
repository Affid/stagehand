// One world's page: a banner with Foundry's artwork, the favourite star,
// Edit and Launch, a line for queued changes; then its modules, or how to
// set it up. Launch reviews queued changes first.
import type { WorldInfo } from "@module-library/shared/world";
import { useState } from "preact/hooks";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { plural } from "../i18n.ts";
import { type WorldModules, worldModules } from "../model/world-modules.ts";
import { cssImage } from "./route.ts";
import { type LaunchChoice, LaunchReview } from "./world/LaunchReview.tsx";
import { useWhy } from "./world/useWhy.ts";
import { WorldBody } from "./world/WorldBody.tsx";
import { useLastPlayed } from "./WorldRail.tsx";

function BannerMeta(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
}) {
  const { t } = useUi();
  const { world, model } = props;
  const lastPlayed = useLastPlayed();
  return (
    <div class="meta">
      <span>
        <Icon name="dice-d20" />
        {world.system} {world.systemVersion}
      </span>
      <span>
        <Icon name="code-branch" />
        {t("shell.core", { version: world.coreVersion })}
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
}) {
  const { page, t } = useUi();
  const { world, changes } = props;
  const act = (action: "editWorld" | "favorite"): void => {
    page.foundryAction({ action, worldId: world.id });
  };
  return (
    <div class="acts">
      <button
        type="button"
        class={`mlw-star${world.favorite ? " on" : ""}`}
        aria-label={t("shell.favorite")}
        title={t("shell.favorite")}
        aria-pressed={world.favorite === true}
        onClick={() => act("favorite")}
      >
        <i
          class={`fa-${world.favorite ? "solid" : "regular"} fa-star`}
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        class="icon"
        aria-label={t("shell.edit")}
        title={t("shell.edit")}
        onClick={() => act("editWorld")}
      >
        <Icon name="pen" />
      </button>
      <button type="button" class="bright mls-launch" onClick={props.onLaunch}>
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
    </div>
  );
}

/** Launching, with the review when changes are queued. */
function useLaunch(world: WorldInfo, model: WorldModules) {
  const { page, actions, t, canChange } = useUi();
  const [review, setReview] = useState(false);
  const start = (): void => {
    if (model.queued) setReview(true);
    else page.foundryAction({ action: "launch", worldId: world.id });
  };
  const run = async (choice: LaunchChoice): Promise<void> => {
    setReview(false);
    // A hold left from an earlier "without changes" must not skip these.
    // A read-only browser can't hold, and its bridge is off anyway.
    if (canChange) {
      const plain = choice.kind === "plain";
      if (!(await actions.setLaunchHold(world.id, plain))) return;
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

export function WorldPage(props: { readonly world: WorldInfo }) {
  const { state, canChange } = useUi();
  const { world } = props;
  const model = worldModules(state.data, world.id);
  const why = useWhy();
  const launch = useLaunch(world, model);
  const image = cssImage(world.background, location.origin);
  return (
    <section class="application framed mls-main">
      <div class="mls-banner" style={image ? { "--img": image } : undefined}>
        <div>
          <h2>{world.title}</h2>
          <BannerMeta world={world} model={model} />
          <PendingLine world={world} model={model} onReview={launch.start} />
        </div>
        <BannerActions
          world={world}
          changes={model.changes}
          onLaunch={launch.start}
        />
      </div>
      <div class="mls-body-main ml-app">
        <WorldBody world={world} model={model} />
      </div>
      {launch.review ? (
        <LaunchReview
          world={world}
          model={model}
          why={why}
          onClose={launch.close}
          onLaunch={(c) => void launch.run(c)}
          canHold={canChange}
        />
      ) : null}
    </section>
  );
}
