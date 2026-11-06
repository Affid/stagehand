// World descriptions are Foundry HTML written by anyone who can edit a
// world. They are parsed (DOMParser runs no scripts), walked, and rebuilt
// as Preact elements from a short whitelist: no innerHTML, no attributes
// except a checked http(s) link, no images, frames, scripts or styles.
// Plain text keeps its line breaks (SETUP-REDESIGN.md, build requirements).
import type { ComponentChildren } from "preact";
import { h } from "preact";
import { safeUrl } from "./files.ts";

/** Elements kept as they are. */
const KEEP = new Set([
  "p",
  "br",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "u",
  "s",
  "code",
  "blockquote",
  "hr",
  "dl",
  "dt",
  "dd",
]);
/** Elements renamed to a kept one. */
const RENAME: Readonly<Record<string, string>> = {
  b: "strong",
  i: "em",
  h1: "h4",
  h2: "h4",
  h3: "h4",
  h4: "h4",
  h5: "h4",
  h6: "h4",
  div: "p",
};
/** Elements dropped with everything inside them. */
const DROP = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "template",
  "svg",
  "math",
  "img",
  "video",
  "audio",
  "picture",
  "canvas",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "noscript",
  "head",
  "title",
  "link",
  "meta",
]);
/** Enough for any real description; the rest is cut. */
const MAX_NODES = 3000;
/** Deeper nesting than this keeps only its text. */
const MAX_DEPTH = 32;

interface Walk {
  nodes: number;
  depth: number;
}

function children(node: Node, walk: Walk): ComponentChildren[] {
  const out: ComponentChildren[] = [];
  for (const child of node.childNodes) {
    if (walk.nodes++ > MAX_NODES) break;
    const v = convert(child, walk);
    if (v !== null) out.push(v);
  }
  return out;
}

function convert(node: Node, walk: Walk): ComponentChildren {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (DROP.has(tag)) return null;
  if (walk.depth >= MAX_DEPTH) return el.textContent;
  walk.depth++;
  const inner = children(el, walk);
  walk.depth--;
  if (tag === "a") {
    const href = safeUrl(el.getAttribute("href") ?? undefined);
    return href
      ? h(
          "a",
          {
            href,
            // Where it really goes, whatever the text says.
            title: new URL(href).host,
            target: "_blank",
            rel: "noopener noreferrer",
          },
          inner,
        )
      : h("span", null, inner);
  }
  const name = KEEP.has(tag) ? tag : RENAME[tag];
  return name ? h(name, null, inner) : h("span", null, inner);
}

const looksLikeHtml = (s: string): boolean => /<[a-z][\s\S]*>/i.test(s);

/** A parsed node's children, cleaned as a description is (Foundry's release notes). */
export const cleanChildren = (node: Node): ComponentChildren[] =>
  children(node, { nodes: 0, depth: 0 });

/** Plain text: blank lines split paragraphs, single breaks stay. */
function plain(text: string): ComponentChildren[] {
  return text
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para, i) =>
      h(
        "p",
        { key: i },
        para
          .split("\n")
          .flatMap((line, j) => (j ? [h("br", { key: j }), line] : [line])),
      ),
    );
}

export function RichText(props: { readonly html: string }) {
  const source = props.html.trim();
  if (!source) return null;
  if (!looksLikeHtml(source)) return <div class="ml-rich">{plain(source)}</div>;
  const doc = new DOMParser().parseFromString(source, "text/html");
  return (
    <div class="ml-rich">{children(doc.body, { nodes: 0, depth: 0 })}</div>
  );
}
