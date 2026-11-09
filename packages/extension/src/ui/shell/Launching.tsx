// The launching screen (Android plan, phase 7; mockup design/app-screens,
// Launch): from the tap until Foundry leaves Setup, our steps and one bar
// instead of the 10 to 30 seconds Foundry spends behind its hidden Setup.
// Full screen on a phone, a panel over the page on a desktop.
import { useEffect, useRef, useState } from "preact/hooks";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import type { Translate } from "../i18n.ts";
import {
  type Launching,
  type LaunchStage,
  launchView,
  stopLaunch,
} from "../launching.ts";

/** No tick from Foundry for this long: it may be asking something, or refused. */
export const STALL_MS = 20_000;

const STEP_ORDER: readonly LaunchStage[] = ["backup", "ask", "load", "open"];

const DETAIL_KEYS: Readonly<Record<string, string>> = {
  migrateCore: "launch.subCore",
  connectWorld: "launch.subConnect",
  migrateWorld: "launch.subMigrate",
  connectPackage: "launch.subPacks",
  migratePackage: "launch.subPacks",
};

/** True once Foundry has sent nothing for STALL_MS since the tap. */
function useStalled(l: Launching): boolean {
  const [stalled, setStalled] = useState(false);
  const waiting = l.step === undefined;
  useEffect(() => {
    setStalled(false);
    if (!waiting) return undefined;
    const timer = setTimeout(() => {
      setStalled(true);
    }, STALL_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [waiting, l.worldId]);
  return stalled;
}

function subFor(
  t: Translate,
  stage: LaunchStage,
  detail: string | undefined,
  app: boolean,
): string {
  if (stage === "load")
    return t(DETAIL_KEYS[detail ?? ""] ?? "launch.subConnect");
  if (stage === "open") return t(app ? "launch.subOpenApp" : "launch.subOpen");
  return t(stage === "backup" ? "launch.subBackup" : "launch.subAsk");
}

function Steps(props: { readonly l: Launching; readonly app: boolean }) {
  const { t } = useUi();
  const view = launchView(props.l);
  const order = STEP_ORDER.filter((s) => s !== "backup" || props.l.backup);
  const at = order.indexOf(view.stage);
  return (
    <ol class="mll-steps">
      {order.map((stage, i) => {
        const state = i < at ? "done" : i === at ? "now" : "";
        return (
          <li key={stage} class={state}>
            <span class="mll-dot">{i < at ? <Icon name="check" /> : null}</span>
            <span>{t(`launch.step.${stage}`)}</span>
            {i === at ? (
              <small>{subFor(t, stage, view.detail, props.app)}</small>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Back to the world once the launch failed or stalled; the app's servers. */
function Dock(props: { readonly way: boolean; readonly app: boolean }) {
  const { t, actions, store } = useUi();
  return (
    <div class="mll-dock">
      {props.way ? (
        <button
          type="button"
          class="mll-primary"
          onClick={() => {
            stopLaunch(store);
          }}
        >
          {t("launch.back")}
        </button>
      ) : null}
      {props.app ? (
        <button type="button" onClick={() => void actions.openSettings()}>
          <Icon name="server" />
          {t("launch.servers")}
        </button>
      ) : null}
    </div>
  );
}

function Body(props: { readonly l: Launching }) {
  const { t, ports } = useUi();
  const { l } = props;
  const view = launchView(l);
  const stalled = useStalled(l);
  const failed = view.stage === "failed";
  const app = ports.app === true;
  return (
    <>
      <span class="mll-chip">{t("launch.chip")}</span>
      <h2>{l.title}</h2>
      <p class="mll-lead">{t(app ? "launch.leadApp" : "launch.lead")}</p>
      <div
        class="mll-bar"
        role="progressbar"
        aria-label={t("launch.progress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={view.pct}
      >
        <i style={{ width: `${view.pct}%` }} />
      </div>
      {failed ? (
        <p class="mll-error" role="alert">
          {t("launch.failed", { error: l.error ?? t("launch.noReason") })}
        </p>
      ) : (
        <Steps l={l} app={app} />
      )}
      {stalled && !failed ? (
        <p class="mll-note">{t("launch.stalled")}</p>
      ) : null}
      <Dock way={failed || stalled} app={app} />
    </>
  );
}

export function LaunchingScreen() {
  const { state, t } = useUi();
  const l = state.launching;
  const box = useRef<HTMLDivElement>(null);
  const shown = l !== null;
  useEffect(() => {
    if (shown) box.current?.focus();
  }, [shown]);
  if (!l) return null;
  return (
    <div class="mll-launch">
      <div
        class="mll-box"
        role="dialog"
        aria-modal="true"
        aria-label={t("launch.title", { world: l.title })}
        tabIndex={-1}
        ref={box}
      >
        <Body l={l} />
      </div>
    </div>
  );
}
