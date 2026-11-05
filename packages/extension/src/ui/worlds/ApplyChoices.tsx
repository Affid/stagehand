// The Apply dialog's choices: world (when opened without one), presets with
// a filter, and the mode as three cards (P-3).
import type { Preset } from "@module-library/shared/library/schema";
import type { ApplyMode } from "@module-library/shared/resolver";
import { useState } from "preact/hooks";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { presetModules } from "../model/preview.ts";

/** Presets get a filter box once there are more than this many. */
const FILTER_FROM = 6;

const MODES: readonly { mode: ApplyMode; icon: string }[] = [
  { mode: "add", icon: "plus" },
  { mode: "replace", icon: "right-left" },
  { mode: "remove", icon: "minus" },
];

export function Step(props: {
  readonly n: number;
  readonly title: string;
  readonly aside?: string;
}) {
  return (
    <h3 class="ml-step">
      <span class="ml-step-n" aria-hidden="true">
        {props.n}
      </span>
      {props.title}
      {props.aside ? <span class="ml-step-aside">{props.aside}</span> : null}
    </h3>
  );
}

export function WorldPicker(props: {
  readonly worldId: string | null;
  readonly onPick: (id: string | null) => void;
}) {
  const { state, t } = useUi();
  const worlds = state.data.setup?.worlds ?? [];
  return (
    <label class="ml-world-pick">
      <span>{t("apply.world")}</span>
      <select
        value={props.worldId ?? ""}
        onChange={(e) => props.onPick(e.currentTarget.value || null)}
      >
        <option value="">{t("apply.pickWorld")}</option>
        {worlds.map((w) => (
          <option key={w.id} value={w.id}>
            {w.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function PresetRows(props: {
  readonly presets: readonly Preset[];
  readonly chosen: readonly string[];
  readonly onToggle: (id: string) => void;
}) {
  return (
    <ul class="ml-choice-list">
      {props.presets.map((p) => (
        <li
          key={p.id}
          class={props.chosen.includes(p.id) ? "ml-on" : undefined}
        >
          <label>
            <input
              type="checkbox"
              checked={props.chosen.includes(p.id)}
              onChange={() => props.onToggle(p.id)}
            />
            <span class="ml-choice-text">
              <span class="ml-choice-name">{p.name}</span>
              {p.description ? (
                <span class="ml-choice-hint">{p.description}</span>
              ) : null}
            </span>
            <span class="ml-count">{p.modules.length}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export function PresetPicker(props: {
  readonly n: number;
  readonly chosen: readonly string[];
  readonly onToggle: (id: string) => void;
}) {
  const { state, t } = useUi();
  const [filter, setFilter] = useState("");
  const all = state.data.library.presets;
  const q = filter.trim().toLowerCase();
  const presets = q
    ? all.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(q))
    : all;
  const modules = presetModules(state.data, props.chosen).length;
  return (
    <section class="ml-apply-presets">
      <Step
        n={props.n}
        title={t("apply.presets")}
        aside={t("apply.selected", { n: props.chosen.length, m: modules })}
      />
      {all.length === 0 ? <p>{t("apply.noPresets")}</p> : null}
      {all.length > FILTER_FROM ? (
        <input
          type="search"
          class="ml-apply-filter"
          placeholder={t("apply.filter")}
          aria-label={t("apply.filter")}
          value={filter}
          onInput={(e) => setFilter(e.currentTarget.value)}
        />
      ) : null}
      <PresetRows
        presets={presets}
        chosen={props.chosen}
        onToggle={props.onToggle}
      />
    </section>
  );
}

export function ModeCards(props: {
  readonly n: number;
  readonly mode: ApplyMode;
  readonly onMode: (mode: ApplyMode) => void;
  readonly removeDependents: boolean;
  readonly onRemoveDependents: (on: boolean) => void;
}) {
  const { t } = useUi();
  return (
    <fieldset class="ml-modes">
      <legend>
        <Step n={props.n} title={t("apply.mode")} />
      </legend>
      {MODES.map(({ mode, icon }) => (
        <label
          key={mode}
          class={`ml-mode-card${props.mode === mode ? " ml-on" : ""}`}
        >
          <input
            type="radio"
            name="ml-mode"
            value={mode}
            checked={props.mode === mode}
            onChange={() => props.onMode(mode)}
          />
          <Icon name={icon} />
          <span class="ml-choice-text">
            <span class="ml-choice-name">{t(`mode.${mode}`)}</span>
            <span class="ml-choice-hint">{t(`mode.${mode}.hint`)}</span>
          </span>
        </label>
      ))}
      {props.mode !== "add" ? (
        <label class="ml-check">
          <input
            type="checkbox"
            checked={props.removeDependents}
            onChange={(e) => props.onRemoveDependents(e.currentTarget.checked)}
          />
          {t("apply.removeDependents")}
        </label>
      ) : null}
    </fieldset>
  );
}
