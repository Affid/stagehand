// The Update page (build plan, Phase 5): what is installed, whether Foundry
// has an update and on which channel, Foundry's public release notes, and
// Foundry's own update screen for the update itself (it checks packages
// and offers a snapshot). The update check's download link is never read.
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { channelName } from "../../model/update.ts";
import { PageHead } from "./PageHead.tsx";

/** Foundry's public notes for a version; only plain "14.371" versions. */
export function notesUrl(version: string): string | undefined {
  return /^\d+(\.\d+){0,2}$/.test(version)
    ? `https://foundryvtt.com/releases/${version}`
    : undefined;
}

function Notes(props: { readonly version: string }) {
  const { t } = useUi();
  const href = notesUrl(props.version);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      <Icon name="arrow-up-right-from-square" />
      {t("up.notes", { version: props.version })}
    </a>
  );
}

/** "14.371 is available", or "Up to date", each with its notes. */
function Availability(props: { readonly installed: string }) {
  const { state, t } = useUi();
  const update = state.data.setup?.coreUpdate;
  const available = update?.hasUpdate ? update.version : "";
  if (update?.reachable === false && !available)
    return (
      <div class="mlu-avail warn">
        <Icon name="triangle-exclamation" />
        <span>{t("up.unreachable")}</span>
        <Notes version={props.installed} />
      </div>
    );
  if (!available)
    return (
      <div class="mlu-avail none">
        <Icon name="circle-check" />
        <span>{t("up.current")}</span>
        <Notes version={props.installed} />
      </div>
    );
  return (
    <div class="mlu-avail">
      <Icon name="arrow-up" />
      <span>
        {t("up.available", {
          version: available,
          channel: update?.channel ?? "",
        })}
      </span>
      <Notes version={available} />
    </div>
  );
}

/** "You're on Foundry 14.370 (Stable). You have the latest version." */
function Summary() {
  const { state, t } = useUi();
  const setup = state.data.setup;
  const version = setup?.core.version ?? "";
  const update = setup?.coreUpdate;
  const channel = channelName(update?.channel ?? "");
  const on = channel
    ? t("up.youreOn", { version, channel })
    : t("up.youreOnNoChannel", { version });
  // Unreachable: the box below says so; the heading doesn't repeat it.
  const then = update?.hasUpdate
    ? t("up.isAvailable", { version: update.version })
    : update?.reachable === false
      ? ""
      : t("up.latest");
  return (
    <>
      {on} {then}
    </>
  );
}

export function UpdatePage() {
  const { state, t } = useUi();
  const setup = state.data.setup;
  const installed = setup?.core.version ?? "";
  const update = setup?.coreUpdate;
  return (
    <div class="mlu-page ml-app">
      <PageHead title={t("up.title")} summary={<Summary />} />
      <dl class="mlw-details">
        <dt>{t("up.installed")}</dt>
        <dd>{installed}</dd>
        {update ? (
          <>
            <dt>{t("up.channel")}</dt>
            <dd>{channelName(update.channel)}</dd>
          </>
        ) : null}
      </dl>
      <Availability installed={installed} />
      {update?.canUpdate === false ? (
        <p class="mlu-why">
          <Icon name="circle-info" />
          {t("up.disabled")}
        </p>
      ) : null}
    </div>
  );
}
