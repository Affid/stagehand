// Your packages on a release, as the prototype (_update.js updCompatView):
// Systems, Modules and Worlds with how many need a look, a filter, a chip
// per status that is also its filter, and one row per package: its status,
// why, its version (and the one to update to), where it is used, and links.
import { useState } from "preact/hooks";
import type { Release } from "../../../../page-update.ts";
import { safeUrl } from "../../../common/files.ts";
import { TabList, TabPanel } from "../../../common/tabs.tsx";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import {
  byConcern,
  type CompatData,
  type CompatRow,
  type Kind,
  type Status,
  toCheck,
  updatesNeeded,
} from "./compat.ts";
import { STATUS_ICON, statusLabel, why } from "./compat-text.ts";
import { useOpenRow } from "./useOpenRow.ts";
import { shownVersion } from "@module-library/shared/version";

type Chip = "all" | Exclude<Status, "dep">;
const CHIPS: readonly Chip[] = ["all", "ok", "unv", "risk", "bad"];
const KINDS: readonly Kind[] = ["system", "module", "world"];
const KIND_TABS = "ml-uk";

/** Incompatible includes a missing dependency. */
const inChip = (x: CompatRow, c: Chip): boolean =>
  c === "all" || x.status === c || (c === "bad" && x.status === "dep");

function Kinds(props: {
  readonly data: CompatData;
  readonly kind: Kind;
  readonly onKind: (k: Kind) => void;
}) {
  const { t } = useUi();
  const tab = (k: Kind) => {
    const list = props.data[k];
    const bad = list.filter(toCheck).length;
    return (
      <>
        {t(`up.kind.${k}`)}{" "}
        <span class="c">
          {list.length}
          {bad ? (
            <>
              {" · "}
              <b class="w">{t("up.toCheck", { n: bad })}</b>
            </>
          ) : null}
        </span>
      </>
    );
  };
  return (
    <TabList
      id={KIND_TABS}
      label={t("up.kinds")}
      tabs={KINDS}
      current={props.kind}
      onTab={props.onKind}
      render={tab}
    />
  );
}

function Chips(props: {
  readonly list: readonly CompatRow[];
  readonly chip: Chip;
  readonly onChip: (c: Chip) => void;
}) {
  const { t } = useUi();
  return (
    <div class="mlu-chips" role="group" aria-label={t("up.show")}>
      {CHIPS.map((c) => {
        const n = props.list.filter((x) => inChip(x, c)).length;
        const zero = !n && c !== "all";
        return (
          <button
            type="button"
            key={c}
            class={`${c}${props.chip === c ? " on" : ""}${zero ? " zero" : ""}`}
            aria-pressed={props.chip === c}
            disabled={zero}
            onClick={() => {
              props.onChip(c);
            }}
          >
            {c === "all" ? null : <Icon name={STATUS_ICON[c]} />}
            {c === "all" ? t("up.all") : statusLabel(t, c)} <b>{n}</b>
          </button>
        );
      })}
    </div>
  );
}

function Where(props: { readonly x: CompatRow }) {
  const { t } = useUi();
  const open = useOpenRow();
  const { x } = props;
  if (x.kind === "world")
    return (
      <button
        type="button"
        class="ml-link"
        onClick={() => {
          open(x);
        }}
      >
        {t("up.openWorld")}
      </button>
    );
  if (!x.worlds.length) return <span class="none">{t("up.inNoWorld")}</span>;
  return (
    <span title={x.worlds.map((w) => w.title).join(", ")}>
      {plural(t, "up.onIn", x.worlds.length)}
    </span>
  );
}

function Links(props: { readonly x: CompatRow }) {
  const { t } = useUi();
  const { x } = props;
  const page = safeUrl(x.url);
  const log = x.needsUpdate ? safeUrl(x.changelog) : undefined;
  return (
    <span class="lk">
      {page ? (
        <a
          href={page}
          target="_blank"
          rel="noopener noreferrer"
          // Where it really goes: a package's author chose it (review).
          title={`${t("up.pkgPage")}: ${new URL(page).host}`}
          aria-label={t("up.pkgPage")}
        >
          <Icon name="arrow-up-right-from-square" />
        </a>
      ) : null}
      {log ? (
        <a
          href={log}
          target="_blank"
          rel="noopener noreferrer"
          title={`${t("up.changelog", { version: x.latest ?? "" })}: ${new URL(log).host}`}
          aria-label={t("up.changelog", { version: x.latest ?? "" })}
        >
          <Icon name="list-ul" />
        </a>
      ) : null}
    </span>
  );
}

