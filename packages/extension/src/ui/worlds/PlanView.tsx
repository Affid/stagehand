// A plan shown as a diff (P-4): problems first, then the modules each step
// enables, adds as dependencies or disables, by title with the id beside it.
import type { Plan } from "@module-library/shared/resolver";
import { useState } from "preact/hooks";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { plural, type Translate } from "../i18n.ts";
import { type Effect, effectOf } from "../model/preview.ts";

const COLLAPSED = 8;

type Titles = ReadonlyMap<string, string>;

export function useTitles(): Titles {
  const { state } = useUi();
  return new Map((state.data.setup?.modules ?? []).map((m) => [m.id, m.title]));
}

/** "+9 enable  −2 disable  1 dependency  1 to check" as pills. */
export function EffectPills(props: { readonly effect: Effect }) {
  const { t } = useUi();
  const e = props.effect;
  return (
    <span class="ml-pills">
      {e.enable > 0 ? (
        <span class="ml-pill ml-plus">
          <Icon name="plus" />
          {t("effect.enable", { n: e.enable })}
        </span>
      ) : null}
      {e.disable > 0 ? (
        <span class="ml-pill ml-minus">
          <Icon name="minus" />
          {t("effect.disable", { n: e.disable })}
        </span>
      ) : null}
      {e.dependencies > 0 ? (
        <span class="ml-pill ml-dep">
          <Icon name="link" />
          {plural(t, "effect.dependencies", e.dependencies)}
        </span>
      ) : null}
      {e.problems > 0 ? (
        <span class="ml-pill ml-check">
          <Icon name="triangle-exclamation" />
          {plural(t, "effect.problems", e.problems)}
        </span>
      ) : null}
    </span>
  );
}

const name = (titles: Titles, id: string): string => titles.get(id) ?? id;

/** One line per problem, already worded. */
function problemLines(plan: Plan, titles: Titles, t: Translate): string[] {
  return [
    ...plan.conflicts.map((c) =>
      t("apply.problem.conflict", {
        a: name(titles, c.id),
        b: name(titles, c.with),
      }),
    ),
    ...plan.missing.map((id) => t("apply.problem.missing", { title: id })),
    ...plan.blocked.map((b) =>
      t("apply.problem.blocked", {
        title: name(titles, b.id),
        detail: b.detail.join(", "),
      }),
    ),
    ...plan.incompatible.map((i) =>
      t("apply.problem.incompatible", {
        title: name(titles, i.id),
        reason: t(`apply.incompatible.${i.reason}`),
      }),
    ),
    ...plan.dependents.map((d) =>
      t("apply.problem.dependent", {
        title: name(titles, d.id),
        by: d.requiredBy.map((id) => name(titles, id)).join(", "),
      }),
    ),
  ];
}

function Group(props: {
  readonly kind: "add" | "dep" | "del";
  readonly icon: string;
  readonly title: string;
  readonly ids: readonly string[];
  readonly titles: Titles;
}) {
  const { t } = useUi();
  const [open, setOpen] = useState(false);
  if (props.ids.length === 0) return null;
  const shown = open ? props.ids : props.ids.slice(0, COLLAPSED);
  const hidden = props.ids.length - shown.length;
  return (
    <section class={`ml-diff-group ml-${props.kind}`}>
      <h4>
        <Icon name={props.icon} />
        {props.title} · {props.ids.length}
      </h4>
      <ul>
        {shown.map((id) => (
          <li key={id}>
            <span class="ml-diff-name">{name(props.titles, id)}</span>
            <span class="ml-diff-id">{id}</span>
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <button
          type="button"
          class="ml-link ml-diff-more"
          onClick={() => setOpen(true)}
        >
          {t("apply.showMore", { n: hidden })}
        </button>
      ) : null}
    </section>
  );
}

export function PlanDiff(props: { readonly plan: Plan }) {
  const { t } = useUi();
  const titles = useTitles();
  const { plan } = props;
  const problems = problemLines(plan, titles, t);
  const deps = new Set(plan.dependencyAdditions);
  return (
    <div class="ml-diff" data-testid="apply-diff">
      {problems.length > 0 ? (
        <section class="ml-diff-group ml-problems">
          <h4>
            <Icon name="triangle-exclamation" />
            {t("apply.check")} · {problems.length}
          </h4>
          <ul>
            {problems.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <Group
        kind="add"
        icon="plus"
        title={t("apply.group.enable")}
        ids={plan.enable.filter((id) => !deps.has(id))}
        titles={titles}
      />
      <Group
        kind="dep"
        icon="link"
        title={t("apply.group.dependencies")}
        ids={plan.dependencyAdditions}
        titles={titles}
      />
      <Group
        kind="del"
        icon="minus"
        title={t("apply.group.disable")}
        ids={plan.disable}
        titles={titles}
      />
    </div>
  );
}

/** "57 → 21 active modules" and the pills. */
export function PlanSummary(props: { readonly plan: Plan }) {
  const { t } = useUi();
  const { plan } = props;
  return (
    <div class="ml-plan-summary">
      <p class="ml-before-after">
        <strong>{plan.start.length}</strong>
        <Icon name="arrow-right" />
        <strong>{plan.target.length}</strong>
        <span>{t("apply.activeModules")}</span>
      </p>
      <EffectPills effect={effectOf(plan)} />
    </div>
  );
}
