// The header's Version chip and its menu (SETUP-REDESIGN.md, Header bar):
// Foundry's build and channel, the update, and Help (Foundry's own Support
// and issues window, and the knowledge base on foundryvtt.com).
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useDismiss } from "../common/dismiss.ts";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { channelName } from "../model/update.ts";

export const KB_URL = "https://foundryvtt.com/kb/";

/** "14.370" reads as "14 · 370", as Foundry's own footer shows it. */
export const versionLabel = (version: string): string =>
  version.replace(".", " · ");

function Update(props: { readonly onPage: () => void }) {
  const { state, t } = useUi();
  const update = state.data.setup?.coreUpdate;
  if (update?.hasUpdate)
    return (
      <div class="avail">
        <Icon name="arrow-up" />
        <span>{t("vm.available", { version: update.version })}</span>
        <button type="button" class="st-primary" onClick={props.onPage}>
          {t("vm.whatsNew")}
        </button>
      </div>
    );
  const unreachable = update?.reachable === false;
  return (
    <div class={`avail none${unreachable ? " warn" : ""}`}>
      <Icon name={unreachable ? "triangle-exclamation" : "circle-check"} />
      <span>{t(unreachable ? "vm.unreachable" : "vm.current")}</span>
      <button type="button" class="st-link" onClick={props.onPage}>
        {t("vm.updatePage")}
      </button>
    </div>
  );
}

interface MenuProps {
  readonly first: { current: HTMLButtonElement | null };
  readonly close: () => void;
}

/** Foundry's own Support and issues window, and the knowledge base. */
function Help(props: MenuProps) {
  const { state, page, t } = useUi();
  const issues = state.data.setup?.issues ?? 0;
  return (
    <div class="sth-help">
      <button
        type="button"
        ref={(el) => {
          props.first.current = el;
        }}
        onClick={() => {
          props.close();
          page.foundryAction({ action: "warnings" });
        }}
      >
        <Icon name="life-ring" />
        <span>{t("vm.support")}</span>
        {issues ? (
          <span class="st-muted">{t("vm.issues", { n: String(issues) })}</span>
        ) : null}
      </button>
      <a href={KB_URL} target="_blank" rel="noopener noreferrer">
        <Icon name="book-open" />
        <span>{t("vm.kb")}</span>
        <Icon name="arrow-up-right-from-square" />
      </a>
    </div>
  );
}

function Menu(props: MenuProps) {
  const { state, store, t } = useUi();
  const setup = state.data.setup;
  const channel = channelName(setup?.coreUpdate?.channel ?? "");
  const toUpdate = (): void => {
    props.close();
    store.set({ route: { kind: "server", page: "update" } });
  };
  return (
    <section class="st-pop sth-fm" role="region" aria-label={t("shell.title")}>
      <header>
        <strong>{t("shell.title")}</strong>
      </header>
      <div class="sth-upd">
        <div>
          <strong>
            {t("vm.build", {
              generation: String(setup?.core.generation ?? ""),
              build: String(setup?.core.build ?? ""),
            })}
          </strong>
          {channel ? (
            <span class="st-muted">{t("vm.channel", { channel })}</span>
          ) : null}
        </div>
        <Update onPage={toUpdate} />
      </div>
      <h4>{t("vm.help")}</h4>
      <Help first={props.first} close={props.close} />
    </section>
  );
}

/** The chip's text: "Version 14 · 370", or "14 · 370" in the phone's top bar. */
function ChipText(props: {
  readonly version: string;
  readonly hasUpdate: boolean;
  readonly compact: boolean;
}) {
  const { t } = useUi();
  const label = versionLabel(props.version);
  if (props.compact)
    return (
      <span class="v">
        {label}
        {props.hasUpdate ? <Icon name="arrow-up" /> : null}
      </span>
    );
  return (
    <>
      <span class="v">{t("shell.version", { version: label })}</span>
      {/* A space for the name read from the text (axe joins spans as is). */}
      {props.hasUpdate ? " " : null}
      {props.hasUpdate ? (
        <span class="upd">
          <Icon name="arrow-up" />
          {t("up.chip")}
        </span>
      ) : null}
      <Icon name="caret-down" />
    </>
  );
}

export function VersionMenu(props: { readonly compact?: boolean }) {
  const { state, t } = useUi();
  const [open, setOpen] = useState(false);
  const hasUpdate = state.data.setup?.coreUpdate?.hasUpdate === true;
  const wrap = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement | null>(null);
  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);
  useDismiss(open, close, wrap);
  useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);
  const version = state.data.setup?.core.version ?? "";
  if (!version) return null;
  return (
    <span class="sth-chipwrap" ref={wrap}>
      <button
        type="button"
        ref={trigger}
        class={`sth-ver${open ? " st-on" : ""}`}
        aria-expanded={open}
        aria-label={t(
          hasUpdate && props.compact ? "stp.chipUpdate" : "vm.chip",
          {
            version: versionLabel(version),
          },
        )}
        onClick={() => setOpen(!open)}
      >
        <ChipText
          version={version}
          hasUpdate={hasUpdate}
          compact={props.compact === true}
        />
      </button>
      {open ? <Menu first={first} close={() => close(true)} /> : null}
    </span>
  );
}
