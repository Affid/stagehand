// The world page's modules: a filter, All / On / Changes, Add, and the
// cards in the Library's folders. A switch queues a change for the next
// launch; a live region says what it did.
import type { WorldInfo } from "@module-library/shared/world";
import { useRef, useState } from "preact/hooks";
import { useUi } from "../../context.ts";
import {
  type FolderGroup,
  groupByFolder,
  sortByTitle,
} from "../../model/modules.ts";
import type {
  WorldModuleRow,
  WorldModules,
} from "../../model/world-modules.ts";
import { AddMenu } from "./AddMenu.tsx";
import { ModuleCard } from "./ModuleCard.tsx";
import { useWhy } from "./useWhy.ts";
import type { WhyContext } from "./why.ts";

type Show = "all" | "on" | "changes";
const SHOWS: readonly Show[] = ["all", "on", "changes"];

const keep = (show: Show, text: string) => (r: WorldModuleRow) => {
  if (show === "on" && !r.next) return false;
  if (show === "changes" && !r.delta) return false;
  const q = text.trim().toLowerCase();
  return (
    !q ||
    r.pkg.title.toLowerCase().includes(q) ||
    r.pkg.id.toLowerCase().includes(q)
  );
};

function Tools(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
  readonly show: Show;
  readonly text: string;
  readonly onShow: (s: Show) => void;
  readonly onText: (s: string) => void;
}) {
  const { t, canChange } = useUi();
  const count = (s: Show): number =>
    s === "all"
      ? props.model.rows.length
      : s === "on"
        ? props.model.nextCount
        : props.model.changes;
  return (
    <div class="mlw-tools">
      <input
        type="search"
        aria-label={t("wp.filter")}
        placeholder={t("wp.filter")}
        value={props.text}
        onInput={(e) => props.onText(e.currentTarget.value)}
      />
      <span class="ml-seg2" role="group" aria-label={t("wp.show")}>
        {SHOWS.map((s) => (
          <button
            type="button"
            key={s}
            class={props.show === s ? "on" : ""}
            aria-pressed={props.show === s}
            onClick={() => props.onShow(s)}
          >
            {t(`wp.show.${s}`)} <span class="c">{count(s)}</span>
          </button>
        ))}
      </span>
      <span class="ml-spacer" />
      {canChange ? <AddMenu worldId={props.world.id} /> : null}
    </div>
  );
}

interface SectionProps {
  readonly group: FolderGroup;
  readonly rows: readonly WorldModuleRow[];
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly world: WorldInfo;
  readonly why: WhyContext;
  readonly onFlip: (id: string, on: boolean) => void;
}

function Section(props: SectionProps) {
  const { t } = useUi();
  const { group, rows, open } = props;
  return (
    <li
      class="mlw-sec"
      style={{ "--c": group.folder?.color ?? "var(--color-cool-3)" }}
    >
      <button
        type="button"
        class="mlw-head"
        aria-expanded={open}
        onClick={props.onToggle}
      >
        <i
          class={`fa-solid fa-chevron-${open ? "down" : "right"} fa-fw`}
          aria-hidden="true"
        />
        <span class="name">{group.folder?.name ?? t("sidebar.unfiled")}</span>
        <span class="count">
          {t("wp.groupCount", {
            on: rows.filter((r) => r.next).length,
            n: rows.length,
          })}
        </span>
      </button>
      {open ? (
        <ol class="mlw-grid">
          {rows.map((r) => (
            <ModuleCard
              key={r.pkg.id}
              row={r}
              worldTitle={props.world.title}
              why={props.why}
              onFlip={props.onFlip}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function Sections(props: {
  readonly rows: readonly WorldModuleRow[];
  readonly world: WorldInfo;
  readonly why: WhyContext;
  readonly onFlip: (id: string, on: boolean) => void;
}) {
  const { state } = useUi();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const byId = new Map(props.rows.map((r) => [r.pkg.id, r]));
  const groups = groupByFolder(
    props.rows.map((r) => r.pkg),
    state.data.library,
  );
  const toggle = (key: string): void => {
    const next = new Set(collapsed);
    if (!next.delete(key)) next.add(key);
    setCollapsed(next);
  };
  return (
    <ol class="mlw-sections">
      {groups.map((g) => {
        const key = g.folder?.id ?? "unfiled";
        const rows = sortByTitle(g.modules).flatMap((m) => {
          const r = byId.get(m.id);
          return r ? [r] : [];
        });
        return (
          <Section
            key={key}
            group={g}
            rows={rows}
            open={!collapsed.has(key)}
            onToggle={() => toggle(key)}
            world={props.world}
            why={props.why}
            onFlip={props.onFlip}
          />
        );
      })}
    </ol>
  );
}

export function ModulesTab(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
}) {
  const { actions, t } = useUi();
  const [show, setShow] = useState<Show>("all");
  const [text, setText] = useState("");
  const [said, setSaid] = useState("");
  const why = useWhy();
  // The switch shows the stored state, so a second press before the save
  // lands would repeat the first: ignore it until then.
  const saving = useRef(new Set<string>());
  const onFlip = (id: string, on: boolean): void => {
    if (saving.current.has(id)) return;
    saving.current.add(id);
    setSaid(t(`wp.announce.${on ? "on" : "off"}`, { module: why.name(id) }));
    void actions.flip(props.world.id, id, on).finally(() => {
      saving.current.delete(id);
    });
  };
  const rows = props.model.rows.filter(keep(show, text));
  return (
    <div class="mlw-modules">
      <Tools
        world={props.world}
        model={props.model}
        show={show}
        text={text}
        onShow={setShow}
        onText={setText}
      />
      {rows.length ? (
        <Sections rows={rows} world={props.world} why={why} onFlip={onFlip} />
      ) : (
        <p class="ml-empty">{t(`wp.empty.${show}`)}</p>
      )}
      <p class="ml-sr-only" aria-live="polite">
        {said}
      </p>
    </div>
  );
}
