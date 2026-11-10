// Launch with queued changes: review them first (SETUP-REDESIGN.md, queued
// changes). Apply and launch (optionally after Foundry's own backup), launch
// without them (they stay queued), or cancel. This review is the GM's
// confirmation: the world asks again only if its live check differs.
import type { WorldInfo } from "@stagehand/shared/world";
import { useState } from "preact/hooks";
import { Icon, Modal } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import type { BackupInfo } from "../../../page-backups.ts";
import { ago, plural, type Translate } from "../../i18n.ts";
import { age } from "../../model/worlds.ts";
import { formatSize } from "../../common/size.ts";
import { backupForQueue } from "./backups/Nudge.tsx";
import { latestBackup } from "./useBackups.ts";
import { pendingFor } from "../../model/preview.ts";
import type { WorldModules } from "../../model/world-modules.ts";
import type { WhyContext } from "./why.ts";
import { whyLine } from "./why.ts";

export type LaunchChoice =
  | { readonly kind: "apply"; readonly backup: boolean }
  | { readonly kind: "plain" };

export function Changes(props: {
  readonly model: WorldModules;
  readonly worldId: string;
}) {
  const { actions, t, canChange } = useUi();
  const list = (delta: "on" | "off") =>
    props.model.rows.filter((r) => r.delta === delta);
  return (
    <div class="stw-lr-cols">
      {(["on", "off"] as const).map((d) => (
        <div key={d}>
          <h4>{t(`lr.${d}`, { n: list(d).length })}</h4>
          <ul>
            {list(d).map((r) => (
              <li key={r.pkg.id}>
                <span class={`s ${d === "on" ? "plus" : "minus"}`}>
                  {d === "on" ? "+" : "−"}
                </span>
                <span>{r.pkg.title}</span>
                {canChange ? (
                  <button
                    type="button"
                    class="x"
                    aria-label={t("lr.drop", { module: r.pkg.title })}
                    title={t("lr.drop", { module: r.pkg.title })}
                    onClick={(e) => {
                      // The row goes: keep focus inside the review.
                      e.currentTarget
                        .closest<HTMLElement>('[role="dialog"]')
                        ?.focus();
                      void actions.flip(props.worldId, r.pkg.id, r.now);
                    }}
                  >
                    <Icon name="xmark" />
                  </button>
                ) : null}
              </li>
            ))}
            {list(d).length === 0 ? (
              <li class="st-empty">{t("lr.nothing")}</li>
            ) : null}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function Check(props: {
  readonly model: WorldModules;
  readonly why: WhyContext;
}) {
  const { t } = useUi();
  const problems = props.model.rows.filter((r) => r.problem);
  if (problems.length === 0)
    return (
      <p class="stw-check ok">
        <Icon name="circle-check" />
        {t("lr.ok", { from: props.model.nowCount, to: props.model.nextCount })}
      </p>
    );
  return (
    <ul class="stw-check warn">
      {problems.map((r) => (
        <li key={r.pkg.id}>
          <Icon name="triangle-exclamation" />
          <strong>{r.pkg.title}</strong>: {whyLine(r, props.why).text}
        </li>
      ))}
    </ul>
  );
}

function presetNames(
  state: ReturnType<typeof useUi>["state"],
  worldId: string,
): string[] {
  const pending = pendingFor(state.data, worldId);
  const ids = new Set(pending.flatMap((c) => c.payload.presetIds));
  const ours = state.data.library.presets
    .filter((p) => ids.has(p.id))
    .map((p) => p.name);
  // Changes queued on another device bring their presets' names along.
  const far = pending.flatMap((c) =>
    (c.payload.presets ?? []).map((p) => p.name),
  );
  return [...new Set([...ours, ...far])];
}

function Footer(props: {
  readonly changes: number;
  readonly canHold: boolean;
  readonly onClose: () => void;
  readonly onLaunch: (kind: "apply" | "plain") => void;
}) {
  const { t } = useUi();
  return (
    <>
      <button type="button" onClick={props.onClose}>
        {t("lr.cancel")}
      </button>
      {props.canHold ? (
        <button
          type="button"
          title={t("lr.plainHint")}
          onClick={() => props.onLaunch("plain")}
        >
          {t("lr.plain")}
        </button>
      ) : null}
      <button
        type="button"
        class="st-primary"
        onClick={() => props.onLaunch("apply")}
      >
        <Icon name="play" />
        {props.changes
          ? plural(t, "lr.apply", props.changes)
          : t("lr.applyNone")}
      </button>
    </>
  );
}

/** "About 441 MB. The latest backup is from 3 days ago." */
function backupHint(
  t: Translate,
  list: readonly BackupInfo[] | undefined,
): string {
  const latest = latestBackup(list);
  if (!latest) return t("lr.backupHint");
  return t("lr.backupHintLatest", {
    size: formatSize(latest.size),
    when: ago(t, age(new Date(latest.createdAt).toISOString(), Date.now())),
  });
}

function BackupFirst(props: {
  readonly world: WorldInfo;
  readonly on: boolean;
  readonly onChange: (on: boolean) => void;
  readonly backups: readonly BackupInfo[] | undefined;
}) {
  const { t } = useUi();
  return (
    <label class="stw-bfirst">
      <input
        type="checkbox"
        checked={props.on}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
      />
      <span>
        <strong>{t("lr.backup", { world: props.world.title })}</strong>
        <span class="st-hint">{backupHint(t, props.backups)}</span>
      </span>
    </label>
  );
}

/**
 * "Back up first": ticked unless a backup already covers every queued change
 * (SETUP-REDESIGN.md, open item 3), until the reader ticks it themselves.
 */
function useBackupFirst(
  worldId: string,
  backups: readonly BackupInfo[] | undefined,
): { readonly on: boolean; readonly set: (on: boolean) => void } {
  const { state } = useUi();
  const [chosen, setChosen] = useState<boolean | null>(null);
  const queuedAt = pendingFor(state.data, worldId).map((c) => c.createdAt);
  const covered = backupForQueue(queuedAt, latestBackup(backups)) !== undefined;
  return { on: chosen ?? !covered, set: setChosen };
}

export function LaunchReview(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
  readonly why: WhyContext;
  readonly onClose: () => void;
  readonly onLaunch: (choice: LaunchChoice) => void;
  /** "Launch without changes" needs a browser that can change the queue. */
  readonly canHold: boolean;
  /** The world's backups, once listed. */
  readonly backups?: readonly BackupInfo[] | undefined;
}) {
  const { state, t } = useUi();
  const { world, model } = props;
  const backup = useBackupFirst(world.id, props.backups);
  const presets = presetNames(state, world.id);
  const footer = (
    <Footer
      changes={model.changes}
      canHold={props.canHold}
      onClose={props.onClose}
      onLaunch={(kind) =>
        props.onLaunch(
          kind === "plain" ? { kind } : { kind, backup: backup.on },
        )
      }
    />
  );
  return (
    <Modal
      title={t("lr.title", { world: world.title })}
      onClose={props.onClose}
      footer={footer}
    >
      <div class="stw-lr">
        <Check model={model} why={props.why} />
        <Changes model={model} worldId={world.id} />
        {presets.length ? (
          <p class="st-hint">
            {t("lr.presets", { names: presets.join(", ") })}
          </p>
        ) : null}
        <BackupFirst
          world={world}
          on={backup.on}
          onChange={backup.set}
          backups={props.backups}
        />
      </div>
    </Modal>
  );
}
