// The top bar of the phone and tablet layouts: Foundry's name, the version
// chip and the power menu at home (always on a tablet); a tab's name on its
// own page; Back and the page's name on a world or What's new.
import type { WorldInfo } from "@module-library/shared/world";
import { useEffect, useRef } from "preact/hooks";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { PowerMenu } from "../Header.tsx";
import type { Route } from "../route.ts";
import { VersionMenu } from "../VersionMenu.tsx";
import type { Layout } from "./layout.ts";
import { backPatch, hasBack, navOf } from "./nav.ts";

function useTitle(route: Route, world: WorldInfo | undefined): string {
  const { t } = useUi();
  if (route.kind === "world") return world?.title ?? "";
  if (route.kind === "library") return t("shell.library");
  if (route.page === "update") return t("mlp.update");
  return t(route.page === "backups" ? "shell.backups" : "shell.configuration");
}

function BackButton(props: { readonly layout: Layout }) {
  const { store, t } = useUi();
  return (
    <button
      type="button"
      class="icon mlp-back"
      aria-label={t("mlp.back")}
      onClick={() => {
        const patch = backPatch(store.get(), props.layout);
        if (patch) store.set(patch);
      }}
    >
      <Icon name="arrow-left" />
    </button>
  );
}

/** Foundry's name, the version and the power menu. */
function HomeItems() {
  const { state, t } = useUi();
  return (
    <>
      <span class="logo" aria-hidden="true" />
      <h1 tabIndex={-1}>{t("mlp.title")}</h1>
      <span class="ml-spacer" />
      <VersionMenu compact />
      {state.data.setup?.passwordSet === false ? null : <PowerMenu />}
    </>
  );
}

/**
 * After a screen change that took the focused control away (Back, a tab),
 * focus goes to the new screen's heading, so keyboard and screen-reader
 * users keep their place (review). Never on the first render.
 */
function useFocusOnChange(
  bar: { readonly current: HTMLElement | null },
  screen: string,
): void {
  const last = useRef(screen);
  useEffect(() => {
    if (last.current === screen) return;
    last.current = screen;
    const lost = document.activeElement === document.body;
    if (lost) bar.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [bar, screen]);
}

export function PhoneTop(props: {
  readonly layout: Layout;
  readonly route: Route;
  readonly world: WorldInfo | undefined;
}) {
  const { state } = useUi();
  const { layout, route } = props;
  const title = useTitle(route, props.world);
  const nav = navOf(state);
  const back = hasBack(nav, state.route ?? route, layout);
  const home = layout === "tablet" || nav.home;
  const bar = useRef<HTMLElement>(null);
  useFocusOnChange(bar, `${String(home)}:${title}`);
  return (
    <header class="mls-top mlp-top" ref={bar}>
      {back ? <BackButton layout={layout} /> : null}
      {home ? (
        <HomeItems />
      ) : back ? (
        <h1 class="pt" tabIndex={-1}>
          {title}
        </h1>
      ) : (
        <>
          <span class="logo" aria-hidden="true" />
          <h1 tabIndex={-1}>{title}</h1>
        </>
      )}
    </header>
  );
}
