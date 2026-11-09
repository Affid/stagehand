// One saved server on the home screen: a tap opens it in the app (native
// takes the link), ⋮ opens its sheet.
import { age } from "../model/worlds.ts";
import { ago, type Translate } from "../i18n.ts";
import type { ListedServer } from "../settings/useServers.ts";
import { hostOf, letterOf } from "./address.ts";
import { Dots, Unlock } from "./icons.tsx";

export interface ServerCardProps {
  readonly t: Translate;
  readonly server: ListedServer;
  readonly href: string;
  readonly now: number;
  readonly onEdit: () => void;
}

function Opened(props: {
  readonly t: Translate;
  readonly at: string | undefined;
  readonly now: number;
}) {
  const { t, at } = props;
  return (
    <span>
      {at
        ? t("home.opened", { ago: ago(t, age(at, props.now)) })
        : t("home.notOpened")}
    </span>
  );
}

export function ServerCard(props: ServerCardProps) {
  const { t, server } = props;
  const host = hostOf(server.id);
  const label = server.name ?? host;
  return (
    <div class="mlh-card mlh-server">
      <a
        class="mlh-open"
        href={props.href}
        aria-label={t("set.openAria", { server: label })}
      >
        <span class="mlh-letter" aria-hidden="true">
          {letterOf(label)}
        </span>
        <span class="mlh-text">
          <span class="mlh-name">{label}</span>
          <span class="mlh-sub">
            {server.name ? <span class="mlh-host">{host}</span> : null}
            {server.id.startsWith("http:") ? (
              <span class="mlh-chip mlh-plain">
                <Unlock />
                {t("set.plain")}
              </span>
            ) : null}
            {server.active ? null : (
              <span class="mlh-chip">{t("set.off")}</span>
            )}
            <Opened t={t} at={server.openedAt} now={props.now} />
          </span>
        </span>
      </a>
      <button
        type="button"
        class="mlh-ibtn"
        aria-label={t("home.editAria", { server: label })}
        onClick={props.onEdit}
      >
        <Dots />
      </button>
    </div>
  );
}
