// A module's Package tab, as the prototype's packageInfo: what its manifest
// says (version and Foundry's badge, what it needs, authors, links), its
// relationships, its contents, and Foundry's own settings and actions for
// it on this server.
import type { PackageInfo, Relation } from "@stagehand/shared/package";
import {
  isCompatibilityRisk,
  testAvailability,
} from "@stagehand/shared/version";
import { safeUrl } from "../../common/files.ts";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { plural } from "../../i18n.ts";
import { type Kind, OnServer } from "./OnServer.tsx";

function Badge(props: { readonly pkg: PackageInfo }) {
  const { state, t } = useUi();
  const core = state.data.setup?.core;
  const verified = props.pkg.compatibility.verified;
  if (!core || !verified) return null;
  const risk = isCompatibilityRisk(
    testAvailability(props.pkg.compatibility, core),
  );
  return (
    <span class={`sts-badge ${risk ? "warn" : "ok"}`}>
      <Icon name="code-branch" />
      {t(risk ? "pk.verifiedOnly" : "pk.verified", { version: verified })}
    </span>
  );
}

function Links(props: { readonly pkg: PackageInfo }) {
  const { t } = useUi();
  const { pkg } = props;
  const links = [
    ["pk.project", pkg.url],
    ["pk.readme", pkg.readme],
    ["pk.changelog", pkg.changelog],
    ["pk.license", pkg.license],
    ["pk.bugs", pkg.bugs],
  ].flatMap(([label = "", raw]) => {
    const href = safeUrl(raw);
    return href ? [{ label, href }] : [];
  });
  if (!links.length) return <span class="st-muted">{t("mp.none")}</span>;
  return (
    <span class="sts-links">
      {links.map((l, i) => (
        <span key={l.label}>
          {i ? " · " : ""}
          <a href={l.href} target="_blank" rel="noopener noreferrer">
            {t(l.label)}
          </a>
        </span>
      ))}
    </span>
  );
}

function Facts(props: { readonly pkg: PackageInfo }) {
  const { t } = useUi();
  const { pkg } = props;
  const min = pkg.compatibility.minimum;
  return (
    <div class="sts-kv">
      <span>{t("mp.version")}</span>
      <span>
        {pkg.version} <Badge pkg={pkg} />
      </span>
      <span>{t("pk.needs")}</span>
      <span>{min ? t("pk.needsFoundry", { version: min }) : t("mp.none")}</span>
      <span>{t("mp.authors")}</span>
      <span>{pkg.authors.map((a) => a.name).join(", ") || t("mp.none")}</span>
      <span>{t("pk.links")}</span>
      <Links pkg={pkg} />
    </div>
  );
}

const REL = {
  requires: { cls: "plus", icon: "link", verb: "pk.needsModule" },
  recommends: { cls: "rec", icon: "thumbs-up", verb: "pk.recommends" },
  conflicts: { cls: "minus", icon: "ban", verb: "pk.conflictsWith" },
} as const;

function Relationships(props: { readonly pkg: PackageInfo }) {
  const { state, t } = useUi();
  const installed = state.data.setup?.modules ?? [];
  const rows = (Object.keys(REL) as (keyof typeof REL)[]).flatMap((k) =>
    (props.pkg[k] as readonly Relation[]).map((r) => ({ k, r })),
  );
  if (!rows.length) return null;
  return (
    <div class="sts-chg">
      <h4>
        <span>{t("pk.relationships")}</span>
      </h4>
      <ul>
        {rows.map(({ k, r }) => {
          const m = installed.find((x) => x.id === r.id);
          return (
            <li key={`${k}:${r.id}`}>
              <span class={`s ${REL[k].cls}`}>
                <Icon name={REL[k].icon} />
              </span>
              <span>{t(REL[k].verb, { title: m?.title ?? r.id })}</span>
              <span class="x">{t(m ? "pk.installed" : "pk.notInstalled")}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Contents(props: { readonly pkg: PackageInfo }) {
  const { t } = useUi();
  const packs = props.pkg.packs ?? [];
  const langs = props.pkg.languages ?? [];
  return (
    <div class="sts-chg">
      <h4>
        <span>{t("pk.contents")}</span>
      </h4>
      <ul>
        <li>
          <span class="s">
            <Icon name="book" />
          </span>
          <span>
            {packs.length
              ? `${plural(t, "pk.packs", packs.length)}: ${packs.join(", ")}`
              : t("pk.noPacks")}
          </span>
          <span />
        </li>
        <li>
          <span class="s">
            <Icon name="language" />
          </span>
          <span>{langs.length ? langs.join(", ") : t("pk.noLanguages")}</span>
          <span />
        </li>
      </ul>
    </div>
  );
}

export function PackageTab(props: {
  readonly pkg: PackageInfo;
  readonly kind?: Kind;
}) {
  const { t } = useUi();
  const kind = props.kind ?? "module";
  return (
    <div class="sts-pkgtab">
      <Facts pkg={props.pkg} />
      <Relationships pkg={props.pkg} />
      <Contents pkg={props.pkg} />
      <OnServer pkg={props.pkg} kind={kind} />
      <p class="st-muted sts-foot">{t(`pk.foot.${kind}`)}</p>
    </div>
  );
}
