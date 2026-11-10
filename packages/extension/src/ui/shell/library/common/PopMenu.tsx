// A button that opens a short pick list (the prototype's st-pop with
// sts-pick): each item picks and closes; off items say why.
import type { ComponentChildren } from "preact";
import { useDisclosure } from "../../../common/disclosure.ts";
import { Icon } from "../../../common/widgets.tsx";

export interface PopItem {
  readonly key: string;
  readonly label: string;
  readonly icon?: ComponentChildren;
  /** Right-hand note: a count, "companion off". */
  readonly extra?: string;
  readonly disabled?: boolean;
  readonly onPick: () => void;
}

function PopList(props: {
  readonly title: string;
  readonly items: readonly PopItem[];
  readonly note?: string;
  readonly first: (el: HTMLButtonElement | null) => void;
  readonly onPick: () => void;
}) {
  return (
    <section class="st-pop" role="region" aria-label={props.title}>
      <header>
        <strong>{props.title}</strong>
      </header>
      <ul class="sts-pick">
        {props.items.map((x, i) => (
          <li key={x.key} class={x.disabled ? "dis" : ""}>
            <button
              type="button"
              ref={(el) => {
                if (i === 0) props.first(el);
              }}
              disabled={x.disabled ?? false}
              onClick={() => {
                props.onPick();
                x.onPick();
              }}
            >
              {x.icon ?? <span />}
              <span>{x.label}</span>
              <span class="st-muted">{x.extra ?? ""}</span>
            </button>
          </li>
        ))}
      </ul>
      {props.note ? <div class="sts-pop-note">{props.note}</div> : null}
    </section>
  );
}

export function PopMenu(props: {
  readonly label: string;
  readonly icon: string;
  readonly title: string;
  readonly items: readonly PopItem[];
  readonly note?: string;
  readonly disabled?: boolean;
  readonly bright?: boolean;
  /** Only the icon shows; the label is its name. */
  readonly iconOnly?: boolean;
}) {
  const d = useDisclosure<HTMLSpanElement>();
  return (
    <span class="sts-popwrap" ref={d.wrap} onFocusOut={d.onFocusOut}>
      <button
        type="button"
        ref={d.trigger}
        class={[
          props.bright ? "bright" : "",
          props.iconOnly ? "icon" : "",
          d.open ? "st-on" : "",
        ]
          .join(" ")
          .trim()}
        disabled={props.disabled ?? false}
        aria-expanded={d.open}
        aria-haspopup="true"
        aria-label={props.iconOnly ? props.label : undefined}
        title={props.iconOnly ? props.label : undefined}
        onClick={() => d.setOpen(!d.open)}
      >
        <Icon name={props.icon} />
        {props.iconOnly ? null : props.label}
      </button>
      {d.open ? (
        <PopList
          title={props.title}
          items={props.items}
          {...(props.note ? { note: props.note } : {})}
          first={(el) => {
            d.first.current = el;
          }}
          onPick={() => d.close(true)}
        />
      ) : null}
    </span>
  );
}
