// A world's bottom bar in the phone and tablet layouts (mockup: _phone.js
// phActionBar): what the next launch changes, which opens the Next launch
// sheet, and Launch, where a thumb reaches it. It replaces the banner's
// pending line with Review and Discard, and its Launch.
import type { WorldInfo } from "@stagehand/shared/world";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { plural } from "../../i18n.ts";
import type { WorldModules } from "../../model/world-modules.ts";
import { launchOff } from "../../tasks.ts";

function What(props: {
  readonly model: WorldModules;
  readonly onQueue: () => void;
}) {
  const { t } = useUi();
  const { model } = props;
  if (!model.tracked)
    return (
      <span class="stp-what">
        <strong>{t("wp.modulesUnknown")}</strong>
        <span>{t("stp.setUpFirst")}</span>
      </span>
    );
  if (!model.queued && !model.problems)
    return (
      <span class="stp-what">
        <strong>{t("stp.noChanges")}</strong>
        <span>{plural(t, "stp.modulesOn", model.nowCount)}</span>
      </span>
    );
  const parts = [
    model.changes
      ? plural(t, "stp.changes", model.changes)
      : t("stp.noChanges"),
    model.problems ? plural(t, "wp.pending.problems", model.problems) : "",
  ].filter(Boolean);
  return (
    <button
      type="button"
      class={`stp-what${model.problems ? " warn" : ""}`}
      aria-haspopup="dialog"
      onClick={props.onQueue}
    >
      <strong>{parts.join(" · ")}</strong>
      <span>
        {t("stp.seeOrUndo")} <Icon name="chevron-up" />
      </span>
    </button>
  );
}

export function LaunchBar(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
  readonly busy: boolean;
  readonly onLaunch: () => void;
  readonly onQueue: () => void;
}) {
  const { state, t } = useUi();
  const { world, model } = props;
  const off = launchOff(t, state, world);
  const n = model.tracked ? model.changes : 0;
  return (
    <div class="stp-actbar">
      <What model={model} onQueue={props.onQueue} />
      <span
        class={off === null ? "sts-launchwrap" : "stw-tipwrap"}
        title={off ?? undefined}
      >
        <button
          type="button"
          class="bright stp-launch"
          disabled={off !== null}
          aria-busy={props.busy || undefined}
          onClick={props.onLaunch}
        >
          <Icon name="play" />
          {t("shell.launch")}
          {n ? (
            <span class="stc-badge" aria-label={plural(t, "wp.launchBadge", n)}>
              {n}
            </span>
          ) : null}
        </button>
      </span>
    </div>
  );
}
