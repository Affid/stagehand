// The short summary beside the notes (prototype updCompat): counts by
// status, the five that need a look most, and how many need updating too.
// The full list is the Your packages tab.
import type { Release } from "../../../../page-update.ts";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import {
  byConcern,
  type CompatData,
  type CompatRow,
  type Status,
  updatesNeeded,
} from "./compat.ts";
import { statusLabel } from "./compat-text.ts";
import { useOpenRow } from "./useOpenRow.ts";

const SHOWN = 5;
/** The colour group a status reads in. */
export const TONE: Readonly<Record<Status, string>> = {
  ok: "ok",
  unv: "unv",
  risk: "unv",
  bad: "bad",
  dep: "bad",
};

function Tags(props: { readonly all: readonly CompatRow[] }) {
  const { t } = useUi();
  const n = (...s: Status[]): number =>
    props.all.filter((x) => s.includes(x.status)).length;
  const tag = (count: number, tone: string, key: string) =>
    count ? (
      <span class={`stu-tag ${tone}`}>{plural(t, key, count)}</span>
    ) : null;
  return (
    <div class="stu-tags">
      {tag(n("ok"), "ok", "up.tag.ok")}
      {tag(n("unv"), "unv", "up.tag.unv")}
      {tag(n("risk"), "unv", "up.tag.risk")}
      {tag(n("bad", "dep"), "bad", "up.tag.bad")}
    </div>
  );
}

function Flagged(props: { readonly rows: readonly CompatRow[] }) {
  const { t } = useUi();
  const open = useOpenRow();
  const top = props.rows.slice(0, SHOWN);
  const more = props.rows.length - top.length;
  return (
    <ul class="stu-flag">
      {top.map((x) => (
        <li key={`${x.kind}:${x.id}`} class={TONE[x.status]}>
          <button
            type="button"
            class="t"
            onClick={() => {
              open(x);
            }}
          >
            {x.title}
          </button>
          <span class="w">{statusLabel(t, x.status)}</span>
        </li>
      ))}
      {more > 0 ? <li class="more">{t("up.andMore", { n: more })}</li> : null}
    </ul>
  );
}

export function CompatBox(props: {
  readonly release: Release;
  readonly data: CompatData | null;
  readonly error?: string;
  readonly onFull: () => void;
}) {
  const { t } = useUi();
  const { data } = props;
  const all = data ? [...data.system, ...data.module] : [];
  const flagged = all.filter((x) => x.status !== "ok").sort(byConcern);
  const updates = data ? updatesNeeded(data) : 0;
  return (
    <section class="stw-box">
      <h4>
        <span>{t("up.yours", { version: props.release.version })}</span>
        <button type="button" class="st-link" onClick={props.onFull}>
          {t("up.fullList")}
        </button>
      </h4>
      {!data ? (
        <p class="st-muted" role="status">
          {props.error ?? (
            <>
              <Icon name="spinner fa-spin-pulse" /> {t("up.previewing")}
            </>
          )}
        </p>
      ) : (
        <>
          <Tags all={all} />
          {flagged.length ? (
            <Flagged rows={flagged} />
          ) : (
            <p class="st-muted">{t("up.allCompatible")}</p>
          )}
          {updates ? (
            <p class="hint">{plural(t, "up.needUpdating", updates)}</p>
          ) : null}
        </>
      )}
    </section>
  );
}
