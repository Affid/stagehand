// A setting row as the prototype's cfgRow: the name, a hint and any problem
// on the left, the control on the right; a changed row is marked.
import type { ComponentChildren } from "preact";
import type { Choice, SettingKey } from "../../../../page-config.ts";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { clean, shown } from "./model.ts";
import type { Config } from "./useConfig.ts";

export function Row(props: {
  readonly label: string;
  readonly hint?: ComponentChildren;
  readonly error?: string | undefined;
  readonly changed?: boolean;
  readonly children: ComponentChildren;
}) {
  return (
    <div class={`stc-set${props.changed ? " changed" : ""}`}>
      <div class="l">
        <strong>{props.label}</strong>
        {props.hint ? <span>{props.hint}</span> : null}
        {props.error ? (
          <span class="err" role="alert">
            <Icon name="circle-exclamation" />
            {props.error}
          </span>
        ) : null}
      </div>
      <div class="c">{props.children}</div>
    </div>
  );
}

/** A setting's current value (typed, else saved) and whether it changed. */
export function useField(c: Config, key: SettingKey) {
  const saved = c.loaded?.settings;
  const v = saved ? shown(saved, c.typed, key) : undefined;
  return {
    value: v,
    changed: saved ? clean(key, v) !== saved[key] && key in c.typed : false,
    set: (next: unknown): void => {
      c.setTyped((prev) => ({ ...prev, [key]: next }));
    },
  };
}

export function SwitchRow(props: {
  readonly c: Config;
  readonly k: SettingKey;
  readonly label: string;
  readonly hint?: ComponentChildren;
}) {
  const { canChange } = useUi();
  const f = useField(props.c, props.k);
  return (
    <Row label={props.label} hint={props.hint} changed={f.changed}>
      <input
        type="checkbox"
        role="switch"
        class="sts-switch"
        checked={f.value === true}
        disabled={!canChange}
        aria-label={props.label}
        onChange={(e) => f.set(e.currentTarget.checked)}
      />
    </Row>
  );
}

export function TextInput(props: {
  readonly c: Config;
  readonly k: SettingKey;
  readonly label: string;
  readonly placeholder?: string;
  readonly type?: "text" | "number";
}) {
  const { canChange } = useUi();
  const f = useField(props.c, props.k);
  return (
    <input
      type={props.type ?? "text"}
      list={undefined}
      aria-label={props.label}
      placeholder={props.placeholder}
      value={
        typeof f.value === "string" || typeof f.value === "number"
          ? String(f.value)
          : ""
      }
      disabled={!canChange}
      onInput={(e) => f.set(e.currentTarget.value)}
    />
  );
}

export function TextRow(props: {
  readonly c: Config;
  readonly k: SettingKey;
  readonly label: string;
  readonly hint?: ComponentChildren;
  readonly placeholder?: string;
  readonly error?: string | undefined;
}) {
  const f = useField(props.c, props.k);
  return (
    <Row
      label={props.label}
      hint={props.hint}
      error={props.error}
      changed={f.changed}
    >
      <TextInput
        c={props.c}
        k={props.k}
        label={props.label}
        {...(props.placeholder ? { placeholder: props.placeholder } : {})}
      />
    </Row>
  );
}

export function SelectRow(props: {
  readonly c: Config;
  readonly k: SettingKey;
  readonly label: string;
  readonly hint?: ComponentChildren;
  readonly options: readonly Choice[];
  /** A "none" option that saves unset. */
  readonly none?: string;
}) {
  const { canChange } = useUi();
  const f = useField(props.c, props.k);
  return (
    <Row label={props.label} hint={props.hint} changed={f.changed}>
      <select
        aria-label={props.label}
        value={typeof f.value === "string" ? f.value : ""}
        disabled={!canChange}
        onChange={(e) => f.set(e.currentTarget.value)}
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
    </Row>
  );
}
