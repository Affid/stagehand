// A panel's text field (a tag's or a preset's name, a preset's About) that
// keeps what is typed until it is committed (Enter, or leaving the field).
// A save or a sync that lands meanwhile only bumps the item's revision, and
// must not put the stored text back under the owner's typing. A new stored
// value replaces it.
import { useEffect, useState } from "preact/hooks";

export interface DraftFieldProps {
  readonly label: string;
  readonly value: string;
  readonly disabled: boolean;
  readonly multiline?: boolean;
  /** Saves the typed text; false when it isn't taken (empty, unchanged). */
  readonly onCommit: (text: string) => boolean;
}

export function DraftField(props: DraftFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => {
    setDraft(null);
  }, [props.value]);
  const shared = {
    "aria-label": props.label,
    value: draft ?? props.value,
    disabled: props.disabled,
    onInput: (e: { currentTarget: { value: string } }) => {
      setDraft(e.currentTarget.value);
    },
    onChange: (e: { currentTarget: { value: string } }) => {
      if (!props.onCommit(e.currentTarget.value)) setDraft(null);
    },
  };
  return props.multiline ? (
    <textarea {...shared} />
  ) : (
    <input type="text" {...shared} />
  );
}
