// The app's home screen (Android plan, phase 6; mockup design/app-screens,
// home A): the saved servers as cards, Release history, the build, and Add a
// server in a bar at the bottom. The extension's popup stays ui/settings.
import { useEffect, useRef, useState } from "preact/hooks";
import type { ServerId } from "../../background/servers.ts";
import { createTranslator, pickLanguage, type Translate } from "../i18n.ts";
import type {
  AppHome as AppLinks,
  SettingsPlatform,
} from "../settings/platform.ts";
import { type Servers, useServers } from "../settings/useServers.ts";
import { AddSheet } from "./AddSheet.tsx";
import { type BackStack, BackContext } from "./back.ts";
import { Mark, Plus } from "./icons.tsx";
import { ReleaseSwitch } from "./ReleaseSwitch.tsx";
import { ServerCard } from "./ServerCard.tsx";
import { ServerSheet } from "./ServerSheet.tsx";

export interface AppHomeProps {
  readonly platform: SettingsPlatform;
  readonly app: AppLinks;
  readonly back: BackStack;
  /** Goes to a server's page: native opens it in the server WebView. */
  readonly open: (href: string) => void;
  readonly now?: () => number;
}

type Open =
  | { readonly kind: "add" }
  | { readonly kind: "edit"; readonly id: ServerId }
  | null;

const t = createTranslator(pickLanguage("", globalThis.navigator.language));

function ServerCards(props: {
  readonly t: Translate;
  readonly servers: Servers;
  readonly app: AppLinks;
  readonly now: number;
  readonly onEdit: (id: ServerId) => void;
}) {
  const list = props.servers.list;
  if (list === null) return null;
  if (list.length === 0)
    return (
      <div class="mlh-card mlh-empty">
        <h2>{t("home.emptyTitle")}</h2>
        <p>{t("home.emptyText")}</p>
      </div>
    );
  return (
    <>
      <h2 class="mlh-eyebrow">{t("home.servers")}</h2>
      {list.map((s) => (
        <ServerCard
          key={s.id}
          t={t}
          server={s}
          href={props.app.serverHref(s.id)}
          now={props.now}
          onEdit={() => {
            props.onEdit(s.id);
          }}
        />
      ))}
      <p class="mlh-hint">{t("home.hint")}</p>
    </>
  );
}

/** The open sheet, if any: adding a server or a saved server's own. */
function Sheets(props: {
  readonly open: Open;
  readonly servers: Servers;
  readonly app: AppLinks;
  readonly onClose: () => void;
  readonly onOpen: (href: string) => void;
}) {
  const { open, servers, app, onClose } = props;
  if (open?.kind === "add")
    return (
      <AddSheet
        t={t}
        servers={servers}
        app={app}
        onClose={onClose}
        onOpen={(s) => {
          onClose();
          props.onOpen(app.serverHref(s));
        }}
      />
    );
  const editing =
    open?.kind === "edit"
      ? servers.list?.find((s) => s.id === open.id)
      : undefined;
  return editing ? (
    <ServerSheet
      t={t}
      server={editing}
      servers={servers}
      app={app}
      onClose={onClose}
    />
  ) : null;
}

function Dock(props: { readonly onAdd: () => void; readonly inert: boolean }) {
  return (
    <div class="mlh-dock" inert={props.inert}>
      <button type="button" class="mlh-btn mlh-bright" onClick={props.onAdd}>
        <Plus />
        {t("home.add")}
      </button>
    </div>
  );
}

/**
 * The open sheet, and focus back on the button that opened it once none is
 * open (code review): the edit sheet turning into "Remove?" is one opening.
 */
function useSheet() {
  const [open, setOpen] = useState<Open>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    if (open !== null) return;
    const from = opener.current;
    opener.current = null;
    if (from instanceof HTMLElement && from.isConnected) from.focus();
  }, [open]);
  const show = (next: Open): void => {
    if (next !== null) opener.current = document.activeElement;
    setOpen(next);
  };
  return [open, show] as const;
}

export function AppHome(props: AppHomeProps) {
  const { platform, app } = props;
  const servers = useServers(platform);
  const [open, setOpen] = useSheet();
  return (
    <BackContext.Provider value={props.back}>
      <div class="mlh">
        <header class="mlh-top" inert={open !== null}>
          <Mark />
          <h1>{t("set.title")}</h1>
        </header>
        <main class="mlh-body" inert={open !== null}>
          <ServerCards
            t={t}
            servers={servers}
            app={app}
            now={(props.now ?? Date.now)()}
            onEdit={(id) => {
              setOpen({ kind: "edit", id });
            }}
          />
          <h2 class="mlh-eyebrow">{t("home.settings")}</h2>
          <ReleaseSwitch t={t} platform={platform} />
          <footer class="mlh-foot">
            {t("set.build", { build: platform.build })}
          </footer>
        </main>
        <Dock
          inert={open !== null}
          onAdd={() => {
            setOpen({ kind: "add" });
          }}
        />
        <Sheets
          open={open}
          servers={servers}
          app={app}
          onClose={() => {
            setOpen(null);
          }}
          onOpen={props.open}
        />
      </div>
    </BackContext.Provider>
  );
}
