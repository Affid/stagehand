// The Next launch sheet in the phone and tablet layouts (mockup: _phone.js
// phQueueSheet): what the world's next launch changes, each change with its
// undo, the problems, Discard all and Launch. Launch goes through the review,
// as the banner's does on the desktop.
import type { WorldInfo } from "@stagehand/shared/world";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { plural } from "../../i18n.ts";
import type { WorldModules } from "../../model/world-modules.ts";
import type { Layout } from "../phone/layout.ts";
import { Sheet } from "../phone/Sheet.tsx";
import { launchOff } from "../../tasks.ts";
import { Changes, Check } from "./LaunchReview.tsx";
import type { WhyContext } from "./why.ts";

function Lead(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
}) {
  const { t } = useUi();
  const n = props.model.changes;
  return (
    <p class="stp-lead">
      {n
        ? plural(t, "stp.queueLead", n, { world: props.world.title })
        : t("stp.queueNone", { world: props.world.title })}
    </p>
  );
}

/** Discard all (where changes can be made) and Launch. */
function Footer(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
  readonly onClose: () => void;
  readonly onLaunch: () => void;
}) {
  const { actions, canChange, state, t } = useUi();
  const off = launchOff(t, state, props.world);
  return (
    <footer>
      {canChange && props.model.queued ? (
        <button
          type="button"
          onClick={() => {
            props.onClose();
            void actions.discard(props.world.id);
          }}
        >
          <Icon name="trash" />
          {t("stp.discardAll")}
        </button>
      ) : null}
      {/* The same rule as the bar's Launch; the wrapper says why. */}
      <span
        class={off === null ? "sts-launchwrap" : "stw-tipwrap"}
        title={off ?? undefined}
      >
        <button
          type="button"
          class="bright"
          disabled={off !== null}
          onClick={props.onLaunch}
        >
          <Icon name="play" />
          {t("shell.launch")}
        </button>
      </span>
    </footer>
  );
}

export function NextLaunch(props: {
  readonly layout: Layout;
  readonly world: WorldInfo;
  readonly model: WorldModules;
  readonly why: WhyContext;
  readonly onClose: () => void;
  readonly onLaunch: () => void;
}) {
  const { t } = useUi();
  const { world, model } = props;
  return (
    <Sheet layout={props.layout} onClose={props.onClose}>
      <aside
        class="application framed sts-panel st-app stp-next"
        aria-label={t("stp.nextLaunch")}
      >
        <h2 class="divider">{t("stp.nextLaunch")}</h2>
        <button
          type="button"
          class="icon sts-close"
          aria-label={t("mp.close")}
          onClick={props.onClose}
        >
          <Icon name="xmark" />
        </button>
        <div class="scroll">
          <Lead world={world} model={model} />
          <Changes model={model} worldId={world.id} />
          <Check model={model} why={props.why} />
        </div>
        <Footer
          world={world}
          model={model}
          onClose={props.onClose}
          onLaunch={props.onLaunch}
        />
      </aside>
    </Sheet>
  );
}
