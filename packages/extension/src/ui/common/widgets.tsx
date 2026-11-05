// Small shared widgets: modal, inline text input, icons, colour dot.
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

export function Modal(props: {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ComponentChildren;
  readonly footer?: ComponentChildren;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [props.onClose]);
  return (
    <div
      class="ml-backdrop"
      onClick={(e) => e.target === e.currentTarget && props.onClose()}
    >
      <div
        class="ml-modal"
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
      >
        <header class="ml-modal-header">
          <h2>{props.title}</h2>
          <IconButton icon="xmark" label="Close" onClick={props.onClose} />
        </header>
        <div class="ml-modal-body">{props.children}</div>
        {props.footer ? (
          <footer class="ml-modal-footer">{props.footer}</footer>
        ) : null}
      </div>
    </div>
  );
}

/** A text input that commits on Enter or blur and cancels on Escape. */
export function InlineInput(props: {
  readonly initial: string;
  readonly label: string;
  readonly onCommit: (value: string) => void;
  readonly onCancel: () => void;
}) {
  const [value, setValue] = useState(props.initial);
  const ref = useRef<HTMLInputElement>(null);
  // Enter or Escape ends editing; the blur that follows must not act again.
  const done = useRef(false);
  useEffect(() => ref.current?.focus(), []);
  const finish = (fn: () => void): void => {
    if (done.current) return;
    done.current = true;
    fn();
  };
  const commit = (): void => {
    const v = value.trim();
    finish(() => (v ? props.onCommit(v) : props.onCancel()));
  };
  return (
    <input
      ref={ref}
      class="ml-inline-input"
      aria-label={props.label}
      placeholder={props.label}
      value={value}
      maxLength={80}
      onInput={(e) => {
        setValue(e.currentTarget.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") finish(props.onCancel);
      }}
      onBlur={commit}
    />
  );
}

/** A Font Awesome icon (loaded by Foundry's Setup page). */
export const Icon = (props: { readonly name: string }) => (
  <i class={`fa-solid fa-${props.name} fa-fw`} aria-hidden="true" />
);

/** An icon-only button with an accessible label and tooltip. */
export function IconButton(props: {
  readonly icon: string;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      class="ml-icon"
      title={props.label}
      aria-label={props.label}
      disabled={props.disabled ?? false}
      onClick={props.onClick}
    >
      <Icon name={props.icon} />
    </button>
  );
}

export const Dot = (props: { readonly color: string }) => (
  <span class="ml-dot" style={{ background: props.color }} aria-hidden="true" />
);
