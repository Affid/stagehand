// One world's row in a module's Library tab: its title, what the next
// launch (or the next save, inside a world) changes, and its switch.
import type { PackageInfo } from "@stagehand/shared/package";
import type { WorldInfo } from "@stagehand/shared/world";
import { useModules } from "../context.ts";
import { COMPANION_ID } from "../model/preview.ts";
import type { WorldModuleRow } from "../model/world-modules.ts";

export interface Where {
  readonly world: WorldInfo;
  readonly tracked: boolean;
  readonly row: WorldModuleRow | undefined;
}

export function WorldItem(props: {
  readonly pkg: PackageInfo;
  readonly where: Where;
  readonly here: boolean;
}) {
  const { t, flip, canSwitch } = useModules();
  const { pkg } = props;
  const { world, row } = props.where;
  const model = { tracked: props.where.tracked };
  const on = row?.next ?? false;
  return (
    <li class={props.here ? "sts-here" : ""}>
      <span>
        {world.title}
        {props.here ? (
          <span class="st-muted"> · {t("mp.thisWorld")}</span>
        ) : null}
      </span>
      {!model.tracked ? (
        <span class="d na">{t("grid.off")}</span>
      ) : row?.delta ? (
        <span class={`d ${row.delta === "on" ? "plus" : "minus"}`}>
          {t(`mp.delta.${row.delta}`)}
        </span>
      ) : (
        <span />
      )}
      <input
        type="checkbox"
        role="switch"
        class="sts-switch"
        checked={on}
        disabled={!canSwitch || !model.tracked || pkg.id === COMPANION_ID}
        aria-label={t("wp.switch", { module: pkg.title, world: world.title })}
        onClick={(e) => {
          e.preventDefault();
          void flip(world.id, pkg.id, !on);
        }}
      />
    </li>
  );
}
