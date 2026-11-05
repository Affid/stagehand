// Adds Module Library entries to Foundry's own right-click menu on world
// cards. Setup builds that menu without a hook, so the one shared render
// method is wrapped; any failure leaves Foundry's menu as it was.
import type { MenuAction, MenuLabels, PageToUi } from "../page-protocol.ts";
import type { ContextMenuLike, MenuEntry } from "./globals.ts";

const GROUP = "module-library";
// Private, so page scripts can't pre-plant or read our state.
const MARK = Symbol("module-library.menu");

export interface MenuConfig {
  readonly labels: MenuLabels;
  /** Which right-clicked elements are world cards (remote config, R-4). */
  readonly worldCard: string;
}

interface MenuState {
  config: MenuConfig | null;
  post: (m: PageToUi) => void;
}

type Patched = ContextMenuLike & { [MARK]?: MenuState };

function worldId(target: unknown, worldCard: string): string | undefined {
  if (!(target instanceof HTMLElement) || !target.matches(worldCard))
    return undefined;
  return target.dataset.packageId ?? undefined;
}

function entries(state: MenuState, id: string): MenuEntry[] {
  const labels = state.config?.labels;
  if (!labels) return [];
  const entry = (action: MenuAction, label: string, icon: string) => ({
    label,
    icon: `fa-solid ${icon}`,
    group: GROUP,
    onClick: () => {
      state.post({ type: "MENU_ACTION", payload: { action, worldId: id } });
    },
  });
  const details = entry("details", labels.details, "fa-list-check");
  return labels.apply
    ? [details, entry("apply", labels.apply, "fa-layer-group")]
    : [details];
}

function wrap(proto: Patched, state: MenuState): void {
  const render = proto.render;
  proto[MARK] = state;
  proto.render = function (this: ContextMenuLike, target, options) {
    try {
      this.menuItems = this.menuItems.filter((e) => e.group !== GROUP);
      const id = state.config && worldId(target, state.config.worldCard);
      if (id) this.menuItems = [...this.menuItems, ...entries(state, id)];
    } catch {
      // Foundry's own entries still render.
    }
    return render.call(this, target, options);
  };
}

/** Wraps the menu's render once; entries show only once configured. */
export function installWorldMenu(
  proto: ContextMenuLike,
  post: (m: PageToUi) => void,
): (config: MenuConfig | null) => void {
  const patched = proto as Patched;
  const state = patched[MARK] ?? { config: null, post };
  if (!patched[MARK]) wrap(patched, state);
  state.post = post;
  return (config) => {
    state.config = config;
  };
}
