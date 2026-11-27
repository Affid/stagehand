// The Updates tab's head (updates plan): what the last check found and
// when, with Check again; while a check runs, its progress and Stop.
import type { Row } from "@stagehand/shared/updates/model";
import { Icon } from "@stagehand/ui/common/widgets.tsx";
import { ago, plural } from "@stagehand/ui/i18n.ts";
import { useUi } from "../../../context.ts";
import { checksOf, hasChecked } from "../../../model/package-updates.ts";
import { age } from "../../../model/worlds.ts";
import { checkAll, stopCheck } from "../../../package-check.ts";
import type { CheckRun } from "../../../store.ts";
import { useCheckDeps } from "./useCheckDeps.ts";

const canAct = (r: Row): boolean =>
  r.section === "ready" || r.section === "attention";

function Running(props: { readonly run: CheckRun }) {
  const { state, t } = useUi();
  const deps = useCheckDeps();
  const { run } = props;
  const pct = run.total ? Math.round((run.done / run.total) * 100) : 0;
  const setup = state.data.setup;
  const current = [...(setup?.modules ?? []), ...(setup?.systems ?? [])].find(
    (p) => p.id === run.current,
  );
  return (
    <div class="spu-head busy" role="status">
      <div class="t">
        <strong>
          {run.total
            ? t("upd.checking", {
                done: String(run.done),
                total: String(run.total),
              })
            : t("upd.checkingStart")}
        </strong>
        <span>{current?.title ?? run.current ?? ""}</span>
      </div>
      <div class="spu-bar">
        <span style={{ width: `${String(pct)}%` }} />
      </div>
      <button type="button" onClick={() => stopCheck(deps)}>
        {t("upd.stop")}
      </button>
    </div>
  );
}

/** "3 updates", "Everything is up to date"…, with its icon. */
function lead(
  t: ReturnType<typeof useUi>["t"],
  rows: readonly Row[],
  checked: boolean,
): { icon: string; cls: string; text: string } {
  if (!checked)
    return { icon: "cloud-arrow-down", cls: "", text: t("upd.head.never") };
  const n = rows.filter(canAct).length;
  if (n)
    return {
      icon: "cloud-arrow-down",
      cls: "",
      text: plural(t, "upd.head.count", n),
    };
  if (rows.length && rows.every((r) => r.section === "error"))
    return {
      icon: "triangle-exclamation",
      cls: "warn",
      text: t("upd.head.failed"),
    };
  return rows.length
    ? { icon: "circle-check", cls: "ok", text: t("upd.head.nothingNow") }
    : { icon: "circle-check", cls: "ok", text: t("upd.head.none") };
}

export function UpdatesHead(props: { readonly rows: readonly Row[] }) {
  const { state, t, canChange } = useUi();
  const deps = useCheckDeps();
  const run = state.check.running;
  if (run) return <Running run={run} />;
  const checked = hasChecked(state);
  const l = lead(t, props.rows, checked);
  const at = state.data.updatesCheck.checkedAt;
  const meta = [
    ...(at === null
      ? []
      : [
          t("upd.head.checked", {
            when: ago(t, age(new Date(at).toISOString(), Date.now())),
          }),
        ]),
    ...(checked
      ? [plural(t, "upd.head.packages", Object.keys(checksOf(state)).length)]
      : []),
  ];
  return (
    <div class="spu-head">
      <div class="t">
        <i class={`fa-solid fa-${l.icon} fa-fw ${l.cls}`} aria-hidden="true" />
        <span>
          <strong>{l.text}</strong>
          {meta.length ? ` · ${meta.join(" · ")}` : ""}
        </span>
      </div>
      <button
        type="button"
        disabled={!canChange}
        onClick={() => {
          checkAll(deps);
        }}
      >
        <Icon name="rotate" />
        {t(checked ? "upd.checkAgain" : "upd.check")}
      </button>
    </div>
  );
}
