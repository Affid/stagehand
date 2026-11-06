// One module on the world page: a switch, its name, a "turns on/off" chip
// when the next launch changes it, and one line that says why.
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import type { WorldModuleRow } from "../../model/world-modules.ts";
import { COMPANION_ID } from "../../model/preview.ts";
import { type WhyContext, type WhyLine, whyLine } from "./why.ts";

export interface CardProps {
  readonly row: WorldModuleRow;
  readonly worldTitle: string;
  readonly why: WhyContext;
  readonly onFlip: (moduleId: string, on: boolean) => void;
}

function WhyRow(props: {
  readonly line: WhyLine;
  readonly onFlip: (moduleId: string, on: boolean) => void;
}) {
  const { canChange } = useUi();
  const { line } = props;
  const { fix } = line;
  return (
    <div class={`l2 ${line.tone}`} title={line.title}>
      {line.icon ? <Icon name={line.icon} /> : null}
      <span>{line.text}</span>
      {fix && canChange ? (
        <button
          type="button"
          class="ml-link"
          onClick={() => props.onFlip(fix.moduleId, fix.on)}
        >
          {fix.label}
        </button>
      ) : null}
    </div>
  );
}

export function ModuleCard(props: CardProps) {
  const { t, canChange } = useUi();
  const { row } = props;
  const line = whyLine(row, props.why);
  const locked = row.pkg.id === COMPANION_ID || !canChange;
  const cls = [
    "mlw-card",
    row.next ? "on" : "off",
    row.delta === "on" ? "plus" : row.delta === "off" ? "minus" : "",
    row.problem ? "prob" : "",
    row.risk ? "risk" : "",
  ].join(" ");
  return (
    <li class={cls} data-module={row.pkg.id}>
      <div class="l1">
        <input
          type="checkbox"
          role="switch"
          class="mls-switch"
          checked={row.next}
          disabled={locked}
          aria-label={t("wp.switch", {
            module: row.pkg.title,
            world: props.worldTitle,
          })}
          onClick={(e) => {
            // The store decides what is shown once the change is queued.
            e.preventDefault();
            props.onFlip(row.pkg.id, !row.next);
          }}
        />
        <span class="t">{row.pkg.title}</span>
        {row.delta ? (
          <span class="mlw-delta">{t(`wp.delta.${row.delta}`)}</span>
        ) : null}
      </div>
      <WhyRow line={line} onFlip={props.onFlip} />
    </li>
  );
}
