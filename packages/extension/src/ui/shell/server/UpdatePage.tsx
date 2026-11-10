// The Update page, as the prototype (design/setup-page/src/_update.js): it
// runs Foundry's own update check on the channel when it opens, then shows
// the release's notes beside the Update box; or that Foundry is up to date,
// with Check again. The update itself is Foundry's (page/update.ts).
import { useMemo, useState } from "preact/hooks";
import type { Release } from "../../../page-update.ts";
import { TabList, TabPanel } from "../../common/tabs.tsx";
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
const VIEWS: readonly View[] = ["notes", "compat", "history"];
const VIEW_ICONS: Record<View, string> = {
  notes: "newspaper",
  compat: "puzzle-piece",
  history: "clock-rotate-left",
};
const UPDATE_TABS = "st-ut";

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
    <div class="stw-empty">
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
      <p class="st-muted">{t("up.checksItself")}</p>
    </div>
  );
}

function Problem(props: { readonly u: UpdateState; readonly error: string }) {
  const { t } = useUi();
  return (
    <div class="stw-empty">
      <Icon name="triangle-exclamation" />
      <h3>{t("up.unreachable")}</h3>
      {props.error ? <p class="st-muted">{props.error}</p> : null}
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
    <div class="stw-empty" role="status">
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
  return (
    <nav class="sts-subtabs stu-tabs">
      <TabList
        id={UPDATE_TABS}
        label={t("up.tabs")}
        tabs={VIEWS}
        current={props.view}
        onTab={props.onView}
        render={(v) => (
          <>
            <Icon name={VIEW_ICONS[v]} />
            {t(`up.tab.${v}`)}
            {v === "compat" && props.toCheck ? (
              <span class="c w"> {props.toCheck}</span>
            ) : null}
          </>
        )}
      />
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

/** The open tab's panel: the notes, Your packages or the history. */
function LeftPanel(props: {
  readonly view: View;
  readonly onView: (v: View) => void;
  readonly u: UpdateState;
  readonly release: Release;
  readonly compat: ReturnType<typeof useCompat>;
}) {
  const { t } = useUi();
  const { view, release, compat: c } = props;
  return (
    <TabPanel id={UPDATE_TABS} tab={view}>
      {view === "compat" ? (
        c.data ? (
          <CompatView release={release} data={c.data} />
        ) : (
          <div class="stu-notes" role="status">
            <p class="st-muted">{c.error ?? t("up.previewing")}</p>
          </div>
        )
      ) : view === "history" ? (
        <HistoryView channel={props.u.channel ?? "stable"} />
      ) : (
        <NotesView
          release={release}
          onHistory={() => {
            props.onView("history");
          }}
        />
      )}
    </TabPanel>
  );
}

function ReleaseView(props: {
  readonly u: UpdateState;
  readonly release: Release;
}) {
  const { u, release } = props;
  const [view, setView] = useState<View>("notes");
  const c = useCompat(u, release);
  const bad = c.data
    ? [...c.data.system, ...c.data.module].filter(toCheck).length
    : 0;
  return (
    <div class="stu-cols">
      <div class="stu-left">
        <Tabs view={view} onView={setView} toCheck={bad} />
        <LeftPanel
          view={view}
          onView={setView}
          u={u}
          release={release}
          compat={c}
        />
      </div>
      <div class="stu-side">
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
    <div class="stb-page st-app stu-page">
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
