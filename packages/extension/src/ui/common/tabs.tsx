// The ARIA tabs pattern for every tab row on the Setup page (Phase 6):
// a labelled tablist, one tab in the Tab order, arrow keys, Home and End
// move and select (automatic activation), and a tabpanel named by its tab.
import type { ComponentChildren } from "preact";
import { useRef } from "preact/hooks";

const tabId = (id: string, key: string): string => `${id}-tab-${key}`;
const panelId = (id: string, key: string): string => `${id}-panel-${key}`;

/** The index a key moves to, or undefined for keys the row leaves alone. */
function moveTo(key: string, at: number, n: number): number | undefined {
  switch (key) {
    case "ArrowRight":
      return (at + 1) % n;
    case "ArrowLeft":
      return (at - 1 + n) % n;
    case "Home":
      return 0;
    case "End":
      return n - 1;
    default:
      return undefined;
  }
}

export interface TabListProps<K extends string> {
  /** Unique on the page; the tabs and the panel take their ids from it. */
  readonly id: string;
  /** What the row switches between, for screen readers. */
  readonly label: string;
  readonly tabs: readonly K[];
  readonly current: K;
  readonly onTab: (key: K) => void;
  /** A tab's content: icon, label, count. */
  readonly render: (key: K) => ComponentChildren;
  readonly class?: string;
}

export function TabList<K extends string>(props: TabListProps<K>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const { tabs, current, id } = props;
  const onKeyDown = (e: KeyboardEvent) => {
    const at = tabs.indexOf(current);
    const next = moveTo(e.key, at, tabs.length);
    const key = next === undefined ? undefined : tabs[next];
    if (next === undefined || key === undefined) return;
    e.preventDefault();
    props.onTab(key);
    refs.current[next]?.focus();
  };
  return (
    <span
      class={props.class ?? "mls-tablist"}
      role="tablist"
      aria-label={props.label}
    >
      {tabs.map((k, i) => {
        const on = k === current;
        return (
          <button
            type="button"
            key={k}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={tabId(id, k)}
            class={on ? "active" : ""}
            aria-selected={on}
            // Only the panel shown exists, so only its tab names it.
            aria-controls={on ? panelId(id, k) : undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => props.onTab(k)}
            onKeyDown={onKeyDown}
          >
            {props.render(k)}
          </button>
        );
      })}
    </span>
  );
}

/**
 * The selected tab's panel. It passes its parent's flex layout through
 * (`.mls-tabpanel`), so wrapping a tab's content moves nothing.
 */
export function TabPanel(props: {
  readonly id: string;
  readonly tab: string;
  readonly class?: string;
  readonly children: ComponentChildren;
}) {
  return (
    <div
      role="tabpanel"
      id={panelId(props.id, props.tab)}
      aria-labelledby={tabId(props.id, props.tab)}
      tabIndex={0}
      class={`mls-tabpanel${props.class ? ` ${props.class}` : ""}`}
    >
      {props.children}
    </div>
  );
}
