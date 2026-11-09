// A sheet from the bottom over a dimmed home screen: a tap outside, Escape
// or Android's Back closes it.
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { useBackClose } from "./back.ts";

export interface SheetProps {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ComponentChildren;
}

export function Sheet(props: SheetProps) {
  const { onClose } = props;
  const box = useRef<HTMLDivElement>(null);
  useBackClose(onClose);
  useEffect(() => {
    // The sheet itself, not a field: no keyboard pops up unasked.
    box.current?.focus();
  }, []);
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") onClose();
  };
  return (
    <>
      <div class="mlh-scrim" onClick={onClose} />
      <div
        ref={box}
        class="mlh-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        tabIndex={-1}
        onKeyDown={onKey}
      >
        <span class="mlh-grab" aria-hidden="true" />
        <h2>{props.title}</h2>
        {props.children}
      </div>
    </>
  );
}
