import { describe, expect, test } from "vitest";
import {
  isNewsImage,
  isNewsLink,
  MAX_NEWS,
  newsUrls,
  toNewsItem,
} from "../src/news.ts";
import { SetupDataSchema } from "../src/world.ts";

const IMG = "https://r2.foundryvtt.com/website-uploads-public/a.webp";

describe("Foundry's news items (Phase 6)", () => {
  test("links must be https", () => {
    expect(isNewsLink("https://foundryvtt.com/article/x/")).toBe(true);
    expect(isNewsLink("https://foundryvtt.store/products/y")).toBe(true);
    expect(isNewsLink("http://foundryvtt.com/")).toBe(false);
    expect(isNewsLink("javascript:alert(1)")).toBe(false);
    expect(isNewsLink("not a url")).toBe(false);
  });

  test("images only from foundryvtt.com or its subdomains, over https", () => {
    expect(isNewsImage(IMG)).toBe(true);
    expect(isNewsImage("https://foundryvtt.com/a.png")).toBe(true);
    expect(isNewsImage("https://evilfoundryvtt.com/a.png")).toBe(false);
    expect(isNewsImage("https://foundryvtt.com.evil.net/a.png")).toBe(false);
    expect(isNewsImage("http://r2.foundryvtt.com/a.png")).toBe(false);
    expect(isNewsImage("data:image/png;base64,AAAA")).toBe(false);
  });

  test("reads an item field by field; a bad image is dropped, a bad link drops the item", () => {
    expect(
      toNewsItem({
        title: "2026 Year in Review",
        url: "https://foundryvtt.com/article/year-in-review-2026/",
        image: IMG,
        caption: "ignored",
        extra: 1,
      }),
    ).toEqual({
      title: "2026 Year in Review",
      url: "https://foundryvtt.com/article/year-in-review-2026/",
      image: IMG,
    });
    expect(
      toNewsItem({
        title: "T",
        url: "https://foundryvtt.com/a",
        image: "https://x.example/a.png",
      }),
    ).toEqual({ title: "T", url: "https://foundryvtt.com/a" });
    expect(toNewsItem({ title: "T", url: "http://x" })).toBeUndefined();
    expect(toNewsItem({ title: "", url: "https://foundryvtt.com/a" })).toBe(
      undefined,
    );
    expect(toNewsItem(null)).toBeUndefined();
    expect(toNewsItem("x")).toBeUndefined();
  });

  test("long titles are cut", () => {
    const item = toNewsItem({
      title: "x".repeat(1000),
      url: "https://foundryvtt.com/a",
    });
    expect(item?.title.length).toBe(300);
  });

  test("the Setup data schema refuses unsafe news a page script could post", () => {
    const base = {
      core: { version: "14.370", generation: 14, build: 370 },
      isAdmin: true,
      lang: "en",
      modules: [],
      systems: [],
      worlds: [],
    };
    const good = { title: "T", url: "https://foundryvtt.com/a", image: IMG };
    expect(
      SetupDataSchema.safeParse({ ...base, news: [good], featured: good })
        .success,
    ).toBe(true);
    expect(
      SetupDataSchema.safeParse({
        ...base,
        news: [{ ...good, url: "javascript:alert(1)" }],
      }).success,
    ).toBe(false);
    expect(
      SetupDataSchema.safeParse({
        ...base,
        featured: { ...good, image: "https://tracker.example/p.gif" },
      }).success,
    ).toBe(false);
    expect(
      SetupDataSchema.safeParse({
        ...base,
        news: Array.from({ length: MAX_NEWS + 1 }, () => good),
      }).success,
    ).toBe(false);
  });

  test("newsUrls lists the news and the featured content, without repeats", () => {
    expect(
      newsUrls({
        news: [
          { title: "A", url: "https://foundryvtt.com/a" },
          { title: "B", url: "https://foundryvtt.com/b" },
        ],
        featured: { title: "A again", url: "https://foundryvtt.com/a" },
      }),
    ).toEqual(["https://foundryvtt.com/a", "https://foundryvtt.com/b"]);
    expect(newsUrls({})).toEqual([]);
  });
});
