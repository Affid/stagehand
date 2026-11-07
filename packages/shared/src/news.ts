// Foundry's News and Featured Content on Setup (`game.data.news`,
// `game.data.featuredContent`): from its update check, kept in the server's
// Logs/news.json. Each item is {title, image, url, caption?}. Read field by
// field; links must be https, images load only from foundryvtt.com.
import { z } from "zod";

export const MAX_NEWS = 20;
const MAX_NEWS_TITLE = 300;
const MAX_NEWS_URL = 1000;

const parse = (s: string): URL | undefined => {
  try {
    return new URL(s);
  } catch {
    return undefined;
  }
};

/** An article link: any https page (foundryvtt.com, its store). */
export function isNewsLink(s: string): boolean {
  return s.length <= MAX_NEWS_URL && parse(s)?.protocol === "https:";
}

/** A banner: only Foundry's own images, so a forged item can't track viewers. */
export function isNewsImage(s: string): boolean {
  const url = s.length <= MAX_NEWS_URL ? parse(s) : undefined;
  if (url?.protocol !== "https:") return false;
  return (
    url.hostname === "foundryvtt.com" ||
    url.hostname.endsWith(".foundryvtt.com")
  );
}

export const NewsItemSchema = z.object({
  title: z.string().min(1).max(MAX_NEWS_TITLE),
  url: z.string().refine(isNewsLink, "Not an https link"),
  image: z.string().refine(isNewsImage, "Not Foundry's image").optional(),
});

export type NewsItem = z.infer<typeof NewsItemSchema>;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** One item from Foundry's data, or undefined when it has no title or safe link. */
export function toNewsItem(raw: unknown): NewsItem | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const title = str(r.title).slice(0, MAX_NEWS_TITLE);
  const url = str(r.url);
  if (!title || !isNewsLink(url)) return undefined;
  const image = str(r.image);
  return { title, url, ...(isNewsImage(image) ? { image } : {}) };
}

/** Every article's link, news first, without repeats (read state). */
export function newsUrls(data: {
  readonly news?: readonly NewsItem[] | undefined;
  readonly featured?: NewsItem | undefined;
}): string[] {
  const all = [...(data.news ?? []), ...(data.featured ? [data.featured] : [])];
  return [...new Set(all.map((n) => n.url))];
}
