// A colour choice: the palette as swatches plus any custom colour, in a
// small popover. Picking closes it.
import { PALETTE, PALETTE_NAMES } from "../actions.ts";
import { useUi } from "../context.ts";
import { closePopover, useDismiss } from "./popover.ts";
import { Icon } from "./widgets.tsx";

export function ColorPicker(props: {
  readonly label: string;
  readonly value: string;
  readonly onPick: (color: string) => void;
}) {
  const { t } = useUi();
  const ref = useDismiss();
  const current = props.value.toLowerCase();
  const pick = (color: string): void => {
    closePopover(ref.current);
    if (color.toLowerCase() !== current) props.onPick(color.toLowerCase());
  };
  return (
    <details class="ml-color-picker" ref={ref}>
      <summary class="ml-icon" title={props.label} aria-label={props.label}>
        <Icon name="palette" />
      </summary>
      <div class="ml-swatches" role="group" aria-label={props.label}>
        {PALETTE.map((color, i) => (
          <button
            key={color}
            type="button"
            class={`ml-swatch${color === current ? " ml-on" : ""}`}
            style={{ background: color }}
            title={t(`color.${PALETTE_NAMES[i] ?? "grey"}`)}
            aria-label={t(`color.${PALETTE_NAMES[i] ?? "grey"}`)}
            aria-pressed={color === current}
            onClick={() => {
              pick(color);
            }}
          />
        ))}
        <label class="ml-swatch-custom">
          <input
            type="color"
            value={current}
            onChange={(e) => {
              pick(e.currentTarget.value);
            }}
          />
          {t("color.custom")}
        </label>
      </div>
    </details>
  );
}
