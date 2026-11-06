// One world's page: a banner with Foundry's artwork, the favourite star,
// Edit and Launch, then today's world sheet content (Phase 2 replaces it).
import type { WorldInfo } from "@module-library/shared/world";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { worldRow } from "../model/worlds.ts";
import { SheetSections } from "../worlds/WorldSheet.tsx";
import { cssImage } from "./route.ts";
import { useLastPlayed } from "./WorldRail.tsx";

function BannerMeta(props: { readonly world: WorldInfo }) {
  const { t } = useUi();
  const { world } = props;
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
      {world.locked ? (
        <span class="mlw-locktag">
          <Icon name="lock" />
          {t("shell.locked")}
        </span>
      ) : null}
    </div>
  );
}

function BannerActions(props: { readonly world: WorldInfo }) {
  const { page, t } = useUi();
  const { world } = props;
  const act = (action: "launch" | "editWorld" | "favorite"): void => {
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
      <button
        type="button"
        class="bright mls-launch"
        onClick={() => act("launch")}
      >
        <Icon name="play" />
        {t("shell.launch")}
      </button>
    </div>
  );
}

function Banner(props: { readonly world: WorldInfo }) {
  const image = cssImage(props.world.background, location.origin);
  return (
    <div class="mls-banner" style={image ? { "--img": image } : undefined}>
      <div>
        <h2>{props.world.title}</h2>
        <BannerMeta world={props.world} />
      </div>
      <BannerActions world={props.world} />
    </div>
  );
}

export function WorldPage(props: { readonly world: WorldInfo }) {
  const { state, store, t, canChange } = useUi();
  const row = worldRow(state.data, props.world);
  return (
    <section class="application framed mls-main">
      <Banner world={props.world} />
      <div class="mls-body-main ml-app">
        <SheetSections row={row} />
        {canChange ? (
          <p class="mls-world-acts">
            <button
              type="button"
              class="ml-primary"
              onClick={() => store.set({ apply: { worldId: props.world.id } })}
            >
              <Icon name="layer-group" />
              {t("worlds.apply")}
            </button>
          </p>
        ) : null}
      </div>
    </section>
  );
}
