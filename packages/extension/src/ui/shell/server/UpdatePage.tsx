// The Update page, as the prototype (design/setup-page/src/_update.js): it
// runs Foundry's own update check on the channel when it opens, then shows
// the release's notes beside the Update box; or that Foundry is up to date,
// with Check again. The update itself is Foundry's (page/update.ts).
import type { Release } from "../../../page-update.ts";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { channelName } from "../../model/update.ts";
import { PageHead } from "./PageHead.tsx";
import { ActionBox } from "./update/ActionBox.tsx";
import { NotesView } from "./update/NotesView.tsx";
import { type UpdateState, useUpdate } from "./update/useUpdate.ts";

/** "You're on Foundry 14.370 (Stable). 14.371 is available." */
function Summary(props: {
  readonly channel: string | null;
  readonly release: Release | undefined;
}) {
  const { state, t } = useUi();
  const version = state.data.setup?.core.version ?? "";
  const channel = channelName(props.channel ?? "");
  const on = channel
    ? t("up.youreOn", { version, channel })
    : t("up.youreOnNoChannel", { version });
  return (
    <>
      {on}{" "}
      {props.release ? (
        <>
          <b>{props.release.version}</b> {t("up.isAvailableTail")}
        </>
      ) : (
        t("up.latest")
      )}
    </>
  );
}

function UpToDate(props: { readonly u: UpdateState }) {
  const { state, t } = useUi();
  const version = state.data.setup?.core.version ?? "";
  return (
    <div class="mlw-empty">
      <Icon name="circle-check" />
      <h3>{t("up.upToDate")}</h3>
      <p>
        {t("up.latestOn", {
          version,
          channel: channelName(props.u.channel ?? ""),
        })}
      </p>
      <button type="button" onClick={() => void props.u.check()}>
        <Icon name="rotate" />
        {t("up.checkAgain")}
      </button>
      <p class="ml-muted">{t("up.checksItself")}</p>
    </div>
  );
}

function Problem(props: { readonly u: UpdateState; readonly error: string }) {
  const { t } = useUi();
  return (
    <div class="mlw-empty">
      <Icon name="triangle-exclamation" />
      <h3>{t("up.unreachable")}</h3>
      {props.error ? <p class="ml-muted">{props.error}</p> : null}
      <button type="button" onClick={() => void props.u.check()}>
        <Icon name="rotate" />
        {t("up.checkAgain")}
      </button>
    </div>
  );
}

function Checking() {
  const { t } = useUi();
  return (
    <div class="mlw-empty" role="status">
      <Icon name="spinner fa-spin-pulse" />
      <p>{t("up.checking")}</p>
    </div>
  );
}

function Body(props: { readonly u: UpdateState }) {
  const { u } = props;
  const p = u.phase;
  if (p.kind === "checking") return <Checking />;
  if (p.kind === "none") return <UpToDate u={u} />;
  if (p.kind === "error") return <Problem u={u} error={p.error} />;
  return (
    <div class="mlu-cols">
      <div class="mlu-left">
        <NotesView release={p.release} />
      </div>
      <div class="mlu-side">
        <ActionBox u={u} release={p.release} />
      </div>
    </div>
  );
}

export function UpdatePage() {
  const { t } = useUi();
  const u = useUpdate();
  const release = u.phase.kind === "release" ? u.phase.release : undefined;
  return (
    <div class="mlb-page ml-app mlu-page">
      <PageHead
        title={t("up.title")}
        summary={
          u.phase.kind === "checking" ? undefined : (
            <Summary channel={u.channel} release={release} />
          )
        }
      />
      <Body u={u} />
    </div>
  );
}
