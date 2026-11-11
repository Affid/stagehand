// The server has no companion module, or an older one than this Stagehand
// works with (issue 1): say so on the Library and offer Foundry's install.
import { MIN_COMPANION_VERSION } from "@stagehand/shared/companion";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { type CompanionNeed, companionNeed } from "../model/companion.ts";

/** Runs Foundry's installer for the companion; waits while it is running. */
export function InstallCompanion(props: {
  readonly need: CompanionNeed;
  readonly label: string;
  readonly class?: string;
}) {
  const { page, t } = useUi();
  const { installing } = props.need;
  return (
    <button
      type="button"
      class={`bright${props.class ? ` ${props.class}` : ""}`}
      disabled={installing}
      onClick={() => page.foundryAction({ action: "installCompanion" })}
    >
      <Icon name={installing ? "spinner fa-spin-pulse" : "download"} />
      {installing ? t("companion.installing") : props.label}
    </button>
  );
}

export function CompanionBand() {
  const { state, t, canChange } = useUi();
  const need = companionNeed(state);
  if (!need) return null;
  const missing = need.need === "missing";
  return (
    <div class="sts-intake-band sts-companion-band" role="status">
      <Icon name="puzzle-piece" />
      <span>
        <b>{t(missing ? "companion.missing" : "companion.outdated")}</b>{" "}
        {missing
          ? t("companion.missingRest")
          : t("companion.outdatedRest", {
              have: need.have,
              need: MIN_COMPANION_VERSION,
            })}
      </span>
      {canChange ? (
        <InstallCompanion
          need={need}
          label={t(missing ? "companion.install" : "companion.update")}
        />
      ) : null}
    </div>
  );
}
