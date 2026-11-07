// @vitest-environment happy-dom
import type { NewsItem } from "@module-library/shared/news";
import {
  act,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { SetupState } from "../../src/messages.ts";
import { el, renderUi, sent, setupState } from "./harness.tsx";

afterEach(cleanup);

const IMG = "https://r2.foundryvtt.com/website-uploads-public/x.webp";
const item = (title: string, image = true): NewsItem => ({
  title,
  url: `https://foundryvtt.com/article/${title.replace(/\s/g, "-")}/`,
  ...(image ? { image: IMG } : {}),
});
const NEWS = [
  item("Year in Review"),
  item("Anniversary"),
  item("Version 14", false),
];
const FEATURED = item("Bastion of Blasphemies");

const base = setupState();
const data = (over: Partial<SetupState> = {}): Partial<SetupState> => ({
  setup: base.setup
    ? { ...base.setup, news: NEWS, featured: FEATURED }
    : undefined,
  ...over,
});

const news = (container: ParentNode) => el(container, ".mlr-news");

describe("News and Featured Content at the foot of the rail (Phase 6)", () => {
  test("no news from Foundry: no section", () => {
    const { container } = renderUi("shell");
    expect(container.querySelector(".mlr-news")).toBeNull();
    expect(container.querySelector(".mlr-feat")).toBeNull();
  });

  test("something unread: open on the latest, marked New, links open a new tab safely", () => {
    const { container } = renderUi("shell", {
      data: data({ newsUnread: [NEWS[0]!.url] }),
    });
    const box = news(container);
    expect(box.classList.contains("folded")).toBe(false);
    expect(within(box).getAllByText("New").length).toBeGreaterThan(0);
    const links = box.querySelectorAll<HTMLAnchorElement>("a.banner");
    expect(links).toHaveLength(3);
    expect(links[0]?.href).toBe(NEWS[0]!.url);
    expect(links[0]?.target).toBe("_blank");
    expect(links[0]?.rel).toBe("noopener noreferrer");
    expect(links[0]?.querySelector("img")?.getAttribute("src")).toBe(IMG);
    // Only the slide shown can be reached.
    expect(links[0]?.hasAttribute("inert")).toBe(false);
    expect(links[1]?.hasAttribute("inert")).toBe(true);
    // An article without Foundry's image still shows its title.
    expect(links[2]?.querySelector("img")).toBeNull();
    expect(links[2]?.textContent).toContain("Version 14");
    expect(within(box).getByText("1 / 3")).toBeTruthy();
  });

  test("Next and Previous step through the articles and wrap around", () => {
    const { container, getByRole } = renderUi("shell", {
      data: data({ newsUnread: [NEWS[0]!.url] }),
    });
    fireEvent.click(getByRole("button", { name: "Next article" }));
    const box = news(container);
    expect(within(box).getByText("2 / 3")).toBeTruthy();
    const links = box.querySelectorAll("a.banner");
    expect(links[1]?.hasAttribute("inert")).toBe(false);
    expect(links[0]?.hasAttribute("inert")).toBe(true);
    fireEvent.click(getByRole("button", { name: "Previous article" }));
    fireEvent.click(getByRole("button", { name: "Previous article" }));
    expect(within(box).getByText("3 / 3")).toBeTruthy();
  });

  test("all read: folded to one line with the latest title; the header opens it", () => {
    const { container, getByRole } = renderUi("shell", { data: data() });
    const box = news(container);
    expect(box.classList.contains("folded")).toBe(true);
    expect(box.querySelector("a.banner")).toBeNull();
    expect(within(box).getByText("Year in Review")).toBeTruthy();
    expect(within(box).queryByText("New")).toBeNull();
    const toggle = getByRole("button", { name: "News" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(news(container).classList.contains("folded")).toBe(false);
    expect(
      getByRole("button", { name: "News" }).getAttribute("aria-expanded"),
    ).toBe("true");
  });

  test("opening an article marks every article seen; the section stays put until the next load", async () => {
    const after = data({ newsUnread: [] });
    const { container, send } = renderUi("shell", {
      data: data({ newsUnread: [NEWS[0]!.url] }),
      reply: (m) => (m.kind === "news-seen" ? setupState(after) : {}),
    });
    const banner = el(news(container), "a.banner");
    banner.focus();
    fireEvent.click(banner);
    await waitFor(() =>
      expect(sent(send)).toContainEqual({
        kind: "news-seen",
        urls: [...NEWS.map((n) => n.url), FEATURED.url],
      }),
    );
    await waitFor(() =>
      expect(within(news(container)).queryByText("New")).toBeNull(),
    );
    // Still open, so keyboard focus stays on the banner (review).
    expect(news(container).classList.contains("folded")).toBe(false);
    expect(document.activeElement).toBe(banner);
  });

  test("a right click only shows the browser's menu; a middle click opens", () => {
    const { container, send } = renderUi("shell", {
      data: data({ newsUnread: [NEWS[0]!.url] }),
    });
    const banner = el(news(container), "a.banner");
    fireEvent(banner, new MouseEvent("auxclick", { button: 2, bubbles: true }));
    expect(
      sent(send).some((m) => (m as { kind: string }).kind === "news-seen"),
    ).toBe(false);
    fireEvent(banner, new MouseEvent("auxclick", { button: 1, bubbles: true }));
    expect(
      sent(send).some((m) => (m as { kind: string }).kind === "news-seen"),
    ).toBe(true);
  });

  test("folding and unfolding keeps the slide; the live region names the article", () => {
    const { container, getByRole } = renderUi("shell", {
      data: data({ newsUnread: [NEWS[0]!.url] }),
    });
    fireEvent.click(getByRole("button", { name: "Next article" }));
    fireEvent.click(getByRole("button", { name: "News" }));
    fireEvent.click(getByRole("button", { name: "News" }));
    const live = el(news(container), ".navs .c");
    expect(live.textContent).toBe("2 / 3: Anniversary");
  });

  test("a list that shrinks under the shown slide still steps one by one", () => {
    const r = renderUi("shell", {
      data: data({ newsUnread: [NEWS[0]!.url] }),
    });
    const next = () =>
      fireEvent.click(r.getByRole("button", { name: "Next article" }));
    next();
    next();
    const two = setupState();
    void act(() => {
      r.store.set((s) => ({
        data: {
          ...s.data,
          setup: two.setup
            ? { ...two.setup, news: NEWS.slice(0, 2) }
            : undefined,
        },
      }));
    });
    expect(el(news(r.container), ".navs .c").textContent).toMatch(/^2 \/ 2/);
    next();
    expect(el(news(r.container), ".navs .c").textContent).toMatch(/^1 \/ 2/);
  });

  test("Featured Content: its own label and banner, always open", () => {
    const { container } = renderUi("shell", { data: data() });
    const feat = el(container, ".mlr-feat");
    expect(feat.getAttribute("aria-label")).toBe("Featured Content");
    const link = el(feat, "a.banner") as HTMLAnchorElement;
    expect(link.href).toBe(FEATURED.url);
    expect(link.rel).toBe("noopener noreferrer");
    expect(link.textContent).toContain("Bastion of Blasphemies");
  });

  test("one article: no arrows or counter", () => {
    const one = setupState();
    const { container } = renderUi("shell", {
      data: {
        setup: one.setup ? { ...one.setup, news: [NEWS[0]!] } : undefined,
        newsUnread: [NEWS[0]!.url],
      },
    });
    expect(container.querySelector(".mlr-news .navs")).toBeNull();
    expect(container.querySelector(".mlr-feat")).toBeNull();
  });
});
