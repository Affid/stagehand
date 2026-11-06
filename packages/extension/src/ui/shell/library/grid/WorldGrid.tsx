// The Library's By world grid, as the prototype: every module in every
// world, a switch per cell that queues a change for that world's next
// launch, group rows with each world's count, world columns with their art
// and menu, a Show filter for busy servers, and a legend. Columns never
// shrink below MIN_COL: past that it scrolls sideways, names pinned.
import type { WorldInfo } from "@module-library/shared/world";
import { useMemo, useState } from "preact/hooks";
import { useUi } from "../../../context.ts";
import type { GroupBy, LibGroup } from "../../../model/library-groups.ts";
import { type GridShow, gridWorlds } from "../../../model/world-grid.ts";
import { worldModules } from "../../../model/world-modules.ts";
import { ColumnHead } from "./ColumnHead.tsx";
import { GridBar, GridLegend } from "./GridBar.tsx";
import { GridRows } from "./GridRows.tsx";
import type { Folding, Models } from "./types.ts";

export type { Folding } from "./types.ts";

const MIN_COL = 92;
const MOD_COL = 250;

function Picker(props: {
  readonly picked: readonly string[];
  readonly onPick: (ids: readonly string[]) => void;
}) {
  const { state, t } = useUi();
  return (
    <fieldset class="mll-pick">
      <legend>{t("grid.choose")}</legend>
      {(state.data.setup?.worlds ?? []).map((w) => (
        <label key={w.id}>
          <input
            type="checkbox"
            checked={props.picked.includes(w.id)}
            onChange={(e) =>
              props.onPick(
                e.currentTarget.checked
                  ? [...props.picked, w.id]
                  : props.picked.filter((id) => id !== w.id),
              )
            }
          />
          {w.title}
        </label>
      ))}
    </fieldset>
  );
}

function Empty(props: {
  readonly show: GridShow;
  readonly total: number;
  readonly onAll: () => void;
}) {
  const { t } = useUi();
  return (
    <div class="mlw-empty">
      <i class="fa-solid fa-filter" aria-hidden="true" />
      <h3>{t("grid.empty")}</h3>
      <p>{t(`grid.empty.${props.show}`)}</p>
      {props.total ? (
        <button type="button" onClick={props.onAll}>
          {t("grid.showAll", { n: props.total })}
        </button>
      ) : null}
    </div>
  );
}

/** Each shown world's rows, rebuilt only when the data or the worlds change. */
function useWorldRows(shown: readonly WorldInfo[]): Models {
  const { state } = useUi();
  const ids = shown.map((w) => w.id).join("\n");
  return useMemo(
    () =>
      new Map(
        ids
          .split("\n")
          .filter(Boolean)
          .map((id) => {
            const model = worldModules(state.data, id);
            return [
              id,
              { model, byId: new Map(model.rows.map((r) => [r.pkg.id, r])) },
            ];
          }),
      ),
    [state.data, ids],
  );
}

function Table(props: {
  readonly groups: readonly LibGroup[];
  readonly shown: readonly WorldInfo[];
  readonly folding: Folding;
}) {
  const { state, t } = useUi();
  const models = useWorldRows(props.shown);
  return (
    <div class="mll-gridwrap">
      <table
        class="mll-grid"
        aria-label={t("lib.tab.grid")}
        style={{ minWidth: `${MOD_COL + props.shown.length * MIN_COL}px` }}
      >
        <thead>
          <tr>
            <th class="mod" scope="col">
              {t("grid.module")}
            </th>
            {props.shown.map((w) => (
              <ColumnHead
                key={w.id}
                world={w}
                model={
                  models.get(w.id)?.model ?? worldModules(state.data, w.id)
                }
              />
            ))}
          </tr>
        </thead>
        <GridRows
          groups={props.groups}
          worlds={props.shown}
          models={models}
          folding={props.folding}
        />
      </table>
    </div>
  );
}

export function WorldGrid(props: {
  readonly groups: readonly LibGroup[];
  readonly folding: Folding;
  readonly by: GroupBy;
  readonly onBy: (by: GroupBy) => void;
}) {
  const { state } = useUi();
  const [show, setShow] = useState<GridShow>("all");
  const [picked, setPicked] = useState<readonly string[]>([]);
  const result = gridWorlds(state.data, show, picked, Date.now());
  return (
    <div class="mll-gridpage">
      <GridBar
        by={props.by}
        onBy={props.onBy}
        show={show}
        onShow={setShow}
        result={result}
      />
      {show === "pick" ? <Picker picked={picked} onPick={setPicked} /> : null}
      {result.shown.length ? (
        <Table
          groups={props.groups}
          shown={result.shown}
          folding={props.folding}
        />
      ) : (
        <Empty show={show} total={result.total} onAll={() => setShow("all")} />
      )}
      <GridLegend />
    </div>
  );
}
