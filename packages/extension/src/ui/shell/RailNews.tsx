// News and Featured Content at the foot of the worlds rail, under Foundry's
// own names (prototype: design/setup-page/src/_calm.js railNews). News is a
// carousel of Foundry's 2.39:1 banners, open while something is unread and
// folded to its latest headline after; Featured Content is always open.
import { type NewsItem, newsUrls } from "@stagehand/shared/news";
import { useEffect, useState } from "preact/hooks";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";

/** Warm the cache for every banner once, so sliding never waits on one. */
function usePreload(items: readonly NewsItem[]): void {
  const key = items.map((n) => n.image ?? "").join("\n");
  useEffect(() => {
    for (const n of items) {
      if (!n.image) continue;
      const img = new Image();
      img.decoding = "async";
      img.src = n.image;
    }
    // Only when the set of images changes.
  }, [key]);
}

/** What the reader chose this load: folded or not, and the slide shown. */
interface View {
  readonly folded: boolean | null;
  readonly index: number;
}

/**
 * Opening an article (any tab) marks everything listed seen. The section
 * stays as it is until the next load, so a keyboard user's focus stays on
 * the banner (review); "folded once read" applies from then on.
 */
function useOpen(hold: () => void): () => void {
  const { state, actions } = useUi();
  const setup = state.data.setup;
  return () => {
    if (!setup || state.data.newsUnread.length === 0) return;
    hold();
    void actions.newsSeen(newsUrls(setup));
  };
}

function Banner(props: {
  readonly item: NewsItem;
  readonly isNew: boolean;
  readonly onOpen: () => void;
  readonly inert?: boolean;
}) {
  const { t } = useUi();
  const { item, onOpen } = props;
  return (
    <a
      class="banner"
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      title={new URL(item.url).host}
      inert={props.inert}
      onClick={onOpen}
      // A middle click opens it too; a right click only shows the menu.
      onAuxClick={(e) => {
        if (e.button === 1) onOpen();
      }}
    >
      {item.image ? <img src={item.image} alt="" decoding="async" /> : null}
      <span class="cap">
        <strong>{item.title}</strong>
        {props.isNew ? <span class="k new">{t("news.new")}</span> : null}
        <Icon name="arrow-up-right-from-square" />
        <span class="st-sr-only">{t("news.newTab")}</span>
      </span>
    </a>
  );
}

function Carousel(props: {
  readonly list: readonly NewsItem[];
  readonly unread: ReadonlySet<string>;
  readonly at: number;
  readonly onStep: (to: number) => void;
  readonly onOpen: () => void;
}) {
  const { t } = useUi();
  const { list, at } = props;
  const n = list.length;
  // From the slide shown, so a list that shrank still steps one by one (review).
  const step = (d: number) => props.onStep((((at + d) % n) + n) % n);
  return (
    <div class="viewport">
      <div class="track" style={{ transform: `translateX(-${at * 100}%)` }}>
        {list.map((x, k) => (
          <Banner
            key={`${String(k)}:${x.url}`}
            item={x}
            isNew={props.unread.has(x.url)}
            inert={k !== at}
            onOpen={props.onOpen}
          />
        ))}
      </div>
      {n > 1 ? (
        <div class="navs">
          <button
            type="button"
            aria-label={t("news.prev")}
            onClick={() => step(-1)}
          >
            <Icon name="chevron-left" />
          </button>
          <span class="c" aria-live="polite">
            {t("news.count", { i: at + 1, n })}
            <span class="st-sr-only">: {list[at]?.title}</span>
          </span>
          <button
            type="button"
            aria-label={t("news.next")}
            onClick={() => step(1)}
          >
            <Icon name="chevron-right" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function News(props: {
  readonly list: readonly NewsItem[];
  readonly unread: ReadonlySet<string>;
  readonly view: View;
  readonly onView: (v: View) => void;
  readonly onOpen: () => void;
}) {
  const { t } = useUi();
  const { list, unread, view } = props;
  const fresh = list.some((x) => unread.has(x.url));
  // Open while something is unread; the reader's own choice wins this load.
  const folded = view.folded ?? !fresh;
  const toggle = () => props.onView({ ...view, folded: !folded });
  return (
    <section
      class={`str-news${folded ? " folded" : ""}`}
      aria-label={t("news.aria")}
    >
      {/* The whole line folds by pointer; the button is its keyboard path. */}
      <header onClick={toggle}>
        <button
          type="button"
          class="icon"
          aria-expanded={!folded}
          aria-label={t("news.title")}
        >
          <Icon name={folded ? "chevron-right" : "chevron-down"} />
        </button>
        <span title={t("news.from")} aria-hidden="true">
          {t("news.title")}
        </span>
        {fresh ? <span class="new">{t("news.new")}</span> : null}
        {folded ? <span class="latest">{list[0]?.title}</span> : null}
      </header>
      {folded ? null : (
        <Carousel
          list={list}
          unread={unread}
          at={Math.min(view.index, list.length - 1)}
          onStep={(index) => props.onView({ ...view, index })}
          onOpen={props.onOpen}
        />
      )}
    </section>
  );
}

export function RailNews() {
  const { state, t } = useUi();
  const setup = state.data.setup;
  const list = setup?.news ?? [];
  const featured = setup?.featured;
  usePreload(featured ? [...list, featured] : list);
  const unread = new Set(state.data.newsUnread);
  // Kept here, so folding and unfolding returns to the same slide (review).
  const [view, setView] = useState<View>({ folded: null, index: 0 });
  const fresh = list.some((x) => unread.has(x.url));
  const open = useOpen(() =>
    setView((v) => ({ ...v, folded: v.folded ?? !fresh })),
  );
  return (
    <>
      {list.length > 0 ? (
        <News
          list={list}
          unread={unread}
          view={view}
          onView={setView}
          onOpen={open}
        />
      ) : null}
      {featured ? (
        <section class="str-feat" aria-label={t("news.featured")}>
          <span class="lbl" aria-hidden="true">
            {t("news.featured")}
          </span>
          <Banner item={featured} isNew={false} onOpen={open} />
        </section>
      ) : null}
    </>
  );
}
