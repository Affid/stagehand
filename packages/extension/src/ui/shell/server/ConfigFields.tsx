// The Configuration page's fields: each edits one of Foundry's settings in
// the page's draft; the saved value shows until it is changed.
import type {
  Choice,
  SettingChanges,
  SettingKey,
  Settings,
} from "../../../page-config.ts";
import { useUi } from "../../context.ts";

export interface Draft {
  readonly saved: Settings;
  readonly changes: SettingChanges;
  set(key: SettingKey, value: Settings[SettingKey]): void;
}

const current = <K extends SettingKey>(d: Draft, key: K): Settings[K] =>
  (key in d.changes ? d.changes[key] : d.saved[key]) as Settings[K];

export function Toggle(props: {
  readonly draft: Draft;
  readonly k: SettingKey;
  readonly invert?: boolean;
  readonly label: string;
}) {
  const { canChange } = useUi();
  const on = current(props.draft, props.k) === true;
  const shown = props.invert ? !on : on;
  return (
    <label class="mlc-field mlc-toggle">
      <input
        type="checkbox"
        role="switch"
        class="mls-switch"
        checked={shown}
        disabled={!canChange}
        aria-label={props.label}
        onChange={(e) => {
          const v = e.currentTarget.checked;
          props.draft.set(props.k, props.invert ? !v : v);
        }}
      />
      <span>{props.label}</span>
    </label>
  );
}

export function TextField(props: {
  readonly draft: Draft;
  readonly k: SettingKey;
  readonly label: string;
  readonly optional?: boolean;
}) {
  const { canChange } = useUi();
  const v = current(props.draft, props.k);
  return (
    <label class="mlc-field">
      <span>{props.label}</span>
      <input
        type="text"
        aria-label={props.label}
        value={typeof v === "string" ? v : ""}
        disabled={!canChange}
        onInput={(e) => {
          const text = e.currentTarget.value.trim();
          props.draft.set(props.k, props.optional && !text ? null : text);
        }}
      />
    </label>
  );
}

export function NumberField(props: {
  readonly draft: Draft;
  readonly k: SettingKey;
  readonly label: string;
  readonly optional?: boolean;
}) {
  const { canChange } = useUi();
  const v = current(props.draft, props.k);
  return (
    <label class="mlc-field">
      <span>{props.label}</span>
      <input
        type="number"
        min={1}
        max={65535}
        aria-label={props.label}
        value={typeof v === "number" ? String(v) : ""}
        disabled={!canChange}
        onInput={(e) => {
          const raw = e.currentTarget.value.trim();
          const n = Number.parseInt(raw, 10);
          if (props.optional && raw === "") props.draft.set(props.k, null);
          else if (Number.isInteger(n)) props.draft.set(props.k, n);
        }}
      />
    </label>
  );
}

export function SelectField(props: {
  readonly draft: Draft;
  readonly k: SettingKey;
  readonly label: string;
  readonly options: readonly Choice[];
  /** A "none" option that saves null. */
  readonly none?: string;
}) {
  const { canChange } = useUi();
  const v = current(props.draft, props.k);
  return (
    <label class="mlc-field">
      <span>{props.label}</span>
      <select
        aria-label={props.label}
        value={typeof v === "string" ? v : ""}
        disabled={!canChange}
        onChange={(e) => {
          const value = e.currentTarget.value;
          props.draft.set(
            props.k,
            props.none !== undefined && value === "" ? null : value,
          );
        }}
      >
        {props.none !== undefined ? (
          <option value="">{props.none}</option>
        ) : null}
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