function Version(props: { readonly x: CompatRow; readonly system: string }) {
  const { x } = props;
  if (x.kind === "world") return <span class="v">{props.system}</span>;
  return (
    <span class="v">
      {x.needsUpdate ? (
        <>
          {shownVersion(x.installed ?? "")} → <b>{x.latest}</b>
        </>
      ) : (
        shownVersion(x.installed ?? x.latest ?? "?")
      )}
    </span>
  );
}

function Row(props: { readonly x: CompatRow; readonly version: string }) {
  const { t } = useUi();
  const open = useOpenRow();
  const { x } = props;
  return (
    <li class={x.status}>
      <span
        class="st"
        role="img"
        aria-label={statusLabel(t, x.status)}
        title={statusLabel(t, x.status)}
      >
        <Icon name={STATUS_ICON[x.status]} />
      </span>
      <div class="nm">
        <button
          type="button"
          class="t"
          onClick={() => {
            open(x);
          }}
        >
          {x.title}
        </button>
        <span>{why(t, x, props.version)}</span>
      </div>
      <Version x={x} system={x.sys?.title ?? ""} />
      <span class="u">
        <Where x={x} />
      </span>
      {x.kind === "world" ? <span /> : <Links x={x} />}
    </li>
  );
}

function useFilters() {
  const [kind, setKind] = useState<Kind>("system");
  const [chip, setChip] = useState<Chip>("all");
  const [q, setQ] = useState("");
  const onKind = (k: Kind): void => {
    setKind(k);
    setChip("all");
  };
  return { kind, onKind, chip, setChip, q, setQ };
}

function Hint(props: { readonly updates: number; readonly version: string }) {
  const { t } = useUi();
  const { updates, version } = props;
  return (
    <p class="hint">
      {updates ? `${plural(t, "up.onlyAfter", updates, { version })} ` : ""}
      {t("up.compatHint")}
    </p>
  );
}

export function CompatView(props: {
  readonly release: Release;
  readonly data: CompatData;
}) {
  const { t } = useUi();
  const { data, release } = props;
  const f = useFilters();
  const list = data[f.kind];
  // A chip with nothing left in it shows all, not an empty dead end (review).
  const chip = list.some((x) => inChip(x, f.chip)) ? f.chip : "all";
  const q = f.q.trim().toLowerCase();
  const shown = list
    .filter((x) => inChip(x, chip) && (!q || x.title.toLowerCase().includes(q)))
    .sort(byConcern);
  return (
    <div class="mlu-notes mlu-compat">
      <div class="mlu-nhead">
        <h3>{t("up.compatTitle", { version: release.version })}</h3>
        <span>{t("up.compatSub")}</span>
      </div>
      <nav class="mls-subtabs">
        <Kinds data={data} kind={f.kind} onKind={f.onKind} />
        <input
          type="search"
          class="mlu-csearch"
          value={f.q}
          placeholder={t(`up.filter.${f.kind}`)}
          aria-label={t(`up.filter.${f.kind}`)}
          onInput={(e) => {
            f.setQ(e.currentTarget.value);
          }}
        />
      </nav>
      <TabPanel id={KIND_TABS} tab={f.kind}>
        <Chips list={list} chip={chip} onChip={f.setChip} />
        <ol class="mlu-clist">
          {shown.length ? (
            shown.map((x) => <Row key={x.id} x={x} version={release.version} />)
          ) : (
            <li class="empty">{t("up.nothing")}</li>
          )}
        </ol>
        <Hint updates={updatesNeeded(data)} version={release.version} />
      </TabPanel>
    </div>
  );
}
