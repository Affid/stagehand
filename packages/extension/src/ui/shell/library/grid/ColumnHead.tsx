// A world's column: its art and name (open its page), its menu, how many
// modules are on, what is queued, and a mark when something needs attention.
import type { WorldInfo } from "@stagehand/shared/world";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import { pendingFor } from "../../../model/preview.ts";
import type { WorldModules } from "../../../model/world-modules.ts";
import { cssImage } from "../../route.ts";
import { ColumnMenu } from "./ColumnMenu.tsx";

export function ColumnHead(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
}) {
  const { state, store, t, canChange } = useUi();
  const { world, model } = props;
  const queued = pendingFor(state.data, world.id).length;
  const image = cssImage(world.background, location.origin);
  const problems = model.rows.filter((r) => r.problem).length;
  return (
    <th class={`w${model.tracked ? "" : " na"}`} scope="col">
      <div class="wh">
        <button
          type="button"
          class="open"
          aria-label={t("grid.open", { world: world.title })}
          title={t("grid.open", { world: world.title })}
          onClick={() =>
            store.set({ route: { kind: "world", worldId: world.id } })
          }
        >
          <span class="thumb" style={image ? { "--img": image } : undefined} />
          <span class="t">{world.title}</span>
        </button>
        {model.tracked && canChange ? <ColumnMenu world={world} /> : null}
      </div>
      <div class="sub">
        {model.tracked ? t("grid.on", { n: model.nextCount }) : t("grid.off")}
        {queued ? <b class="q"> · {t("grid.queued", { n: queued })}</b> : null}
        {problems ? (
          <span class="warn" title={plural(t, "grid.problems", problems)}>
            {" "}
            <Icon name="triangle-exclamation" />
          </span>
        ) : null}
      </div>
    </th>
  );
}
