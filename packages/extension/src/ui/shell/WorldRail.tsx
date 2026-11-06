// The rail on the left: the Library, then the worlds in Foundry's order
// with a filter, Create World and each world's flags.
import type { WorldInfo } from "@module-library/shared/world";
import { useMemo, useState } from "preact/hooks";
import { BUILD } from "../../build-info.ts";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { ago, plural } from "../i18n.ts";
import { worldOrder } from "../model/order.ts";
import { age, type WorldRow, worldRow } from "../model/worlds.ts";
import { cssImage, filterWorlds, type Route } from "./route.ts";

/** "3 days ago", or "never played" when Foundry has no date. */
export function useLastPlayed(): (world: WorldInfo) => string {
  const { t } = useUi();
  return (world) => {
    const when = world.lastPlayed ?? "";
    return Number.isFinite(Date.parse(when))
      ? ago(t, age(when, Date.now()))
      : t("shell.neverPlayed");
  };
}

/** Favourite, lock, queued changes and problems, after the title. */
function Marks(props: { readonly row: WorldRow }) {
  const { t } = useUi();
  const { world, pending, attention, status, snapshot } = props.row;
  return (
    <span class="marks">
      {world.favorite ? (
        <i
          class="fa-solid fa-star mls-wfav"
          role="img"
          aria-label={t("shell.favorite")}
        />
      ) : null}
      {world.locked ? (
        <i
          class="fa-solid fa-lock mls-wlock"
          role="img"
          aria-label={t("shell.locked")}
        />
      ) : null}
      {pending.length > 0 ? (
        <span class="flag q" title={t("shell.queuedHint")}>
          {t("shell.queued", { n: pending.length })}
        </span>
      ) : null}
      {attention ? (
        <i
          class="fa-solid fa-triangle-exclamation flag a"
          role="img"
          aria-label={t("shell.attention")}
          title={t(`sheet.status.${status}`, {
            n: snapshot?.active.length ?? 0,
          })}
        />
      ) : null}
    </span>
  );
}

function WorldItem(props: {
  readonly world: WorldInfo;
  readonly current: boolean;
}) {
  const { state, store } = useUi();
  const { world } = props;
  const lastPlayed = useLastPlayed();
  const row = worldRow(state.data, world);
  const image = cssImage(world.background, location.origin);
  return (
    <li class="mls-world-item">
      <button
        type="button"
        class={`mls-world${props.current ? " mls-on" : ""}`}
        data-world={world.id}
        aria-current={props.current ? "page" : undefined}
        onClick={() =>
          store.set({ route: { kind: "world", worldId: world.id } })
        }
      >
        <span
          class="thumb"
          style={image ? { backgroundImage: image } : undefined}
          aria-hidden="true"
        />
        <strong>{world.title}</strong>
        <Marks row={row} />
        <span class="meta">
          {world.system} · {lastPlayed(world)}
        </span>
      </button>
    </li>
  );
}

function LibraryEntry(props: { readonly current: boolean }) {
  const { state, store, t } = useUi();
  const n = state.data.setup?.modules.length ?? 0;
  return (
    <button
      type="button"
      class={`mls-lib${props.current ? " mls-on" : ""}`}
      aria-current={props.current ? "page" : undefined}
      onClick={() => store.set({ route: { kind: "library" } })}
    >
      <Icon name="books" />
      <strong>{t("shell.library")}</strong>
      <span>{plural(t, "shell.librarySub", n)}</span>
    </button>
  );
}

export function WorldRail(props: { readonly route: Route }) {
  const { state, page, t } = useUi();
  const [text, setText] = useState("");
  const worlds = state.data.setup?.worlds ?? [];
  const lang = state.data.setup?.lang;
  const ordered = useMemo(() => worldOrder(worlds, lang), [worlds, lang]);
  const shown = filterWorlds(ordered, text);
  const { route } = props;
  return (
    <aside class="application framed mls-rail" aria-label={t("shell.rail")}>
      <LibraryEntry current={route.kind === "library"} />
      <h2 class="divider">{t("shell.worlds")}</h2>
      <div class="mls-railbar">
        <input
          type="search"
          aria-label={t("shell.filter", { n: worlds.length })}
          placeholder={t("shell.filter", { n: worlds.length })}
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
        />
        <button
          type="button"
          class="icon"
          aria-label={t("shell.create")}
          title={t("shell.create")}
          onClick={() => page.foundryAction({ action: "createWorld" })}
        >
          <Icon name="plus" />
        </button>
      </div>
      <ol class="mls-worlds">
        {shown.map((w) => (
          <WorldItem
            key={w.id}
            world={w}
            current={route.kind === "world" && route.worldId === w.id}
          />
        ))}
      </ol>
      {shown.length === 0 && worlds.length > 0 ? (
        <p class="ml-empty">{t("shell.noMatch")}</p>
      ) : null}
      <p class="mls-build">{t("app.build", { build: BUILD })}</p>
    </aside>
  );
}
