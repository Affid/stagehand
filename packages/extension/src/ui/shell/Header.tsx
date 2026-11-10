// The new Setup page's header bar: Foundry's name, the Version chip and its
// menu, Backups and Configuration (our pages), and the power menu.
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useQuirks } from "../quirks.ts";
import { StopDialog } from "./server/config/Dialogs.tsx";
import type { FoundryAction } from "../../page-protocol.ts";
import { useDismiss } from "../common/dismiss.ts";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { VersionMenu } from "./VersionMenu.tsx";

/** The power menu's two buttons: Log out, and Shut down. */
function PowerItems(props: {
  readonly first: { current: HTMLButtonElement | null };
  readonly onLogout: () => void;
  readonly onShutDown: () => void;
}) {
  const { t } = useUi();
  return (
    <div class="sth-menu">
      <button type="button" ref={props.first} onClick={props.onLogout}>
        <Icon name="door-open" />
        {t("shell.logout")}
      </button>
      <button type="button" onClick={props.onShutDown}>
        <Icon name="power-off" />
        {t("shell.shutdown")}
      </button>
    </div>
  );
}

/** A disclosure: open, focus its first item, close on a click away. */
function useDisclosure() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);
  useDismiss(open, close, wrap);
  useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);
  return { open, setOpen, wrap, trigger, first, close };
}

/** Log out and Shut down: a disclosure of two plain buttons. */
export function PowerMenu() {
  const { page, t } = useUi();
  const quirks = useQuirks();
  const [stopping, setStopping] = useState(false);
  const { open, setOpen, wrap, trigger, first, close } = useDisclosure();
  const run = (action: FoundryAction): void => {
    close(true);
    page.foundryAction(action);
  };
  // Foundry's own Shut down where its menu has one; else our confirm (13).
  const shutDown = (): void => {
    if (quirks.menuShutdown) run({ action: "shutdown" });
    else {
      close(false);
      setStopping(true);
    }
  };
  return (
    <div class="sth-power" ref={wrap}>
      <button
        type="button"
        ref={trigger}
        class={`icon${open ? " st-on" : ""}`}
        aria-label={t("shell.power")}
        title={t("shell.power")}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="power-off" />
      </button>
      {open ? (
        <PowerItems
          first={first}
          onLogout={() => run({ action: "logout" })}
          onShutDown={shutDown}
        />
      ) : null}
      {stopping ? (
        <StopDialog electron={false} onClose={() => setStopping(false)} />
      ) : null}
    </div>
  );
}

/** The server pages and the power menu. */
function Actions() {
  const { state, store, t } = useUi();
  const on = state.route?.kind === "server" ? state.route.page : null;
  const onBackups = on === "backups";
  const onConfig = on === "config";
  return (
    <div class="sth-acts">
      <button
        type="button"
        class={onBackups ? "st-on" : ""}
        aria-current={onBackups ? "page" : undefined}
        onClick={() =>
          store.set({ route: { kind: "server", page: "backups" } })
        }
      >
        <Icon name="floppy-disks" />
        {t("shell.backups")}
      </button>
      <button
        type="button"
        class={onConfig ? "st-on" : ""}
        aria-current={onConfig ? "page" : undefined}
        onClick={() => store.set({ route: { kind: "server", page: "config" } })}
      >
        <Icon name="gears" />
        {t("shell.configuration")}
      </button>
      {/* Foundry offers Log out and Shut down only with an admin password. */}
      {state.data.setup?.passwordSet === false ? null : <PowerMenu />}
    </div>
  );
}

export function Header() {
  const { t } = useUi();
  return (
    <header class="sts-top sth">
      <span class="logo" aria-hidden="true" />
      <h1>{t("shell.title")}</h1>
      <VersionMenu />
      <span class="st-spacer" />
      <Actions />
    </header>
  );
}
