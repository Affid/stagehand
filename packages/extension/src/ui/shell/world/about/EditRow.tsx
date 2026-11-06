// One Details row as the prototype: the value with a link (Rename, Change);
// the link opens the field in place with Save and Cancel. Closes only once
// Foundry has saved; a refusal keeps what was picked.
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
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
  readonly onDone: () => void;
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
              if (ok) props.onDone();
            })
          }
        >
          {t("about.save")}
        </button>
        <button type="button" onClick={props.onDone}>
          {t("about.cancel")}
        </button>
      </div>
    </div>
  );
}

export function EditRow<T>(props: {
  readonly label: string;
  readonly view: ComponentChildren;
  /** Absent: read only (no flag, a locked world, a read-only browser). */
  readonly edit?: Edit<T>;
}) {
  const [draft, setDraft] = useState<{ value: T } | null>(null);
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
            onDone={() => setDraft(null)}
          />
        ) : (
          <>
            <span class="v">{props.view}</span>
            {edit ? (
              <button
                type="button"
                class="ml-link"
                aria-label={edit.linkLabel}
                onClick={() => setDraft({ value: edit.initial })}
              >
                {edit.link}
              </button>
            ) : null}
          </>
        )}
      </dd>
    </>
  );
}
