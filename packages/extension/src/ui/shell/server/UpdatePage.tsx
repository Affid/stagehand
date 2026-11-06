// The Update page, as the prototype (design/setup-page/src/_update.js): it
// runs Foundry's own update check on the channel when it opens, then shows
// the release's notes beside the Update box; or that Foundry is up to date,
// with Check again. The update itself is Foundry's (page/update.ts).
import { useMemo, useState } from "preact/hooks";
import type { Release } from "../../../page-update.ts";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { channelName } from "../../model/update.ts";
import { PageHead } from "./PageHead.tsx";
import { ActionBox } from "./update/ActionBox.tsx";
import { CompatBox } from "./update/CompatBox.tsx";
import { compatData, type CompatData, toCheck } from "./update/compat.ts";
import { CompatView } from "./update/CompatView.tsx";
import { HistoryView } from "./update/HistoryView.tsx";
import { NotesView } from "./update/NotesView.tsx";
import { usePreview } from "./update/usePreview.ts";
import { type UpdateState, useUpdate } from "./update/useUpdate.ts";

type View = "notes" | "compat" | "history";

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

function Tabs(props: {
  readonly view: View;
  readonly onView: (v: View) => void;
  readonly toCheck: number;
}) {
  const { t } = useUi();
  const tab = (v: View, icon: string, label: string, extra?: number) => (
    <button
      type="button"
      role="tab"
      class={props.view === v ? "active" : ""}
      aria-selected={props.view === v}
      onClick={() => {
        props.onView(v);
      }}
    >
      <Icon name={icon} />
      {label}
      {extra ? <span class="c w"> {extra}</span> : null}
    </button>
  );
  return (
    <nav class="mls-subtabs mlu-tabs">
      <span class="mls-tablist" role="tablist">
        {tab("notes", "newspaper", t("up.tab.notes"))}
        {tab("compat", "puzzle-piece", t("up.tab.compat"), props.toCheck)}
        {tab("history", "clock-rotate-left", t("up.tab.history"))}
      </span>
    </nav>
  );
}

/** Foundry's preview, with where each package is used. */
function useCompat(u: UpdateState, release: Release) {
  const { state, t } = useUi();
  const p = usePreview(release, u.channel);
  const data = useMemo<CompatData | null>(
    () => (p.kind === "ready" ? compatData(state.data, p.preview) : null),
    [p, state.data],
  );
  // An error without words still ends the wait (review).
  const error =
    p.kind === "error" ? p.error || t("up.previewFailed") : undefined;
  return { data, error };
}

function ReleaseView(props: {
  readonly u: UpdateState;
  readonly release: Release;
}) {
  const { t } = useUi();
  const { u, release } = props;
  const [view, setView] = useState<View>("notes");
  const c = useCompat(u, release);
  const bad = c.data
    ? [...c.data.system, ...c.data.module].filter(toCheck).length
    : 0;
  return (
    <div class="mlu-cols">
      <div class="mlu-left">
        <Tabs view={view} onView={setView} toCheck={bad} />
        {view === "compat" ? (
          c.data ? (
            <CompatView release={release} data={c.data} />
          ) : (
            <div class="mlu-notes" role="status">
              <p class="ml-muted">{c.error ?? t("up.previewing")}</p>
            </div>
          )
        ) : view === "history" ? (
          <HistoryView channel={u.channel ?? "stable"} />
        ) : (
          <NotesView
            release={release}
            onHistory={() => {
              setView("history");
            }}
          />
        )}
      </div>
      <div class="mlu-side">
        <ActionBox u={u} release={release} />
        {view === "compat" ? null : (
          <CompatBox
            release={release}
            data={c.data}
            {...(c.error ? { error: c.error } : {})}
            onFull={() => {
              setView("compat");
            }}
          />
        )}
      </div>
    </div>
  );
}

function Body(props: { readonly u: UpdateState }) {
  const { u } = props;
  const p = u.phase;
  if (p.kind === "checking") return <Checking />;
  if (p.kind === "none") return <UpToDate u={u} />;
  if (p.kind === "error") return <Problem u={u} error={p.error} />;
  return <ReleaseView u={u} release={p.release} />;
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
