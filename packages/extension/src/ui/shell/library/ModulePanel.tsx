// A module's details in their own column beside the Library or a world's
// page: its Library tab (ours: folder, tags, note, presets, worlds) and its
// Package tab (Foundry's manifest: version, compatibility, authors, links,
// relations).
import type { PackageInfo, Relation } from "@module-library/shared/package";
import { useState } from "preact/hooks";
import { safeUrl } from "../../common/files.ts";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { LibraryTab } from "./LibraryTab.tsx";

type Tab = "library" | "package";

function Relations(props: { readonly list: readonly Relation[] }) {
  const { state, t } = useUi();
  const title = (id: string): string =>
    state.data.setup?.modules.find((m) => m.id === id)?.title ?? id;
  if (props.list.length === 0) return <dd>{t("mp.none")}</dd>;
  return <dd>{props.list.map((r) => title(r.id)).join(", ")}</dd>;
}

function Link(props: {
  readonly href: string | undefined;
  readonly label: string;
}) {
  const href = safeUrl(props.href);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {props.label}
    </a>
  ) : null;
}

function PackageTab(props: { readonly pkg: PackageInfo }) {
  const { t } = useUi();
  const { pkg } = props;
  return (
    <dl class="mll-pkg">
      <dt>{t("mp.version")}</dt>
      <dd>{pkg.version}</dd>
      <dt>{t("mp.compat")}</dt>
      <dd>
        {t("mp.compatValue", {
          min: pkg.compatibility.minimum ?? "-",
          verified: pkg.compatibility.verified ?? "-",
        })}
      </dd>
      <dt>{t("mp.authors")}</dt>
      <dd>{pkg.authors.map((a) => a.name).join(", ") || t("mp.none")}</dd>
      <dt>{t("mp.requires")}</dt>
      <Relations list={pkg.requires} />
      <dt>{t("mp.conflicts")}</dt>
      <Relations list={pkg.conflicts} />
      <dd class="links">
        <Link href={pkg.url} label={t("mp.url")} />
        <Link href={pkg.bugs} label={t("mp.bugs")} />
      </dd>
    </dl>
  );
}

/** "modular-av · v0.11.0 · Andrei Fedorov". */
function Sub(props: { readonly pkg: PackageInfo }) {
  const { pkg } = props;
  const authors = pkg.authors.map((a) => a.name).join(", ");
  return (
    <div class="sub">
      {[pkg.id, `v${pkg.version}`, authors].filter(Boolean).join(" · ")}
    </div>
  );
}

const TAB_ICON: Record<Tab, string> = { library: "books", package: "box-open" };

/** The details column, as the prototype: "Module", the name, two tabs. */
export function ModulePanel(props: {
  readonly pkg: PackageInfo;
  /** The world whose page is open, marked in the worlds list. */
  readonly here?: string | undefined;
  readonly onClose: () => void;
}) {
  const { t } = useUi();
  const [tab, setTab] = useState<Tab>("library");
  const { pkg } = props;
  return (
    <aside class="application framed mls-panel ml-app" aria-label={pkg.title}>
      <h2 class="divider">{t("mp.title")}</h2>
      <button
        type="button"
        class="icon mls-close"
        aria-label={t("mp.close")}
        title={t("mp.close")}
        onClick={props.onClose}
      >
        <Icon name="xmark" />
      </button>
      <div class="scroll">
        <div class="mls-modhead">
          <h3>{pkg.title}</h3>
          <Sub pkg={pkg} />
        </div>
        <nav class="mls-subtabs" role="tablist">
          {(["library", "package"] as const).map((k) => (
            <button
              type="button"
              key={k}
              role="tab"
              class={tab === k ? "active" : ""}
              aria-selected={tab === k}
              onClick={() => setTab(k)}
            >
              <Icon name={TAB_ICON[k]} />
              {t(`mp.tab.${k}`)}
            </button>
          ))}
        </nav>
        {tab === "library" ? (
          <LibraryTab pkg={pkg} here={props.here} />
        ) : (
          <PackageTab pkg={pkg} />
        )}
      </div>
    </aside>
  );
}
