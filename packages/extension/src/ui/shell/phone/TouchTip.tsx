// Tooltips on a touch screen (Android plan, phase 3): the page explains many
// things in `title` tooltips, which a finger can't hover. In the phone and
// tablet layouts a tap on something that only explains (a flag, an icon, a
// disabled button's wrapper) shows its explanation, and so does a long
// press on a button, as Android does; the press that showed it doesn't also
// act. The next touch, a scroll or a few seconds hide it.
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

/** Android's long-press time. */
export const LONG_PRESS_MS = 500;
const SHOW_MS = 4000;
/** A finger that moved this far is scrolling, not pressing. */
const SLOP_PX = 10;
const ACTS = "button, a[href], input, select, textarea, label, summary";
const GAP = 8;
/** The bubble keeps this far from the screen's sides. */
const EDGE = 12;

export interface Tip {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  /** Above the element (else below). */
  readonly above: boolean;
}

/** The element whose explanation a touch on `target` would show. */
export function tipTarget(target: Element): HTMLElement | null {
  const el = target.closest<HTMLElement>("[title]");
  if (!el?.title.trim()) return null;
  return el;
}

/** A finger's reach around a small icon. */
const REACH_PX = 6;

/**
 * What lies under the finger. Chrome moves a finger's target to the nearest
 * control (touch adjustment), and icons inside one take no pointer events:
 * an explained element inside the target, under the point, wins.
 */
export function underFinger(target: Element, x: number, y: number): Element {
  const inside = [...target.querySelectorAll("[title]")].find((el) => {
    const r = el.getBoundingClientRect();
    // Not shown (display: none): no box at all, not one at the corner.
    if (r.width === 0 && r.height === 0) return false;
    return (
      x >= r.left - REACH_PX &&
      x <= r.right + REACH_PX &&
      y >= r.top - REACH_PX &&
      y <= r.bottom + REACH_PX
    );
  });
  return inside ?? target;
}

/** Whether a short tap shows it: it only explains, or what it wraps is off. */
export function showsOnTap(el: HTMLElement): boolean {
  const control = el.closest(ACTS) ?? el.querySelector(ACTS);
  if (!control) return true;
  return control.matches(":disabled, [aria-disabled='true']");
}

/** A tip says this much at most (a manifest's title can be long). */
export const TIP_MAX_CHARS = 300;

export function tipAt(el: HTMLElement, viewHeight: number): Tip {
  const r = el.getBoundingClientRect();
  const above = r.top > viewHeight / 3;
  const text = el.title.trim();
  return {
    text:
      text.length > TIP_MAX_CHARS
        ? `${text.slice(0, TIP_MAX_CHARS - 1)}…`
        : text,
    x: r.left + r.width / 2,
    y: above ? r.top - GAP : r.bottom + GAP,
    above,
  };
}

interface Press {
  readonly el: HTMLElement;
  readonly x: number;
  readonly y: number;
  readonly timer: number;
}

/** One finger's state: the press under way, and whether its click acts. */
interface Finger {
  press: Press | null;
  /** A long press showed a tip: its click and context menu don't act. */
  swallow: boolean;
}

function cancelPress(f: Finger): void {
  if (f.press) window.clearTimeout(f.press.timer);
  f.press = null;
}

/** A finger down: a long press on something explained will show it. */
function pressDown(
  f: Finger,
  e: PointerEvent,
  show: (el: HTMLElement) => void,
): void {
  f.swallow = false;
  if (e.pointerType === "mouse") return;
  const at = e.target instanceof Element ? e.target : null;
  const el = at ? tipTarget(underFinger(at, e.clientX, e.clientY)) : null;
  if (!el) return;
  const timer = window.setTimeout(() => {
    f.swallow = true;
    show(el);
  }, LONG_PRESS_MS);
  f.press = { el, x: e.clientX, y: e.clientY, timer };
}

/** A finger's presses on `host`: taps and long presses that show a tip. */
function watchPresses(
  host: HTMLElement,
  onTip: (tip: Tip | null) => void,
): () => void {
  const f: Finger = { press: null, swallow: false };
  const show = (el: HTMLElement): void => {
    onTip(tipAt(el, window.innerHeight));
  };
  const cancel = (): void => {
    cancelPress(f);
  };
  const swallowed = (e: Event): void => {
    if (!f.swallow) return;
    if (e.type === "click") f.swallow = false;
    e.preventDefault();
    e.stopPropagation();
  };
  const handlers: Handlers = {
    pointerdown: (e: PointerEvent) => {
      onTip(null);
      pressDown(f, e, show);
    },
    pointermove: (e: PointerEvent) => {
      const p = f.press;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP_PX) cancel();
    },
    pointerup: () => {
      const p = f.press;
      cancel();
      if (p && !f.swallow && showsOnTap(p.el)) show(p.el);
    },
    // A long press that ended without a click: nothing left to swallow.
    pointercancel: () => {
      cancel();
      f.swallow = false;
    },
    click: swallowed,
    contextmenu: swallowed,
    scroll: () => {
      onTip(null);
    },
  };
  return listen(host, handlers, cancel);
}

type Handlers = Readonly<Record<string, (e: never) => void>>;

/** Capture-phase listeners on `host`; the returned function removes them. */
function listen(
  host: HTMLElement,
  handlers: Handlers,
  stop: () => void,
): () => void {
  const entries = Object.entries(handlers) as [string, EventListener][];
  entries.forEach(([type, fn]) => {
    host.addEventListener(type, fn, true);
  });
  return () => {
    stop();
    entries.forEach(([type, fn]) => {
      host.removeEventListener(type, fn, true);
    });
  };
}

/** Listens on `root`; returns the tip showing, if any. */
export function useTouchTips(root: {
  readonly current: HTMLElement | null;
}): Tip | null {
  const [tip, setTip] = useState<Tip | null>(null);
  useEffect(() => {
    const host = root.current;
    return host ? watchPresses(host, setTip) : undefined;
  }, [root]);
  useEffect(() => {
    if (!tip) return undefined;
    const timer = window.setTimeout(() => {
      setTip(null);
    }, SHOW_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [tip]);
  return tip;
}

/** The tip's bubble, centred on what it explains and kept on screen. */
export function TipBubble(props: { readonly tip: Tip | null }) {
  const { tip } = props;
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !tip) return;
    const w = el.offsetWidth;
    const max = window.innerWidth - EDGE - w;
    el.style.left = `${String(Math.round(Math.max(EDGE, Math.min(tip.x - w / 2, max))))}px`;
  }, [tip]);
  if (!tip) return null;
  return (
    <div
      ref={box}
      class={`mlp-tip${tip.above ? " above" : ""}`}
      role="tooltip"
      style={{ top: `${String(Math.round(tip.y))}px` }}
    >
      {tip.text}
    </div>
  );
}
