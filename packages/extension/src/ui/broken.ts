// A queued change made outside a world's own page that leaves the world
// with problems at its next launch says so (prototype warnIfBroken); on the
// world's page its cards already show them.
import { plural, type Translate } from "./i18n.ts";
import { worldModules } from "./model/world-modules.ts";
import type { PageBridge } from "./page.ts";
import type { Store } from "./store.ts";

const problemsOf = (store: Store, worldId: string): number => {
  const m = worldModules(store.get().data, worldId);
  return m.tracked ? m.problems : 0;
};

/** Runs a queue write for a world and warns if it added problems there. */
export async function watchProblems<T>(
  deps: {
    readonly store: Store;
    readonly t: Translate;
    readonly page: PageBridge;
  },
  worldId: string,
  write: () => Promise<T>,
): Promise<T> {
  const before = problemsOf(deps.store, worldId);
  const result = await write();
  const after = problemsOf(deps.store, worldId);
  const state = deps.store.get();
  const here = state.route?.kind === "world" && state.route.worldId === worldId;
  if (after > before && !here) {
    const title =
      state.data.setup?.worlds.find((w) => w.id === worldId)?.title ?? worldId;
    deps.page.notify(
      "warning",
      plural(deps.t, "notice.broken", after, { world: title }),
    );
  }
  return result;
}
