// The Library's By world grid: every module in every world, a switch per
// cell that queues a change for that world's next launch, and a Show filter
// for busy servers. Columns never shrink below MIN_COL: past that it
// scrolls sideways with the module names pinned (SETUP-REDESIGN.md).
import type { WorldInfo } from "@module-library/shared/world";
import { useState } from "preact/hooks";
import { useUi } from "../../context.ts";
import { plural } from "../../i18n.ts";
import type { LibGroup } from "../../model/library-groups.ts";
import { pendingFor } from "../../model/preview.ts";
import {
  GRID_SHOWS,
  type GridShow,
  type GridWorlds,
  gridWorlds,
} from "../../model/world-grid.ts";
import { type WorldModules, worldModules } from "../../model/world-modules.ts";

const MIN_COL = 92;
const MOD_COL = 250;

type Models = ReadonlyMap<string, WorldModules>;

function Head(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
}) {
  const { state, store, t } = useUi();
  const { world, model } = props;
  const queued = pendingFor(state.data, world.id).length;
  return (
    <th class="w" scope="col">
      <button
        type="button"
        aria-label={t("grid.open", { world: world.title })}
        onClick={() =>
          store.set({ route: { kind: "world", worldId: world.id } })
        }
      >
        <span class="t">{world.title}</span>
      </button>
      <div class="sub">
        {model.tracked ? t("grid.on", { n: model.nextCount }) : "–"}
        {queued ? <b class="q"> · {t("grid.queued", { n: queued })}</b> : null}
      </div>
    </th>
  );
}

function Cell(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules | undefined;
  readonly moduleId: string;
  readonly title: string;
}) {
  const { actions, t, canChange } = useUi();
  const row = props.model?.rows.find((r) => r.pkg.id === props.moduleId);
  if (!props.model?.tracked || !row)
    return (
      <td class="na" title={t("grid.na")}>
        –
      </td>
    );
  const delta =
    row.delta === "on" ? "plus" : row.delta === "off" ? "minus" : "";
  return (
    <td class={`${delta}${row.problem ? " prob" : ""}`}>
      <input
        type="checkbox"
        role="switch"
        class="mls-switch"
        checked={row.next}
        disabled={!canChange || props.moduleId === "module-library"}
        aria-label={t("wp.switch", {
          module: props.title,
          world: props.world.title,
        })}
        onClick={(e) => {
          e.preventDefault();
          void actions.flip(props.world.id, props.moduleId, !row.next);
        }}
      />
    </td>
  );
}

function Rows(props: {
  readonly groups: readonly LibGroup[];
  readonly worlds: readonly WorldInfo[];
  readonly models: Models;
}) {
  const { t } = useUi();
  return (
    <tbody>
      {props.groups.flatMap((g) => [
        <tr
          key={`g:${g.key}`}
          class="grp"
          style={{ "--c": g.color ?? "var(--color-cool-3)" }}
        >
          <th scope="rowgroup" colSpan={props.worlds.length + 1}>
            {g.name ?? t(g.label ?? "", g.param ? { param: g.param } : {})}
            <span class="n">{g.modules.length}</span>
          </th>
        </tr>,
        ...g.modules.map((m) => (
          <tr key={m.id} data-module={m.id}>
            <th scope="row">{m.title}</th>
            {props.worlds.map((w) => (
              <Cell
                key={w.id}
                world={w}
                model={props.models.get(w.id)}
                moduleId={m.id}
                title={m.title}
              />
            ))}
          </tr>
        )),
      ])}
    </tbody>
  );
}

function ShowBar(props: {
  readonly show: GridShow;
  readonly onShow: (s: GridShow) => void;
  readonly result: GridWorlds;
}) {
  const { t } = useUi();
  const { shown, total, hiddenQueued } = props.result;
  return (
    <div class="mll-gridbar">
      <label class="mll-by">
        <span>{t("grid.show")}</span>
        <select
          aria-label={t("grid.show")}
          value={props.show}
          onChange={(e) => props.onShow(e.currentTarget.value as GridShow)}
        >
          {GRID_SHOWS.map((s) => (
            <option key={s} value={s}>
              {t(`grid.show.${s}`)}
            </option>
          ))}
        </select>
      </label>
      <span class="mll-showing">
        {shown.length === total
          ? plural(t, "grid.showing", total)
          : t("grid.showingSome", { n: shown.length, total })}
        {hiddenQueued.length ? (
          <>
            {" · "}
            <button
              type="button"
              class="ml-link"
              title={hiddenQueued.map((w) => w.title).join(", ")}
              onClick={() => props.onShow("all")}
            >
              {plural(t, "grid.hidden", hiddenQueued.length)}
            </button>
          </>
        ) : null}
      </span>
    </div>
  );
}

function Picker(props: {
  readonly picked: readonly string[];
  readonly onPick: (ids: readonly string[]) => void;
}) {
  const { state, t } = useUi();
  const all = state.data.setup?.worlds ?? [];
  return (
    <fieldset class="mll-pick">
      <legend>{t("grid.choose")}</legend>
      {all.map((w) => (
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

export function WorldGrid(props: { readonly groups: readonly LibGroup[] }) {
  const { state, t } = useUi();
  const [show, setShow] = useState<GridShow>("all");
  const [picked, setPicked] = useState<readonly string[]>([]);
  const result = gridWorlds(state.data, show, picked, Date.now());
  const { shown } = result;
  const models: Models = new Map(
    shown.map((w) => [w.id, worldModules(state.data, w.id)]),
  );
  return (
    <div class="mll-gridpage">
      <ShowBar show={show} onShow={setShow} result={result} />
      {show === "pick" ? <Picker picked={picked} onPick={setPicked} /> : null}
      {shown.length ? (
        <div class="mll-gridwrap">
          <table
            class="mll-grid"
            style={{ minWidth: `${MOD_COL + shown.length * MIN_COL}px` }}
          >
            <thead>
              <tr>
                <th class="mod" scope="col">
                  {t("grid.module")}
                </th>
                {shown.map((w) => (
                  <Head
                    key={w.id}
                    world={w}
                    model={models.get(w.id) ?? worldModules(state.data, w.id)}
                  />
                ))}
              </tr>
            </thead>
            <Rows groups={props.groups} worlds={shown} models={models} />
          </table>
        </div>
      ) : (
        <Empty show={show} total={result.total} onAll={() => setShow("all")} />
      )}
    </div>
  );
}
