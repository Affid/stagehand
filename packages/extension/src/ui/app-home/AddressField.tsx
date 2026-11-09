// The address field: an http/https toggle and the rest as Foundry shows it.
// Pasting a whole address picks the toggle.
import { useEffect, useRef } from "preact/hooks";
import type { Translate } from "../i18n.ts";
import { readTyped, type Scheme, type Typed } from "./address.ts";

export interface AddressFieldProps {
  readonly t: Translate;
  readonly id: string;
  readonly value: Typed;
  readonly onChange: (next: Typed) => void;
  /** Focused when shown: the add sheet is for typing. */
  readonly focus?: boolean;
  readonly help: string;
}

const SCHEMES: readonly Scheme[] = ["http", "https"];

export function AddressField(props: AddressFieldProps) {
  const { t, id, value, onChange } = props;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (props.focus) input.current?.focus();
  }, [props.focus]);
  return (
    <div class="mlh-field">
      <label for={id}>{t("home.address")}</label>
      <div class="mlh-addr">
        <span class="mlh-scheme" role="group" aria-label={t("home.protocol")}>
          {SCHEMES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={value.scheme === s}
              onClick={() => {
                onChange({ ...value, scheme: s });
              }}
            >
              {s}
            </button>
          ))}
        </span>
        <input
          ref={input}
          id={id}
          value={value.rest}
          placeholder="192.168.1.20:30000"
          autocomplete="off"
          autocapitalize="off"
          spellcheck={false}
          inputmode="url"
          onInput={(e) => {
            onChange(readTyped(e.currentTarget.value, value.scheme));
          }}
        />
      </div>
      <p class="mlh-help">{props.help}</p>
    </div>
  );
}
