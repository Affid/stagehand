// A module's details beside the Library cards: its Library tab (ours:
// folder, tags, note, presets, worlds) and its Package tab (Foundry's
// manifest: version, compatibility, authors, links, relations).
import type { PackageInfo, Relation } from "@module-library/shared/package";
import { useState } from "preact/hooks";
import { safeUrl } from "../../common/files.ts";
import { IconButton } from "../../common/widgets.tsx";
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

export function ModulePanel(props: {
  readonly pkg: PackageInfo;
  readonly onClose: () => void;
}) {
  const { t } = useUi();
  const [tab, setTab] = useState<Tab>("library");
  const { pkg } = props;
  return (
    <aside class="mll-side mll-panel ml-app" aria-label={pkg.title}>
      <header class="mll-panel-head">
        <h3>{pkg.title}</h3>
        <IconButton
          icon="xmark"
          label={t("mp.close")}
          onClick={props.onClose}
        />
      </header>
      <div class="mll-tabs" role="tablist">
        {(["library", "package"] as const).map((k) => (
          <button
            type="button"
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
          >
            {t(`mp.tab.${k}`)}
          </button>
        ))}
      </div>
      {tab === "library" ? <LibraryTab pkg={pkg} /> : <PackageTab pkg={pkg} />}
    </aside>
  );
}
