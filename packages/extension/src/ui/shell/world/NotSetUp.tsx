// A world whose companion isn't on yet: explain the one-time setup instead
// of showing switches that can't work (SETUP-REDESIGN.md).
import type { WorldInfo } from "@stagehand/shared/world";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { startLaunch } from "../../launching.ts";

export function NotSetUp(props: { readonly world: WorldInfo }) {
  const { page, t, store, actions, canChange } = useUi();
  // Like every launch of ours: an intent in the world (anyone's) goes first.
  const launch = async (): Promise<void> => {
    if (canChange && !(await actions.setLaunchHold(props.world.id, false)))
      return;
    startLaunch(store, props.world, false);
    page.foundryAction({ action: "launch", worldId: props.world.id });
  };
  const world = props.world.title;
  return (
    <div class="stw-empty">
      <i class="fa-solid fa-puzzle-piece" aria-hidden="true" />
      <h3>{t("wp.setup.title", { world })}</h3>
      <p>{t("wp.setup.lead")}</p>
      <ol>
        <li>{t("wp.setup.step1", { world })}</li>
        <li>{t("wp.setup.step2")}</li>
        <li>{t("wp.setup.step3")}</li>
      </ol>
      <button
        type="button"
        class="bright"
        onClick={() => {
          void launch();
        }}
      >
        <Icon name="play" />
        {t("wp.setup.launch")}
      </button>
    </div>
  );
}
