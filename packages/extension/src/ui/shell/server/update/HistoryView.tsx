// Release history, as the prototype (_update.js updHistoryView): Foundry's
// releases on your channel (or all of them) beside the notes of the one
// picked, marked installed, new, or installed by hand. Read from
// foundryvtt.com only with the browser's permission; without it, the list
// opens there.
import { useEffect, useMemo, useState } from "preact/hooks";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import { channelName } from "../../../model/update.ts";
import { HistoryNotes } from "./HistoryNotes.tsx";
import { isNewer, type ReleaseItem } from "./releases.ts";
import { type History, useHistory } from "./useHistory.ts";

const SITE = "https://foundryvtt.com/releases/";

function Denied(props: { readonly h: History }) {
  const { t } = useUi();
  return (
    <div class="stu-hask">
      <Icon name="lock" />
      <p>{t("up.hist.why")}</p>
      <div class="row">
        <button type="button" class="bright" onClick={() => void props.h.ask()}>
          {t("up.hist.allow")}
        </button>
        <button type="button" onClick={props.h.load}>
          {t("up.hist.again")}
        </button>
        <a href={SITE} target="_blank" rel="noopener noreferrer">
          {t("up.hist.there")}
        </a>
      </div>
    </div>
  );
}

function Tags(props: { readonly r: ReleaseItem; readonly installed: string }) {
  const { t } = useUi();
  const { r } = props;
  return (
    <span class="tg">
      {r.version === props.installed ? (
        <span class="stw-pill">{t("up.hist.installed")}</span>
      ) : null}
      {isNewer(r, props.installed) ? (
        <span class="stw-pill ok">{t("up.hist.new")}</span>
      ) : null}
      {r.full ? (
        <span class="stw-pill warn" title={t("up.hist.manualTip")}>
          {t("up.hist.manual")}
        </span>
      ) : null}
      {r.channel && r.channel !== "stable" ? (
        <span class="stw-pill">{channelName(r.channel).toLowerCase()}</span>
      ) : null}
    </span>
  );
}

function List(props: {
  readonly releases: readonly ReleaseItem[];
  readonly selected: ReleaseItem | undefined;
  readonly installed: string;
  readonly onPick: (v: string) => void;
}) {
  return (
    <ol class="stu-rels">
      {props.releases.map((r) => (
        <li
          key={r.version}
          class={`${r === props.selected ? "on" : ""}${isNewer(r, props.installed) ? " newer" : ""}`}
        >
          <button
            type="button"
            aria-current={r === props.selected}
            onClick={() => {
              props.onPick(r.version);
            }}
          >
            <strong>{r.version}</strong>
            <span>{r.date}</span>
            <Tags r={r} installed={props.installed} />
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Releases of this generation and later, on the channel unless all are wanted. */
function useShown(
  all: readonly ReleaseItem[],
  channel: string,
  installed: string,
) {
  const [every, setEvery] = useState(false);
  const generation = Number(installed.split(".")[0]);
  const shown = useMemo(
    () =>
      all.filter(
        (r) =>
          r.generation >= generation &&
          r.channel !== "prototype" &&
          (every || r.channel === channel),
      ),
    [all, every, channel, generation],
  );
  return { every, setEvery, shown };
}

function Head(props: {
  readonly since: number;
  readonly installed: string;
  readonly channel: string;
}) {
  const { t } = useUi();
  return (
    <div class="stu-nhead">
      <h3>{t("up.hist.title")}</h3>
      <span>
        {props.since
          ? plural(t, "up.hist.since", props.since, {
              version: props.installed,
            })
          : t("up.hist.latest", { channel: channelName(props.channel) })}
        {" · "}
        <a href={SITE} target="_blank" rel="noopener noreferrer">
          foundryvtt.com/releases
        </a>
      </span>
    </div>
  );
}

/** The release picked, else the newest one newer than this Foundry; its notes are read. */
function useSelected(
  shown: readonly ReleaseItem[],
  installed: string,
  read: (version: string) => void,
) {
  const [picked, setPicked] = useState<string | null>(null);
  const selected =
    shown.find((r) => r.version === picked) ??
    shown.find((r) => isNewer(r, installed)) ??
    shown[0];
  useEffect(() => {
    if (selected) read(selected.version);
  }, [selected?.version]);
  return { selected, setPicked };
}

function Ready(props: {
  readonly h: History;
  readonly releases: readonly ReleaseItem[];
  readonly channel: string;
}) {
  const { t, state } = useUi();
  const installed = state.data.setup?.core.version ?? "";
  const { every, setEvery, shown } = useShown(
    props.releases,
    props.channel,
    installed,
  );
  const { selected, setPicked } = useSelected(shown, installed, props.h.read);
  const since = shown.filter((r) => isNewer(r, installed)).length;
  return (
    <>
      <Head since={since} installed={installed} channel={props.channel} />
      <div class="stu-tools">
        <label>
          <input
            type="checkbox"
            checked={every}
            onChange={() => {
              setEvery(!every);
            }}
          />
          {t("up.hist.all")}
        </label>
      </div>
      <div class="stu-hcols">
        <List
          releases={shown}
          selected={selected}
          installed={installed}
          onPick={setPicked}
        />
        {selected ? (
          <HistoryNotes
            r={selected}
            state={props.h.notes.get(selected.version)}
            onRetry={() => {
              props.h.read(selected.version);
            }}
          />
        ) : null}
      </div>
      <p class="hint">{t("up.hist.hint")}</p>
    </>
  );
}

export function HistoryView(props: { readonly channel: string }) {
  const { t } = useUi();
  const h = useHistory();
  const l = h.list;
  return (
    <div class="stu-notes stu-hist">
      {l.kind === "loading" ? (
        <p class="st-muted" role="status">
          {t("up.hist.loading")}
        </p>
      ) : l.kind === "denied" ? (
        <Denied h={h} />
      ) : l.kind === "error" ? (
        <div class="stu-hask">
          <p>{t("up.hist.failed", { error: l.error })}</p>
          <div class="row">
            <button type="button" onClick={h.load}>
              {t("up.hist.again")}
            </button>
            <a href={SITE} target="_blank" rel="noopener noreferrer">
              {t("up.hist.there")}
            </a>
          </div>
        </div>
      ) : (
        <Ready h={h} releases={l.releases} channel={props.channel} />
      )}
    </div>
  );
}
