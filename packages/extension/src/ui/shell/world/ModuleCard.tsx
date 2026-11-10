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
          class="st-link"
          onClick={() => props.onFlip(fix.moduleId, fix.on)}
        >
          {fix.label}
        </button>
      ) : null}
    </div>
  );
}

/** The name opens the module's details beside the page; again, closes them. */
function OpenName(props: { readonly id: string; readonly title: string }) {
  const { state, store } = useUi();
  const open = state.panel === props.id;
  return (
    <button
      type="button"
      class="t"
      aria-expanded={open}
      onClick={() => store.set({ panel: open ? null : props.id, side: null })}
    >
      {props.title}
    </button>
  );
}

export function ModuleCard(props: CardProps) {
  const { state, t, canChange } = useUi();
  const { row } = props;
  const line = whyLine(row, props.why);
  const locked = row.pkg.id === COMPANION_ID || !canChange;
  const cls = [
    "stw-card",
    row.next ? "on" : "off",
    row.delta === "on" ? "plus" : row.delta === "off" ? "minus" : "",
    row.problem ? "prob" : "",
    row.risk ? "risk" : "",
    state.panel === row.pkg.id ? "viewing" : "",
  ].join(" ");
  return (
    <li class={cls} data-module={row.pkg.id}>
      <div class="l1">
        <input
          type="checkbox"
          role="switch"
          class="sts-switch"
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
        <OpenName id={row.pkg.id} title={row.pkg.title} />
        {row.delta ? (
          <span class="stw-delta">{t(`wp.delta.${row.delta}`)}</span>
        ) : null}
      </div>
      <WhyRow line={line} onFlip={props.onFlip} />
    </li>
  );
}
