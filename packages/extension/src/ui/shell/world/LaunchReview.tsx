// Launch with queued changes: review them first (SETUP-REDESIGN.md, queued
// changes). Apply and launch (optionally after Foundry's own backup), launch
// without them (they stay queued), or cancel. The GM still confirms in the
// world before anything applies (PRD 8.4).
import type { WorldInfo } from "@module-library/shared/world";
import { useState } from "preact/hooks";
import { Icon, Modal } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { plural } from "../../i18n.ts";
import { pendingFor } from "../../model/preview.ts";
import type { WorldModules } from "../../model/world-modules.ts";
import type { WhyContext } from "./why.ts";
import { whyLine } from "./why.ts";

export type LaunchChoice =
  | { readonly kind: "apply"; readonly backup: boolean }
  | { readonly kind: "plain" };

function Changes(props: { readonly model: WorldModules }) {
  const { t } = useUi();
  const list = (delta: "on" | "off") =>
    props.model.rows.filter((r) => r.delta === delta);
  return (
    <div class="mlw-lr-cols">
      {(["on", "off"] as const).map((d) => (
        <div key={d}>
          <h4>{t(`lr.${d}`, { n: list(d).length })}</h4>
          <ul>
            {list(d).map((r) => (
              <li key={r.pkg.id}>{r.pkg.title}</li>
            ))}
            {list(d).length === 0 ? (
              <li class="ml-empty">{t("lr.nothing")}</li>
            ) : null}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Check(props: {
  readonly model: WorldModules;
  readonly why: WhyContext;
}) {
  const { t } = useUi();
  const problems = props.model.rows.filter((r) => r.problem);
  if (problems.length === 0)
    return (
      <p class="mlw-check ok">
        <Icon name="circle-check" />
        {t("lr.ok", { from: props.model.nowCount, to: props.model.nextCount })}
      </p>
    );
  return (
    <ul class="mlw-check warn">
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
  const ids = new Set(
    pendingFor(state.data, worldId).flatMap((c) => c.payload.presetIds),
  );
  return state.data.library.presets
    .filter((p) => ids.has(p.id))
    .map((p) => p.name);
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
        class="ml-primary"
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

function BackupFirst(props: {
  readonly world: WorldInfo;
  readonly on: boolean;
  readonly onChange: (on: boolean) => void;
}) {
  const { t } = useUi();
  return (
    <label class="mlw-bfirst">
      <input
        type="checkbox"
        checked={props.on}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
      />
      <span>
        <strong>{t("lr.backup", { world: props.world.title })}</strong>
        <span class="ml-hint">{t("lr.backupHint")}</span>
      </span>
    </label>
  );
}

export function LaunchReview(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
  readonly why: WhyContext;
  readonly onClose: () => void;
  readonly onLaunch: (choice: LaunchChoice) => void;
  /** "Launch without changes" needs a browser that can change the queue. */
  readonly canHold: boolean;
}) {
  const { state, t } = useUi();
  const [backup, setBackup] = useState(true);
  const { world, model } = props;
  const presets = presetNames(state, world.id);
  const footer = (
    <Footer
      changes={model.changes}
      canHold={props.canHold}
      onClose={props.onClose}
      onLaunch={(kind) =>
        props.onLaunch(kind === "plain" ? { kind } : { kind, backup })
      }
    />
  );
  return (
    <Modal
      title={t("lr.title", { world: world.title })}
      onClose={props.onClose}
      footer={footer}
    >
      <div class="mlw-lr">
        <Check model={model} why={props.why} />
        <Changes model={model} />
        {presets.length ? (
          <p class="ml-hint">
            {t("lr.presets", { names: presets.join(", ") })}
          </p>
        ) : null}
        <BackupFirst world={world} on={backup} onChange={setBackup} />
        <p class="ml-hint">{t("lr.confirm")}</p>
      </div>
    </Modal>
  );
}
