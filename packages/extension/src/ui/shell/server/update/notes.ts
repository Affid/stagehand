// Foundry's release notes (HTML from foundryvtt.com, as its update check
// returns them) read into what the notes reader shows: the title, the
// banner, the opening, and sections (h2, or an h3 before the first one, as
// Breaking Changes) with areas (h3) and entries (list items). Each entry's
// GitHub issue link becomes its number. Nothing here is rendered as HTML:
// the reader draws the kept elements through the description cleaner
// (rich-text.tsx). DOMParser runs no scripts and loads no images.

export type SectionKind = "breaking" | "dev" | "user";

export interface NoteEntry {
  /** The list item, with its issue link taken out. */
  readonly node: Element;
  readonly issue: number | null;
  /** For the search. */
  readonly text: string;
}

export interface NoteArea {
  readonly h: string;
  /** "Package Development" inside a section for everyone. */
  readonly dev: boolean;
  readonly intro: readonly Element[];
  readonly items: readonly NoteEntry[];
}

export interface NoteSection {
  readonly h: string;
  readonly kind: SectionKind;
  readonly intro: readonly Element[];
  readonly items: readonly NoteEntry[];
  readonly areas: readonly NoteArea[];
}

export interface Banner {
  readonly src: string;
  readonly alt: string;
  readonly caption: Element | null;
}

export interface Notes {
  readonly title: string;
  readonly banner: Banner | null;
  readonly intro: readonly Element[];
  readonly sections: readonly NoteSection[];
}

const kindOf = (h: string): SectionKind =>
  /breaking/i.test(h)
    ? "breaking"
    : /^(api|documentation)\b/i.test(h)
      ? "dev"
      : "user";

const squash = (s: string | null): string =>
  (s ?? "").replace(/\s+/g, " ").trim();

const ISSUE =
  /^https:\/\/github\.com\/foundryvtt\/foundryvtt\/issues\/(\d{1,7})$/;

/** Foundry's banner is its own image on foundryvtt.com; nothing else is loaded. */
export function bannerSrc(src: string | null): string | undefined {
  if (!src) return undefined;
  try {
    const url = new URL(src);
    const ours =
      url.hostname === "foundryvtt.com" ||
      url.hostname.endsWith(".foundryvtt.com");
    return url.protocol === "https:" && ours ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function entry(li: Element): NoteEntry {
  const node = li.cloneNode(true) as Element;
  let issue: number | null = null;
  for (const a of node.querySelectorAll("a[href]")) {
    const m = ISSUE.exec(a.getAttribute("href") ?? "");
    if (!m) continue;
    issue = Number(m[1]);
    a.remove();
  }
  return { node, issue, text: squash(node.textContent) };
}

interface Draft {
  title: string;
  banner: Banner | null;
  intro: Element[];
  sections: {
    h: string;
    kind: SectionKind;
    intro: Element[];
    items: NoteEntry[];
    areas: { h: string; dev: boolean; intro: Element[]; items: NoteEntry[] }[];
  }[];
}

function banner(el: Element): Banner | null {
  const img = el.querySelector("img");
  const src = bannerSrc(img?.getAttribute("src") ?? null);
  if (!src) return null;
  return {
    src,
    alt: (img?.getAttribute("alt") ?? "").slice(0, 300),
    caption: el.querySelector("figcaption"),
  };
}

/** One top-level block, added where it belongs. */
function take(out: Draft, el: Element): void {
  const tag = el.tagName;
  const text = squash(el.textContent);
  const sec = out.sections.at(-1);
  const area = sec?.areas.at(-1);
  if (tag === "H2" && !out.title && /release notes/i.test(text)) {
    out.title = text
      .replace(/\s*release notes$/i, "")
      .replace(/^Foundry Virtual Tabletop\s*-\s*/i, "");
  } else if (tag === "FIGURE") {
    if (!sec && !out.banner) out.banner = banner(el);
  } else if (tag === "H2" || (tag === "H3" && !sec)) {
    out.sections.push({
      h: text,
      kind: kindOf(text),
      intro: [],
      items: [],
      areas: [],
    });
  } else if (tag === "H3" && sec) {
    sec.areas.push({
      h: text,
      dev: /package development/i.test(text),
      intro: [],
      items: [],
    });
  } else if (tag === "P" || tag === "DL") {
    (area ?? sec ?? out).intro.push(el);
  } else if (sec) {
    const items = [...el.children].filter((x) => x.tagName === "LI").map(entry);
    (area ?? sec).items.push(...items);
  }
}

const BLOCKS = "h2, h3, ul, ol, p, dl, figure";

export function parseNotes(html: string): Notes {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: Draft = { title: "", banner: null, intro: [], sections: [] };
  const blocks = [...doc.body.querySelectorAll(BLOCKS)].filter(
    (el) => !el.parentElement?.closest("li, figure, p, dl"),
  );
  for (const el of blocks) take(out, el);
  // An h3 section like Breaking Changes is followed by the first h2; empty shells go.
  const sections = out.sections
    .map((s) => ({ ...s, areas: s.areas.filter((a) => a.items.length) }))
    .filter((s) => s.items.length || s.areas.length);
  return { ...out, sections };
}

/** Every entry of a section, its areas' included. */
export const entriesOf = (s: NoteSection): readonly NoteEntry[] => [
  ...s.items,
  ...s.areas.flatMap((a) => a.items),
];
