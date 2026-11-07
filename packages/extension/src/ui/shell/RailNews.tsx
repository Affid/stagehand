// News and Featured Content at the foot of the worlds rail, under Foundry's
// own names (prototype: design/setup-page/src/_calm.js railNews). News is a
// carousel of Foundry's 2.39:1 banners, open while something is unread and
// folded to its latest headline after; Featured Content is always open.
import { type NewsItem, newsUrls } from "@module-library/shared/news";
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

/** Opening an article (any button, any tab) marks everything listed seen. */
function useOpen(): () => void {
  const { state, actions } = useUi();
  const setup = state.data.setup;
  return () => {
    if (setup && state.data.newsUnread.length > 0)
      void actions.newsSeen(newsUrls(setup));
  };
}

function Banner(props: {
  readonly item: NewsItem;
  readonly isNew: boolean;
  readonly inert?: boolean;
}) {
  const { t } = useUi();
  const open = useOpen();
  const { item } = props;
  return (
    <a
      class="banner"
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      title={new URL(item.url).host}
      inert={props.inert}
      onClick={open}
      onAuxClick={open}
    >
      {item.image ? <img src={item.image} alt="" decoding="async" /> : null}
      <span class="cap">
        <strong>{item.title}</strong>
        {props.isNew ? <span class="k new">{t("news.new")}</span> : null}
        <Icon name="arrow-up-right-from-square" />
        <span class="ml-sr-only">{t("news.newTab")}</span>
      </span>
    </a>
  );
}

function Carousel(props: {
  readonly list: readonly NewsItem[];
  readonly unread: ReadonlySet<string>;
}) {
  const { t } = useUi();
  const [index, setIndex] = useState(0);
  const { list } = props;
  const n = list.length;
  const at = Math.min(index, n - 1);
  const step = (d: number) => setIndex((i) => (((i + d) % n) + n) % n);
  return (
    <div class="viewport">
      <div class="track" style={{ transform: `translateX(-${at * 100}%)` }}>
        {list.map((x, k) => (
          <Banner
            key={x.url}
            item={x}
            isNew={props.unread.has(x.url)}
            inert={k !== at}
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
}) {
  const { t } = useUi();
  const { list, unread } = props;
  const fresh = list.some((x) => unread.has(x.url));
  // Open while something is unread; the reader's own choice wins this load.
  const [choice, setChoice] = useState<boolean | null>(null);
  const folded = choice ?? !fresh;
  const toggle = () => setChoice(!folded);
  return (
    <section
      class={`mlr-news${folded ? " folded" : ""}`}
      aria-label={t("news.aria")}
    >
      {/* The whole line folds by pointer; the button is its keyboard path. */}
      <header onClick={toggle}>
        <button
          type="button"
          class="icon"
          aria-expanded={!folded}
          aria-label={t(folded ? "news.show" : "news.hide")}
        >
          <Icon name={folded ? "chevron-right" : "chevron-down"} />
        </button>
        <span title={t("news.from")}>{t("news.title")}</span>
        {fresh ? <span class="new">{t("news.new")}</span> : null}
        {folded ? <span class="latest">{list[0]?.title}</span> : null}
      </header>
      {folded ? null : <Carousel list={list} unread={unread} />}
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
  return (
    <>
      {list.length > 0 ? <News list={list} unread={unread} /> : null}
      {featured ? (
        <section class="mlr-feat" aria-label={t("news.featured")}>
          <span class="lbl" aria-hidden="true">
            {t("news.featured")}
          </span>
          <Banner item={featured} isNew={false} />
        </section>
      ) : null}
    </>
  );
}
