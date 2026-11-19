// The changes line (how many changes wait for Save, and problems), and
// Foundry's footer with its own labels: Save Module Settings, which opens
// the review and shows the count, and Deactivate All Modules, which marks
// every module off.
import { Icon } from "@stagehand/ui/common/widgets.tsx";
import { useModules } from "@stagehand/ui/context.ts";
import { plural } from "@stagehand/ui/i18n.ts";
import type { WorldModules } from "@stagehand/ui/model/world-modules.ts";

export function Pending(props: {
  readonly model: WorldModules;
  readonly onReview: () => void;
  readonly onDiscard: () => void;
}) {
  const { t } = useModules();
  const { changes, problems } = props.model;
  if (changes === 0) return null;
  return (
    <div class={`stc-pending${problems ? " warn" : ""}`}>
      <Icon name={problems ? "triangle-exclamation" : "clock-rotate-left"} />
      <span>{plural(t, "mm.pending", changes)}</span>
      {problems ? <span>· {plural(t, "mm.problems", problems)}</span> : null}
      <button type="button" class="st-link" onClick={props.onReview}>
        {t("mm.review")}
      </button>
      <button type="button" class="st-link" onClick={props.onDiscard}>
        {t("mm.discard")}
      </button>
    </div>
  );
}

export function Footer(props: {
  readonly changes: number;
  readonly foundryText: (key: string) => string;
  readonly onSave: () => void;
  readonly onDeactivateAll: () => void;
}) {
  const { t } = useModules();
  const n = props.changes;
  return (
    <footer class="form-footer">
      <button type="button" class="stagehand-save" onClick={props.onSave}>
        <i class="fa-regular fa-floppy-disk" aria-hidden="true" />
        <span>{props.foundryText("MODMANAGE.Submit")}</span>
        {n ? (
          <span class="stc-badge" aria-label={plural(t, "mm.changes", n)}>
            {n}
          </span>
        ) : null}
      </button>
      <button type="button" onClick={props.onDeactivateAll}>
        <i class="fa-solid fa-ban" aria-hidden="true" />
        <span>{props.foundryText("MODMANAGE.DeactivateAll")}</span>
      </button>
    </footer>
  );
}
