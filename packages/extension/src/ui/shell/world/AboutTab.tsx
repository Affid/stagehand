// A world's About tab: its description (cleaned), Foundry's details, and
// the next session in the viewer's own time with the zone named. Editing
// opens Foundry's World Configuration for now (build plan, Phase 4).
import type { WorldInfo } from "@module-library/shared/world";
import { useState } from "preact/hooks";
import { RichText } from "../../common/rich-text.tsx";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { useLastPlayed } from "../WorldRail.tsx";
import { SessionField, TitleField, useCanEditWorld } from "./AboutEdit.tsx";

/** Longer descriptions fold until "Show more". */
const FOLD_CHARS = 600;

/** "Thursday, 12 November 2026 at 19:00 CET", or undefined if unreadable. */
export function formatSession(
  iso: string | undefined,
  lang?: string,
): string | undefined {
  const t = Date.parse(iso ?? "");
  if (!Number.isFinite(t)) return undefined;
  // dateStyle can't be combined with timeZoneName: spell the parts out.
  return new Intl.DateTimeFormat(lang === "" ? undefined : lang, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(t);
}

function Description(props: { readonly html: string | undefined }) {
  const { t } = useUi();
  const [open, setOpen] = useState(false);
  const html = props.html ?? "";
  if (!html.trim()) return <p class="ml-empty">{t("about.noDescription")}</p>;
  const long = html.length > FOLD_CHARS;
  return (
    <div class={`mlw-desc${long && !open ? " folded" : ""}`}>
      <RichText html={html} />
      {long ? (
        <button
          type="button"
          class="ml-link"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? t("about.less") : t("about.more")}
        </button>
      ) : null}
    </div>
  );
}

function Details(props: { readonly world: WorldInfo }) {
  const { state, t } = useUi();
  const { world } = props;
  const canEdit = useCanEditWorld();
  const lastPlayed = useLastPlayed();
  const session = formatSession(world.nextSession, state.data.setup?.lang);
  const yesNo = (v: boolean | undefined): string =>
    v ? t("about.yes") : t("about.no");
  return (
    <dl class="mlw-details">
      {canEdit ? (
        <>
          <dt>{t("about.title")}</dt>
          <dd>
            <TitleField world={world} />
          </dd>
        </>
      ) : null}
      <dt>{t("about.system")}</dt>
      <dd>
        {world.system} {world.systemVersion}
      </dd>
      <dt>{t("about.core")}</dt>
      <dd>{world.coreVersion}</dd>
      <dt>{t("about.next")}</dt>
      <dd class="mlw-next">
        {canEdit ? (
          <SessionField world={world} />
        ) : (
          (session ?? t("about.notSet"))
        )}
      </dd>
      <dt>{t("about.lastPlayed")}</dt>
      <dd>{lastPlayed(world)}</dd>
      <dt>{t("about.favorite")}</dt>
      <dd>{yesNo(world.favorite)}</dd>
      <dt>{t("about.locked")}</dt>
      <dd>{yesNo(world.locked)}</dd>
    </dl>
  );
}

export function AboutTab(props: { readonly world: WorldInfo }) {
  const { page, t } = useUi();
  const { world } = props;
  return (
    <div class="mlw-about">
      <section class="mlw-box">
        <h3>{t("about.description")}</h3>
        <Description html={world.description} />
      </section>
      <section class="mlw-box">
        <h3>{t("about.details")}</h3>
        <Details world={world} />
        <button
          type="button"
          title={t("about.editHint")}
          onClick={() =>
            page.foundryAction({ action: "editWorld", worldId: world.id })
          }
        >
          <Icon name="pen" />
          {t("about.edit")}
        </button>
      </section>
    </div>
  );
}
