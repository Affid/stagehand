// A world description cleaned before Foundry's editor opens it: Foundry's
// prose-mirror sets its HTML as live markup, so handlers in an imported
// world would run on Setup (security review). DOMParser runs no scripts;
// the copy keeps formatting, but no attribute except a checked link or
// image source.
import { safeUrl } from "./files.ts";

const KEEP = new Set([
  "p",
  "br",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "code",
  "pre",
  "blockquote",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "img",
  "span",
  "div",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "section",
]);
const DROP = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "template",
  "svg",
  "math",
  "video",
  "audio",
  "canvas",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "noscript",
  "link",
  "meta",
  "base",
]);
const MAX_DEPTH = 32;

/** A relative path inside Foundry's data, or an http(s) URL. */
const imageSrc = (v: string | null): string | undefined => {
  if (!v) return undefined;
  if (/^[a-z0-9_\-./%]+$/i.test(v) && !v.startsWith("//")) return v;
  return safeUrl(v);
};

function copy(from: Node, into: Node, doc: Document, depth: number): void {
  for (const node of from.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      into.appendChild(doc.createTextNode(node.textContent ?? ""));
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (DROP.has(tag)) continue;
    if (!KEEP.has(tag) || depth >= MAX_DEPTH) {
      copy(el, into, doc, depth + 1);
      continue;
    }
    const out = doc.createElement(tag);
    if (tag === "a") {
      const href = safeUrl(el.getAttribute("href") ?? undefined);
      if (href) out.setAttribute("href", href);
    }
    if (tag === "img") {
      const src = imageSrc(el.getAttribute("src"));
      if (!src) continue;
      out.setAttribute("src", src);
      const alt = el.getAttribute("alt");
      if (alt) out.setAttribute("alt", alt.slice(0, 300));
    }
    copy(el, out, doc, depth + 1);
    into.appendChild(out);
  }
}

const looksLikeHtml = (s: string): boolean => /<[a-z][\s\S]*>/i.test(s);

/** Plain text: blank lines split paragraphs. */
function plain(text: string, doc: Document): void {
  for (const para of text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)) {
    const p = doc.createElement("p");
    p.textContent = para;
    doc.body.appendChild(p);
  }
}

export function cleanForEditor(html: string): string {
  const out = document.implementation.createHTMLDocument("");
  const source = html.trim();
  if (!looksLikeHtml(source)) plain(source, out);
  else
    copy(
      new DOMParser().parseFromString(source, "text/html").body,
      out.body,
      out,
      0,
    );
  return out.body.innerHTML;
}
