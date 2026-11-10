// Where a new module runs: a chip per world with the companion, ticked where
// it is on after the next launch. With many worlds only those it is on in
// show, and the rest are one click away (prototype intakeItem).
import type { PackageInfo } from "@stagehand/shared/package";
import { useState } from "preact/hooks";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { worldOrder } from "../../../model/order.ts";
import { worldModules } from "../../../model/world-modules.ts";

/** Up to this many worlds show at once. */
const FEW = 6;

export interface WorldOn {
  readonly id: string;
  readonly title: string;
  readonly on: boolean;
}

/** Worlds with the companion, and whether this module is on there next. */
export function useWorldsOn(id: string): readonly WorldOn[] {
  const { state } = useUi();
  return worldOrder(state.data.setup?.worlds ?? [], state.data.setup?.lang)
    .map((w) => ({ w, m: worldModules(state.data, w.id) }))
    .filter((x) => x.m.tracked)
    .map(({ w, m }) => ({
      id: w.id,
      title: w.title,
      on: m.rows.find((r) => r.pkg.id === id)?.next ?? false,
    }));
}

export function IntakeWorlds(props: {
  readonly pkg: PackageInfo;
  readonly suggested: ReadonlySet<string>;
}) {
  const { actions, t, canChange } = useUi();
  const all = useWorldsOn(props.pkg.id);
  const [open, setOpen] = useState(all.length <= FEW);
  const shown = open ? all : all.filter((w) => w.on);
  const rest = all.length - shown.length;
  return (
    <div class="chips">
      {shown.map((w) => (
        <button
          type="button"
          key={w.id}
          class={`st-chip sts-tchip${w.on ? " on" : ""}${!w.on && props.suggested.has(w.id) ? " sug" : ""}`}
          aria-pressed={w.on}
          disabled={!canChange}
          onClick={() => void actions.flip(w.id, props.pkg.id, !w.on)}
        >
          {w.on ? <Icon name="check" /> : null}
          {w.title}
        </button>
      ))}
      {!open && !shown.length ? (
        <span class="st-muted">{t("intake.noWorld")}</span>
      ) : null}
      {all.length > FEW ? (
        <button
          type="button"
          class="st-link sts-morew"
          onClick={() => setOpen(!open)}
        >
          {open
            ? t("intake.fewer")
            : shown.length
              ? t("intake.more", { n: String(rest) })
              : t("intake.choose", { n: String(all.length) })}
        </button>
      ) : null}
    </div>
  );
}
