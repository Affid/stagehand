// The new Setup page's header bar: Foundry's name, the Version chip and its
// menu, Backups and Configuration (our pages), and the power menu.
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { FoundryAction } from "../../page-protocol.ts";
import { useDismiss } from "../common/dismiss.ts";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { VersionMenu } from "./VersionMenu.tsx";

/** Log out and Shut down: a disclosure of two plain buttons. */
function PowerMenu() {
  const { page, t } = useUi();
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
  const run = (action: FoundryAction): void => {
    close(true);
    page.foundryAction(action);
  };
  return (
    <div class="mlh-power" ref={wrap}>
      <button
        type="button"
        ref={trigger}
        class={`icon${open ? " ml-on" : ""}`}
        aria-label={t("shell.power")}
        title={t("shell.power")}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="power-off" />
      </button>
      {open ? (
        <div class="mlh-menu">
          <button
            type="button"
            ref={first}
            onClick={() => run({ action: "logout" })}
          >
            <Icon name="door-open" />
            {t("shell.logout")}
          </button>
          <button type="button" onClick={() => run({ action: "shutdown" })}>
            <Icon name="power-off" />
            {t("shell.shutdown")}
          </button>
        </div>
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
    <div class="mlh-acts">
      <button
        type="button"
        class={onBackups ? "ml-on" : ""}
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
        class={onConfig ? "ml-on" : ""}
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
    <header class="mls-top mlh">
      <span class="logo" aria-hidden="true" />
      <h1>{t("shell.title")}</h1>
      <VersionMenu />
      <span class="ml-spacer" />
      <Actions />
    </header>
  );
}
