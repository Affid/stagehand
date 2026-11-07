// Lists that scroll fade where they are cut off while more is hidden there
// (SETUP-REDESIGN.md: many worlds; prototype _calm.js `more`, `more-right`).
import { useLayoutEffect, useState } from "preact/hooks";

/** More than this past the visible edge counts as hidden. */
const SLACK = 2;

const hiddenPast = (el: HTMLElement, axis: "x" | "y"): boolean =>
  axis === "y"
    ? el.scrollTop + el.clientHeight < el.scrollHeight - SLACK
    : el.scrollLeft + el.clientWidth < el.scrollWidth - SLACK;

/**
 * Whether the box has more past its bottom (y) or right edge (x): on
 * scroll, on resize and whenever its content changes.
 */
export function useScrollFade(
  ref: { readonly current: HTMLElement | null },
  axis: "x" | "y",
): boolean {
  const [more, setMore] = useState(false);
  // Before paint, so the fade never shows a frame late (review).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const check = (): void => {
      setMore(hiddenPast(el, axis));
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const resized =
      typeof ResizeObserver === "function" ? new ResizeObserver(check) : null;
    resized?.observe(el);
    // The content's own size too: a title wrapping changes no children.
    if (el.firstElementChild) resized?.observe(el.firstElementChild);
    const changed =
      typeof MutationObserver === "function"
        ? new MutationObserver(check)
        : null;
    changed?.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", check);
      resized?.disconnect();
      changed?.disconnect();
    };
  }, [ref, axis]);
  return more;
}
