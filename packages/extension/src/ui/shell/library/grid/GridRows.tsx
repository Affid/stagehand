// The grid's body: a row per group, with how many of its modules each world
// has on (a click turns them all on or off there), then a row per module:
// its name (opens its details), New, its tag colours, and a switch per world.
import type { PackageInfo } from "@module-library/shared/package";
import type { WorldInfo } from "@module-library/shared/world";
import { useUi } from "../../../context.ts";
import type { LibGroup } from "../../../model/library-groups.ts";
import { useTurnable, useTurnAll } from "../../world/turn-all.ts";
import type { Folding, Models, WorldRows } from "./types.ts";

const MAX_DOTS = 3;

function Cell(props: {
  readonly world: WorldInfo;
  readonly rows: WorldRows | undefined;
  readonly pkg: PackageInfo;
}) {
  const { actions, t, canChange } = useUi();
  const row = props.rows?.byId.get(props.pkg.id);
  if (!props.rows?.model.tracked || !row)
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
        disabled={!canChange || props.pkg.id === "module-library"}
        aria-label={t("wp.switch", {
          module: props.pkg.title,
          world: props.world.title,
        })}
        onClick={(e) => {
          e.preventDefault();
          void actions.flip(props.world.id, props.pkg.id, !row.next);
        }}
      />
    </td>
  );
}

function GroupCount(props: {
  readonly group: LibGroup;
  readonly world: WorldInfo;
  readonly rows: WorldRows | undefined;
}) {
  const { t, canChange } = useUi();
  const rows = props.group.modules.flatMap((m) => {
    const r = props.rows?.byId.get(m.id);
    return r ? [r] : [];
  });
  const turnAll = useTurnAll(rows, props.world.id);
  const turnable = useTurnable(rows);
  if (!props.rows?.model.tracked || !rows.length) return <td class="na" />;
  const on = rows.filter((r) => r.next).length;
  const all = on === rows.length;
  // Off: modules that need one not installed can't turn on (review).
  const can = turnable(!all).length > 0;
  const label = can
    ? t(all ? "grid.allOff" : "grid.allOn", { world: props.world.title })
    : t("grid.cantTurn", { world: props.world.title });
  return (
    <td>
      <button
        type="button"
        class={`mls-gcount${all ? " full" : on ? " some" : ""}`}
        disabled={!canChange || !can}
        title={label}
        aria-label={label}
        onClick={() => turnAll(!all)}
      >
        {on}/{rows.length}
      </button>
    </td>
  );
}

function ModuleHead(props: { readonly pkg: PackageInfo }) {
  const { state, store, t } = useUi();
  const { pkg } = props;
  const { library } = state.data;
  const ids = library.modules[pkg.id]?.tags ?? [];
  const tags = library.tags
    .filter((x) => ids.includes(x.id))
    .slice(0, MAX_DOTS);
  return (
    <th scope="row">
      <div class="mh">
        <button
          type="button"
          class="t"
          aria-expanded={state.panel === pkg.id}
          onClick={() =>
            store.set({
              panel: state.panel === pkg.id ? null : pkg.id,
              side: null,
            })
          }
        >
          {pkg.title}
        </button>
        {state.data.fresh.includes(pkg.id) ? (
          <span class="mls-newtag">{t("lib.new")}</span>
        ) : null}
        <span class="dots">
          {tags.map((x) => (
            <i
              key={x.id}
              class="ml-dot"
              style={{ "--ml-c": x.color }}
              title={t("grid.tag", { name: x.name })}
              aria-label={t("grid.tag", { name: x.name })}
            />
          ))}
        </span>
      </div>
    </th>
  );
}

function GroupRow(props: {
  readonly group: LibGroup;
  readonly worlds: readonly WorldInfo[];
  readonly models: Models;
  readonly folding: Folding;
}) {
  const { t } = useUi();
  const g = props.group;
  const closed = props.folding.closed.has(g.key);
  return (
    <tr class="grp" style={{ "--c": g.color ?? "var(--color-cool-3)" }}>
      <th scope="rowgroup">
        <button
          type="button"
          aria-expanded={!closed}
          onClick={() => props.folding.onToggle(g.key)}
        >
          <i
            class={`fa-solid fa-chevron-${closed ? "right" : "down"} fa-fw`}
            aria-hidden="true"
          />
          {g.name ?? t(g.label ?? "", g.param ? { param: g.param } : {})}
          <span class="n">{g.modules.length}</span>
        </button>
      </th>
      {props.worlds.map((w) => (
        <GroupCount
          key={w.id}
          group={g}
          world={w}
          rows={props.models.get(w.id)}
        />
      ))}
    </tr>
  );
}

export function GridRows(props: {
  readonly groups: readonly LibGroup[];
  readonly worlds: readonly WorldInfo[];
  readonly models: Models;
  readonly folding: Folding;
}) {
  const { state } = useUi();
  const { closed } = props.folding;
  return (
    <tbody>
      {props.groups.flatMap((g) => [
        <GroupRow
          key={`g:${g.key}`}
          group={g}
          worlds={props.worlds}
          models={props.models}
          folding={props.folding}
        />,
        ...(closed.has(g.key) ? [] : g.modules).map((m) => (
          // A module can sit in several groups (tags, authors): keys per group.
          <tr
            key={`${g.key}:${m.id}`}
            data-module={m.id}
            class={state.panel === m.id ? "viewing" : ""}
          >
            <ModuleHead pkg={m} />
            {props.worlds.map((w) => (
              <Cell
                key={w.id}
                world={w}
                rows={props.models.get(w.id)}
                pkg={m}
              />
            ))}
          </tr>
        )),
      ])}
    </tbody>
  );
}
