// Asking before an update that may break something (updates plan, phase
// 4): which packages in the run would leave something unmet, what and where
// it is on, whether Back up first is on; then Cancel, the other ones, the
// fixes too (judged again), or anyway. The highlighted choice is the safest
// one that still updates.
import { usageCounts } from "@stagehand/shared/organise/usage";
import { risksOf, safeSubset } from "@stagehand/shared/updates/model";
import { Modal } from "@stagehand/ui/common/widgets.tsx";
import { plural, type Translate } from "@stagehand/ui/i18n.ts";
import { useUi } from "../../../context.ts";
import { updatesInput } from "../../../model/package-updates.ts";
import { answer } from "../../../package-install.ts";
import { fixesOf, titlesOf, warningText } from "./Warnings.tsx";
import { useInstallDeps } from "./useCheckDeps.ts";

function whereOn(t: Translate, title: string, n: number | undefined): string {
  return n
    ? plural(t, "upd.ask.where.on", n, { title })
    : t("upd.ask.where.none", { title });
}

function Risks(props: { readonly ids: readonly string[] }) {
  const { state, t } = useUi();
  const risks = risksOf(updatesInput(state), props.ids);
  const title = titlesOf(state);
  const usage = usageCounts(Object.values(state.data.snapshots));
  const lead =
    props.ids.length === 1
      ? t("upd.ask.leadOne")
      : plural(t, "upd.ask.leadSome", risks.length);
  return (
    <div class="spu-confirm">
      <p>{lead}</p>
      {risks.map((r) => (
        <div key={r.id} class="spu-warn">
          <i class="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <span>
            <strong>{title(r.id)}</strong>:{" "}
            {r.warnings.map((w) => warningText(t, w, title, r.id)).join(" ")}{" "}
            {r.warnings
              .flatMap((w) => (w.kind === "impact" ? w.dependents : []))
              .map((d) => whereOn(t, title(d.id), usage[d.id]))
              .join(" ")}
          </span>
        </div>
      ))}
      <p class="st-muted">
        {t(state.install.backup ? "upd.ask.backupOn" : "upd.ask.backupOff")}{" "}
        {t("upd.ask.foundry")}
      </p>
    </div>
  );
}

type Choice = "cancel" | "all" | "others" | "withFix";

/** Cancel, anyway, the other ones, or with the fixes; the safest that still updates is highlighted. */
function Choices(props: { readonly ids: readonly string[] }) {
  const { state, t } = useUi();
  const deps = useInstallDeps();
  const { ids } = props;
  const risks = risksOf(updatesInput(state), ids);
  const title = titlesOf(state);
  const fixes = [
    ...new Set(risks.flatMap((r) => r.warnings.flatMap(fixesOf))),
  ].filter((id) => !ids.includes(id));
  const fixable =
    fixes.length > 0 &&
    risks.every((r) => r.warnings.every((w) => fixesOf(w).length));
  const others = safeSubset(updatesInput(state), ids).length;
  const button = (label: string, c: Choice, bright: boolean) => (
    <button
      type="button"
      class={bright ? "bright" : ""}
      onClick={() => {
        answer(deps, c, fixes);
      }}
    >
      {label}
    </button>
  );
  const anyway = others
    ? t("upd.ask.allAnyway", { n: String(ids.length) })
    : t("upd.ask.anyway");
  return (
    <>
      {button(t("upd.ask.cancel"), "cancel", false)}
      {button(anyway, "all", !fixable && !others)}
      {others
        ? button(plural(t, "upd.ask.others", others), "others", !fixable)
        : null}
      {fixable
        ? button(
            t("upd.ask.withFix", { titles: fixes.map(title).join(", ") }),
            "withFix",
            true,
          )
        : null}
    </>
  );
}

export function UpdateConfirm() {
  const { state, t } = useUi();
  const deps = useInstallDeps();
  const ids = state.install.asking;
  if (!ids?.length) return null;
  const title = titlesOf(state);
  return (
    <Modal
      title={
        ids.length === 1
          ? t("upd.ask.one", { title: title(ids[0] ?? "") })
          : t("upd.ask.many", { n: String(ids.length) })
      }
      onClose={() => {
        answer(deps, "cancel");
      }}
      footer={<Choices ids={ids} />}
    >
      <Risks ids={ids} />
    </Modal>
  );
}
