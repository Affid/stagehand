// The new Setup page: header, worlds rail, and a world's page or the Library.
import { useUi } from "../context.ts";
import { ModulesView } from "../modules/ModulesView.tsx";
import { Header } from "./Header.tsx";
import { resolveRoute } from "./route.ts";
import { WorldPage } from "./WorldPage.tsx";
import { WorldRail } from "./WorldRail.tsx";

export function Shell() {
  const { state } = useUi();
  const worlds = state.data.setup?.worlds ?? [];
  const route = resolveRoute(state.route, worlds, state.data.setup?.lang);
  const world =
    route.kind === "world"
      ? worlds.find((w) => w.id === route.worldId)
      : undefined;
  return (
    <div class="mls-shell">
      <Header />
      <div class="mls">
        <WorldRail route={route} />
        {world ? (
          <WorldPage key={world.id} world={world} />
        ) : (
          <section class="application framed mls-main mls-library">
            <div class="mls-body-main">
              <ModulesView />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
