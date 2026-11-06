// The new Setup page's header bar: Foundry's name and version, Backups,
// Configuration, the power menu, and the way back to Foundry's own page.
// For now each opens Foundry's own screen (build plan, Phase 1).
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { FoundryAction } from "../../page-protocol.ts";
import { useDismiss } from "../common/dismiss.ts";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";

/** "14.370" reads as "14 · 370", as Foundry's own footer shows it. */
const versionLabel = (version: string): string => version.replace(".", " · ");

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

export function Header() {
  const { state, page, actions, t } = useUi();
  const version = state.data.setup?.core.version ?? "";
  return (
    <header class="mls-top mlh">
      <span class="logo" aria-hidden="true" />
      <h1>{t("shell.title")}</h1>
      {version ? (
        <button
          type="button"
          class="mlh-ver"
          title={t("shell.versionHint")}
          onClick={() => page.foundryAction({ action: "update" })}
        >
          <span class="v">
            {t("shell.version", { version: versionLabel(version) })}
          </span>
        </button>
      ) : null}
      <span class="ml-spacer" />
      <div class="mlh-acts">
        <button
          type="button"
          class="mlh-back"
          title={t("shell.backHint")}
          onClick={() => void actions.setPref("newSetupPage", false)}
        >
          <Icon name="arrow-rotate-left" />
          {t("shell.back")}
        </button>
        <button
          type="button"
          onClick={() => page.foundryAction({ action: "backups" })}
        >
          <Icon name="floppy-disks" />
          {t("shell.backups")}
        </button>
        <button
          type="button"
          onClick={() => page.foundryAction({ action: "configure" })}
        >
          <Icon name="gears" />
          {t("shell.configuration")}
        </button>
        <PowerMenu />
      </div>
    </header>
  );
}
