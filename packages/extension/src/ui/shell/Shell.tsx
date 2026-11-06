// The new Setup page: header, worlds rail, and a world's page or the Library.
import { useUi } from "../context.ts";
import { LibraryPage } from "./library/LibraryPage.tsx";
import { ServerBackupsPage } from "./server/BackupsPage.tsx";
import { ConfigPage } from "./server/ConfigPage.tsx";
import { UpdatePage } from "./server/UpdatePage.tsx";
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
        {route.kind === "server" ? (
          <section class="application framed mls-main">
            <div class="mls-body-main">
              {route.page === "config" ? (
                <ConfigPage />
              ) : route.page === "update" ? (
                <UpdatePage />
              ) : (
                <ServerBackupsPage />
              )}
            </div>
          </section>
        ) : world ? (
          <WorldPage key={world.id} world={world} />
        ) : (
          <section class="application framed mls-main mls-library">
            <div class="mls-body-main">
              <LibraryPage />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
