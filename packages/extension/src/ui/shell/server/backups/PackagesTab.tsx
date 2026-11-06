// The Worlds, Modules or Systems tab: filter by name, sort by name, size or
// latest backup, and every package of that type with backups.
import { useState } from "preact/hooks";
import type { PackageType } from "../../../../page-backups.ts";
import type { PackageBackups } from "../../../../page-server-backups.ts";
import { formatSize } from "../../../common/size.ts";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import { PackageRow, type RunPackage } from "./PackageRow.tsx";

type Sort = "name" | "size" | "latest";
const SORTS: readonly Sort[] = ["name", "size", "latest"];

const sizeOf = (p: PackageBackups): number =>
  p.backups.reduce((n, b) => n + b.size, 0);
const latestOf = (p: PackageBackups): number =>
  Math.max(0, ...p.backups.map((b) => b.createdAt));

const ORDER: Record<Sort, (a: PackageBackups, b: PackageBackups) => number> = {
  name: (a, b) => a.title.localeCompare(b.title),
  size: (a, b) => sizeOf(b) - sizeOf(a),
  latest: (a, b) => latestOf(b) - latestOf(a),
};

function Tools(props: {
  readonly type: PackageType;
  readonly all: readonly PackageBackups[];
  readonly q: string;
  readonly sort: Sort;
  readonly onQ: (q: string) => void;
  readonly onSort: (s: Sort) => void;
}) {
  const { t } = useUi();
  const { type, all } = props;
  const backups = all.reduce((n, p) => n + p.backups.length, 0);
  const label = t(`sb.filter.${type}`);
  return (
    <div class="ml-row mlb-tools">
      <input
        type="search"
        value={props.q}
        placeholder={label}
        aria-label={label}
        onInput={(e) => props.onQ(e.currentTarget.value)}
      />
      <span class="ml-label">{t("sb.sortBy")}</span>
      <select
        aria-label={t("sb.sortBy")}
        value={props.sort}
        onChange={(e) => props.onSort(e.currentTarget.value as Sort)}
      >
        {SORTS.map((s) => (
          <option key={s} value={s}>
            {t(`sb.sort.${s}`)}
          </option>
        ))}
      </select>
      <span class="ml-spacer" />
      <span class="ml-muted">
        {t("sb.ofPackages", {
          backups: plural(t, "bk.count", backups),
          packages: plural(t, `sb.noun.${type}`, all.length),
          size: formatSize(all.reduce((n, p) => n + sizeOf(p), 0)),
        })}
      </span>
    </div>
  );
}

/** Which packages are folded open. */
function useOpen() {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string): void => {
    setOpen((o) =>
      o.has(id) ? new Set([...o].filter((x) => x !== id)) : new Set([...o, id]),
    );
  };
  return { open, toggle };
}

export function PackagesTab(props: {
  readonly type: PackageType;
  readonly packages: readonly PackageBackups[];
  readonly off: string | null;
  readonly run: RunPackage;
}) {
  const { t } = useUi();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const { open, toggle } = useOpen();
  const text = q.trim().toLowerCase();
  const shown = props.packages
    .filter((p) => !text || p.title.toLowerCase().includes(text))
    .sort(ORDER[sort]);
  return (
    <>
      <Tools
        type={props.type}
        all={props.packages}
        q={q}
        sort={sort}
        onQ={setQ}
        onSort={setSort}
      />
      {shown.length ? (
        <div class="mlb-scroll">
          <ol class="mlb-pkgs">
            {shown.map((p) => (
              <PackageRow
                key={p.id}
                p={p}
                open={open.has(p.id)}
                onToggle={() => toggle(p.id)}
                off={props.off}
                run={props.run}
              />
            ))}
          </ol>
        </div>
      ) : (
        <p class="ml-muted mlb-none">
          {t(text ? `sb.noMatch.${props.type}` : `sb.noneOf.${props.type}`)}
        </p>
      )}
    </>
  );
}
