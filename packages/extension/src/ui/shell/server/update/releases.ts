// Foundry's public release list (foundryvtt.com/releases) and one release's
// page, read for Release history. The pages' HTML comes from the background
// (background/releases.ts); DOMParser runs no scripts and loads nothing, and
// only the list's text and a release's notes are kept. The notes go through
// parseNotes and the description cleaner like the update check's.

export interface ReleaseItem {
  /** "14.370". */
  readonly version: string;
  readonly generation: number;
  readonly build: number;
  /** As foundryvtt.com writes it: "November 02, 2026". */
  readonly date: string;
  readonly channel: string;
  /** Foundry's "Full" tag: installed by hand, not from Setup. */
  readonly full: boolean;
}

const VERSION = /^\/releases\/(\d{1,4})\.(\d{1,6})$/;
const CHANNELS = ["stable", "testing", "development", "prototype"];
const MAX_ITEMS = 1000;

const text = (el: Element | null): string =>
  (el?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 100);

function item(li: Element): ReleaseItem | undefined {
  const href = li.querySelector("a[href]")?.getAttribute("href") ?? "";
  const m = VERSION.exec(href);
  if (!m) return undefined;
  const tags = [...li.querySelectorAll(".release-tag")];
  const channel =
    CHANNELS.find((c) => tags.some((t) => t.classList.contains(c))) ?? "";
  return {
    version: `${m[1] ?? ""}.${m[2] ?? ""}`,
    generation: Number(m[1]),
    build: Number(m[2]),
    date: text(li.querySelector(".release-time")),
    channel,
    full: tags.some((t) => text(t).toLowerCase() === "full"),
  };
}

export function parseReleaseList(html: string): readonly ReleaseItem[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll("li.release")]
    .slice(0, MAX_ITEMS)
    .map(item)
    .filter((x): x is ReleaseItem => x !== undefined);
}

/** A release page's notes: its article, without the site around it. */
export function releaseNotesOf(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const article = doc.querySelector("article.primary-content, article");
  if (!article) return "";
  article.querySelector(".release-date")?.remove();
  return article.innerHTML;
}

export const isNewer = (a: ReleaseItem, installed: string): boolean => {
  const [g, b] = installed.split(".").map(Number);
  return a.generation !== g ? a.generation > (g ?? 0) : a.build > (b ?? 0);
};
