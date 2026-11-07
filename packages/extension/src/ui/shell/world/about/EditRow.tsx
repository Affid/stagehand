// One Details row as the prototype: the value with a link (Rename, Change);
// the link opens the field in place with Save and Cancel. Closes only once
// Foundry has saved; a refusal keeps what was picked.
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { useUi } from "../../../context.ts";

export interface EditorProps<T> {
  readonly value: T;
  readonly onValue: (v: T) => void;
}

interface Edit<T> {
  readonly link: string;
  readonly linkLabel: string;
  readonly initial: T;
  readonly editor: (p: EditorProps<T>) => ComponentChildren;
  readonly save: (v: T) => Promise<boolean>;
}

function Editing<T>(props: {
  readonly edit: Edit<T>;
  readonly value: T;
  readonly onValue: (v: T) => void;
  readonly onDone: (saved: boolean) => void;
}) {
  const { t } = useUi();
  const { edit } = props;
  return (
    <div class="mlw-edit">
      {edit.editor({ value: props.value, onValue: props.onValue })}
      <div class="bar">
        <button
          type="button"
          class="bright"
          onClick={() =>
            void edit.save(props.value).then((ok) => {
              if (ok) props.onDone(true);
            })
          }
        >
          {t("about.save")}
        </button>
        <button type="button" onClick={() => props.onDone(false)}>
          {t("about.cancel")}
        </button>
      </div>
    </div>
  );
}

/**
 * "Saved", in a status region that is always there and fills on a save, so
 * screen readers hear it (review: a region inserted with its text often
 * isn't read).
 */
export function SavedMark(props: { readonly on: boolean }) {
  const { t } = useUi();
  return (
    <span class="mlw-saved" role="status">
      {props.on ? (
        <>
          <i class="fa-solid fa-check" aria-hidden="true" />
          {t("about.saved")}
        </>
      ) : null}
    </span>
  );
}

/**
 * After an editor closes, focus goes back to the link that opened it
 * (review): call `closed()` when it closes, put `link` on the link.
 */
export function useBackToLink(open: boolean) {
  const link = useRef<HTMLButtonElement>(null);
  const back = useRef(false);
  useEffect(() => {
    if (!open && back.current) link.current?.focus();
    back.current = false;
  }, [open]);
  return {
    link,
    closed: () => {
      back.current = true;
    },
  };
}

export function EditRow<T>(props: {
  readonly label: string;
  readonly view: ComponentChildren;
  /** Absent: read only (no flag, a locked world, a read-only browser). */
  readonly edit?: Edit<T>;
}) {
  const [draft, setDraft] = useState<{ value: T } | null>(null);
  // "Saved" after Foundry saved, until the next edit (prototype savedMark).
  const [saved, setSaved] = useState(false);
  const focus = useBackToLink(draft !== null);
  const edit = props.edit;
  return (
    <>
      <dt>{props.label}</dt>
      <dd>
        {draft !== null && edit !== undefined ? (
          <Editing
            edit={edit}
            value={draft.value}
            onValue={(value) => setDraft({ value })}
            onDone={(ok) => {
              focus.closed();
              setDraft(null);
              setSaved(ok);
            }}
          />
        ) : (
          <>
            <span class="v">{props.view}</span>
            {edit ? (
              <button
                type="button"
                ref={focus.link}
                class="ml-link"
                aria-label={edit.linkLabel}
                onClick={() => {
                  setSaved(false);
                  setDraft({ value: edit.initial });
                }}
              >
                {edit.link}
              </button>
            ) : null}
          </>
        )}
        <SavedMark on={saved && draft === null} />
      </dd>
    </>
  );
}
