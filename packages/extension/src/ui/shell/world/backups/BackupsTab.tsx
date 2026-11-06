// A world's Backups tab, as the prototype: the nudge while changes wait, an
// empty state, the head, Foundry's progress, the rows and the footnote.
// Every operation goes through Foundry's own dialogs.
import type { WorldInfo } from "@module-library/shared/world";
import { useState } from "preact/hooks";
import type { BackupInfo } from "../../../../page-backups.ts";
import type { Progress } from "../../../../page-progress.ts";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import { lockReason, tasksFor } from "../../../tasks.ts";
import type { WorldBackups } from "../useBackups.ts";
import { BackupRow } from "./BackupRow.tsx";
import { SelectHead, SummaryHead } from "./Head.tsx";
import { Nudge } from "./Nudge.tsx";
import { Running, runningHere } from "./Running.tsx";

interface Props {
  readonly world: WorldInfo;
  readonly backups: WorldBackups;
  /** Module changes waiting for the next launch. */
  readonly changes: number;
}

/** Restore, Delete and Take wait while Foundry is busy or our call runs. */
function useOff(busy: boolean): string | null {
  const { t, state, canChange } = useUi();
  const locked = lockReason(t, state);
  if (locked !== null) return locked;
  if (busy) return t("bk.busy");
  return canChange ? null : "";
}

function Empty(props: { readonly title: string; readonly onTake: () => void }) {
  const { t, canChange } = useUi();
  return (
    <div class="mlw-empty">
      <Icon name="floppy-disks" />
      <h3>{t("bk.emptyTitle", { title: props.title })}</h3>
      <p>{t("bk.emptyText")}</p>
      <button
        type="button"
        class="bright"
        disabled={!canChange}
        onClick={props.onTake}
      >
        <Icon name="floppy-disk" />
        {t("bk.takeFirst")}
      </button>
    </div>
  );
}

function Footnote(props: { readonly queued: number }) {
  const { t, store } = useUi();
  return (
    <p class="hint">
      {t("bk.foot")}
      {props.queued
        ? ` ${t("bk.footQueued", { changes: plural(t, "bk.queued", props.queued) })}`
        : ""}{" "}
      <button
        type="button"
        class="ml-link"
        onClick={() =>
          store.set({ route: { kind: "server", page: "backups" } })
        }
      >
        {t("bk.allServer")}
      </button>
    </p>
  );
}

function useSelect(list: readonly BackupInfo[]) {
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const ok = list.filter((b) => !b.snapshot).map((b) => b.id);
  const toggle = (id: string): void => {
    setPicked((p) => {
      if (!p) return p;
      return p.has(id)
        ? new Set([...p].filter((x) => x !== id))
        : new Set([...p, id]);
    });
  };
  const all = (): void => {
    setPicked((p) =>
      p && ok.every((id) => p.has(id)) ? new Set() : new Set(ok),
    );
  };
  const flip = (): void => {
    setPicked((p) => (p ? null : new Set()));
  };
  return { picked, toggle, all, flip, done: () => setPicked(null) };
}

function Rows(props: {
  readonly list: readonly BackupInfo[];
  readonly off: string | null;
  readonly sel: ReturnType<typeof useSelect>;
  readonly run: WorldBackups["run"];
}) {
  const { picked, toggle } = props.sel;
  return (
    <>
      {props.list.map((b, k) => (
        <BackupRow
          key={b.id}
          b={b}
          latest={k === 0}
          off={props.off}
          {...(picked
            ? { pick: { on: picked.has(b.id), toggle: () => toggle(b.id) } }
            : {})}
          onRestore={() => void props.run("restore", [b.id])}
          onDelete={() => void props.run("delete", [b.id])}
        />
      ))}
    </>
  );
}

/** The list with its head, Foundry's progress and the footnote. */
function Listed(
  props: Props & {
    readonly list: readonly BackupInfo[];
    readonly off: string | null;
    readonly jobs: readonly Progress[];
    readonly nudged: boolean;
  },
) {
  const { list, off } = props;
  const { run } = props.backups;
  const sel = useSelect(list);
  const del = (): void => {
    const ids = list.filter((b) => sel.picked?.has(b.id)).map((b) => b.id);
    void run("delete", ids).then(sel.done);
  };
  return (
    <>
      {sel.picked ? (
        <SelectHead
          list={list}
          picked={sel.picked}
          off={off}
          onAll={sel.all}
          onDelete={del}
          onDone={sel.done}
        />
      ) : (
        <SummaryHead
          list={list}
          off={off}
          nudged={props.nudged}
          onSelect={sel.flip}
          onTake={() => void run("create")}
        />
      )}
      <ol class="mlw-blist">
        {props.jobs.map((j) => (
          <Running key={j.id} task={j} title={props.world.title} />
        ))}
        <Rows list={list} off={off} sel={sel} run={run} />
      </ol>
      <Footnote queued={props.changes} />
    </>
  );
}

export function BackupsTab(props: Props) {
  const { t, state } = useUi();
  const { view, busy, run } = props.backups;
  const off = useOff(busy);
  const jobs = runningHere(tasksFor(state, props.world.id));
  const take = (): void => void run("create");
  const nudge = props.changes ? (
    <Nudge
      world={props.world}
      changes={props.changes}
      latest={view.list?.[0]}
      off={off}
      onBackup={take}
    />
  ) : null;
  const error = view.error ? (
    <p class="ml-banner ml-warn">{view.error}</p>
  ) : null;
  const list = view.list;
  return (
    <div class="mlw-backups">
      {list ? nudge : null}
      {error}
      {!list ? (
        error ? null : (
          <p class="ml-empty">{t("bk.loading")}</p>
        )
      ) : !list.length && !jobs.length ? (
        <Empty title={props.world.title} onTake={take} />
      ) : (
        <Listed
          {...props}
          list={list}
          off={off}
          jobs={jobs}
          nudged={nudge !== null}
        />
      )}
    </div>
  );
}
