// A world's modules in groups (View options: folder, tag, author or smart
// group), as cards or one line each. A group's ⋮ turns all of it on or off.
import type { WorldInfo } from "@module-library/shared/world";
import { useState } from "preact/hooks";
import { useDisclosure } from "../../common/disclosure.ts";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { groupLibrary, type LibGroup } from "../../model/library-groups.ts";
import { COMPANION_ID } from "../../model/preview.ts";
import type { WorldModuleRow } from "../../model/world-modules.ts";
import { useModulesModel } from "../../modules/derived.ts";
import { ModuleCard } from "./ModuleCard.tsx";
import { ModuleLine } from "./ModuleLine.tsx";
import type { WhyContext } from "./why.ts";

export interface SectionsProps {
  readonly rows: readonly WorldModuleRow[];
  /** Every row of the world, for "Turn all on / off" past the filter. */
  readonly all: readonly WorldModuleRow[];
  readonly world: WorldInfo;
  readonly why: WhyContext;
  readonly onFlip: (id: string, on: boolean) => void;
}

/** Turn all on or off: one queued change for the group's other modules. */
function GroupMenu(props: {
  readonly name: string;
  readonly rows: readonly WorldModuleRow[];
  readonly worldId: string;
}) {
  const { actions, t } = useUi();
  const d = useDisclosure<HTMLSpanElement>();
  const turn = (on: boolean): void => {
    d.close(true);
    const ids = props.rows
      .filter((r) => r.next !== on && (on || r.pkg.id !== COMPANION_ID))
      .map((r) => r.pkg.id);
    if (ids.length)
      void actions.queueApply(props.worldId, on ? "add" : "remove", [], ids);
  };
  return (
    <span class="mlw-gmenu" ref={d.wrap}>
      <button
        type="button"
        ref={d.trigger}
        class="ml-hbtn"
        aria-label={t("wp.groupActions", { group: props.name })}
        title={t("wp.groupActionsHint")}
        aria-expanded={d.open}
        onClick={() => d.setOpen(!d.open)}
      >
        <Icon name="ellipsis-vertical" />
      </button>
      {d.open ? (
        <div class="mlh-menu">
          <button
            type="button"
            ref={(el) => {
              d.first.current = el;
            }}
            onClick={() => turn(true)}
          >
            <Icon name="toggle-on" />
            {t("wp.allOn")}
          </button>
          <button type="button" onClick={() => turn(false)}>
            <Icon name="toggle-off" />
            {t("wp.allOff")}
          </button>
        </div>
      ) : null}
    </span>
  );
}

function SectionHead(props: {
  readonly name: string;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly all: readonly WorldModuleRow[];
  readonly worldId: string;
}) {
  const { t, canChange } = useUi();
  const name = props.name;
  return (
    <div class="mlw-headrow">
      <button
        type="button"
        class="mlw-head"
        aria-expanded={props.open}
        onClick={props.onToggle}
      >
        <i
          class={`fa-solid fa-chevron-${props.open ? "down" : "right"} fa-fw`}
          aria-hidden="true"
        />
        <span class="name">{name}</span>
        <span class="count">
          {t("wp.groupCount", {
            on: props.all.filter((r) => r.next).length,
            n: props.all.length,
          })}
        </span>
      </button>
      {canChange ? (
        <GroupMenu name={name} rows={props.all} worldId={props.worldId} />
      ) : null}
    </div>
  );
}

function Section(props: {
  readonly group: LibGroup;
  readonly rows: readonly WorldModuleRow[];
  readonly all: readonly WorldModuleRow[];
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly p: SectionsProps;
}) {
  const { state, t } = useUi();
  const { group, rows } = props;
  const name =
    group.name ??
    t(group.label ?? "", group.param ? { param: group.param } : {});
  const list = state.worldView.layout === "list";
  return (
    <li class="mlw-sec" style={{ "--c": group.color ?? "var(--color-cool-3)" }}>
      <SectionHead
        name={name}
        open={props.open}
        onToggle={props.onToggle}
        all={props.all}
        worldId={props.p.world.id}
      />
      {props.open ? (
        <ol class={list ? "mlc-list" : "mlw-grid"}>
          {rows.map((r) =>
            list ? (
              <ModuleLine key={r.pkg.id} row={r} p={props.p} />
            ) : (
              <ModuleCard
                key={r.pkg.id}
                row={r}
                worldTitle={props.p.world.title}
                why={props.p.why}
                onFlip={props.p.onFlip}
              />
            ),
          )}
        </ol>
      ) : null}
    </li>
  );
}

export function ModuleSections(props: SectionsProps) {
  const { state } = useUi();
  const model = useModulesModel(state);
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const rowOf = new Map(props.all.map((r) => [r.pkg.id, r]));
  const shown = new Set(props.rows.map((r) => r.pkg.id));
  const groups = groupLibrary(
    props.all.map((r) => r.pkg),
    state.worldView.by,
    {
      library: state.data.library,
      smart: model.groups,
      authors: model.authors,
    },
  );
  const toggle = (key: string): void => {
    const next = new Set(closed);
    if (!next.delete(key)) next.add(key);
    setClosed(next);
  };
  const rowsOf = (g: LibGroup): WorldModuleRow[] =>
    g.modules.flatMap((m) => rowOf.get(m.id) ?? []);
  return (
    <ol class="mlw-sections">
      {groups.map((g) => {
        const all = rowsOf(g);
        const rows = all.filter((r) => shown.has(r.pkg.id));
        if (rows.length === 0) return null;
        return (
          <Section
            key={g.key}
            group={g}
            rows={rows}
            all={all}
            open={!closed.has(g.key)}
            onToggle={() => toggle(g.key)}
            p={props}
          />
        );
      })}
    </ol>
  );
}
