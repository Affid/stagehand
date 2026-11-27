// One package on the Updates tab (updates plan): from and to, Foundry's
// verified badge, where it is used, its Changelog; for a package that can't
// be updated, why, and what the owner can do about it, as a button in the
// row's right-hand column, where its progress shows during a run.
import type { Block, Row } from "@stagehand/shared/updates/model";
import { safeUrl } from "@stagehand/ui/common/safe-url.ts";
import { plural, type Translate } from "@stagehand/ui/i18n.ts";
import type { ComponentChildren } from "preact";
import { useUi } from "../../../context.ts";
import { worldsUsing } from "../../../model/systems.ts";
import { checkOne } from "../../../package-check.ts";
import { useCheckDeps, useInstallDeps } from "./useCheckDeps.ts";
import { askOrStart } from "../../../package-install.ts";

export interface RowProps {
  readonly row: Row;
  /** Worlds a module is on in (from the worlds' snapshots). */
  readonly usage: number | undefined;
  /** What a row shows in its right-hand column instead of its own action. */
  readonly side?: ComponentChildren;
  /** The row's tick, when it can be updated (phase 3). */
  readonly tick?: ComponentChildren;
  readonly children?: ComponentChildren;
}

function Badge(props: { readonly row: Row }) {
  const { state, t } = useUi();
  const { row } = props;
  const core = state.data.setup?.core.version ?? "";
  if (!row.to || (row.section !== "ready" && row.section !== "attention"))
    return null;
  const a = row.check.availability;
  if (a === 2 || a === 4)
    return (
      <span class="sts-badge warn" title={t("upd.unverifiedHint")}>
        <i class="fa-solid fa-code-branch" aria-hidden="true" />
        {t("upd.unverified", { version: core })}
      </span>
    );
  return (
    <span class="sts-badge ok">
      <i class="fa-solid fa-code-branch" aria-hidden="true" />
      {t("upd.verified", {
        version: row.check.compatibility?.verified ?? core,
      })}
    </span>
  );
}

function whyText(
  t: Translate,
  block: Block,
  core: string,
  title: (id: string) => string,
  tries = 0,
): string {
  switch (block.kind) {
    case "core":
      return t("upd.why.core", { version: block.minimum ?? "?", have: core });
    case "missing":
      return t("upd.why.missing", { title: title(block.id) });
    case "denied":
      return t("upd.why.denied", { code: String(block.errorCode ?? 403) });
    case "notOwned":
      return t("upd.why.notOwned");
    case "refused":
      return t("upd.why.refused");
    case "error":
      if (tries > 1) return t("upd.why.again", { n: String(tries) });
      if (block.errorCode === 404) return t("upd.why.gone");
      if (!block.error || /time(d)? ?out/i.test(block.error))
        return t("upd.why.timeout");
      return t("upd.why.error", { error: block.error });
  }
}

export function Why(props: { readonly row: Row; readonly block: Block }) {
  const { state, store, t } = useUi();
  const setup = state.data.setup;
  const title = (id: string): string =>
    setup?.modules.find((m) => m.id === id)?.title ?? id;
  const icon =
    props.row.section === "error"
      ? "circle-exclamation"
      : props.row.section === "noaccess"
        ? "lock"
        : "ban";
  return (
    <div class={`spu-why ${props.row.section}`}>
      <i class={`fa-solid fa-${icon}`} aria-hidden="true" />
      <span>
        {whyText(
          t,
          props.block,
          setup?.core.version ?? "",
          title,
          state.check.tries?.[props.row.id] ?? 0,
        )}
        {props.block.kind === "core" ? (
          <>
            {" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                store.set({ route: { kind: "server", page: "update" } });
              }}
            >
              {t("upd.why.coreLink")}
            </a>
          </>
        ) : null}
      </span>
    </div>
  );
}

/** The row's own action for its reason, or that it is being checked. */
interface Act {
  readonly icon: string;
  readonly label: string;
  readonly hint: string;
  readonly run: () => void;
}

/** What the owner can do about a row's reason, if anything. */
function useAct(row: Row): Act | null {
  const { page, actions } = useUi();
  const deps = useCheckDeps();
  const install = useInstallDeps();
  const again = (): void => {
    checkOne(deps, row.type, row.id);
  };
  switch (row.block?.kind) {
    case "missing":
      return {
        icon: "download",
        label: "upd.act.install",
        hint: "upd.act.installHint",
        run: () => {
          page.foundryAction({
            action: "installPackage",
            packageType: "module",
          });
        },
      };
    case "denied":
    case "notOwned":
      return {
        icon: "rotate",
        label: "upd.act.checkAgain",
        hint: "upd.act.checkAgainHint",
        run: again,
      };
    case "refused":
      return {
        icon: "cloud-arrow-down",
        label: "upd.act.tryAgain",
        hint: "upd.act.tryInstallHint",
        // Renewed: the refusal is forgotten, then it installs (asking first if it may break something).
        run: () => {
          void actions.markRefused(row.id, null).then(() => {
            askOrStart(install, [row.id]);
          });
        },
      };
    case "error":
      return {
        icon: "rotate",
        label: "upd.act.tryAgain",
        hint: "upd.act.tryAgainHint",
        run: again,
      };
    default:
      return null;
  }
}

export function RowAction(props: { readonly row: Row }) {
  const { state, t, canChange } = useUi();
  const act = useAct(props.row);
  if (Object.values(state.check.one).includes(props.row.id))
    return (
      <span class="spu-st">
        <i class="fa-solid fa-spinner fa-spin fa-fw" aria-hidden="true" />
        {t("upd.act.checking")}
      </span>
    );
  if (!act) return null;
  return (
    <button
      type="button"
      class="spu-act"
      title={t(act.hint)}
      disabled={!canChange}
      onClick={act.run}
    >
      <i class={`fa-solid fa-${act.icon} fa-fw`} aria-hidden="true" />
      {t(act.label)}
    </button>
  );
}

function WorldsLine(props: {
  readonly row: Row;
  readonly usage: number | undefined;
}) {
  const { state, t } = useUi();
  const { row } = props;
  if (row.type === "system") {
    const n = worldsUsing(state.data.setup?.worlds ?? [], row.id).length;
    return <>{n ? plural(t, "upd.usedBy", n) : t("upd.worlds.none")}</>;
  }
  return (
    <>
      {props.usage
        ? plural(t, "upd.worlds.on", props.usage)
        : t("upd.worlds.none")}
    </>
  );
}

/** The name (opens the package's panel), from and to, and Foundry's badge. */
function RowTitle(props: { readonly row: Row }) {
  const { store } = useUi();
  const { row } = props;
  const open = (): void => {
    store.set(
      row.type === "system"
        ? { side: { kind: "system", id: row.id }, panel: null }
        : { panel: row.id, side: null },
    );
  };
  return (
    <div class="l1">
      <button type="button" class="t" onClick={open}>
        {row.title}
      </button>
      <span class="spu-ver">
        {row.from}
        {row.to ? (
          <>
            <i class="fa-solid fa-arrow-right" aria-hidden="true" />
            <b>{row.to}</b>
          </>
        ) : null}
      </span>
      <Badge row={row} />
    </div>
  );
}

export function UpdateRow(props: RowProps) {
  const { state, t } = useUi();
  const { row } = props;
  const setup = state.data.setup;
  const pkg = [...(setup?.modules ?? []), ...(setup?.systems ?? [])].find(
    (p) => p.id === row.id,
  );
  const changelog = row.to ? safeUrl(pkg?.changelog) : undefined;
  return (
    <li class={`spu-row${row.block ? " muted" : ""}`} data-id={row.id}>
      {props.tick ?? <span />}
      <i
        class={`fa-solid fa-${row.type === "system" ? "dice" : "plug"} spu-kind`}
        title={t(row.type === "system" ? "upd.system" : "upd.module")}
        aria-hidden="true"
      />
      <div class="spu-main">
        <RowTitle row={row} />
        <div class="l2">
          <WorldsLine row={row} usage={props.usage} />
          {changelog ? (
            <>
              {" · "}
              <a href={changelog} target="_blank" rel="noopener noreferrer">
                {t("upd.changelog")}
              </a>
            </>
          ) : null}
        </div>
        {props.children}
        {row.block ? <Why row={row} block={row.block} /> : null}
      </div>
      <div class="spu-side">{props.side ?? <RowAction row={row} />}</div>
    </li>
  );
}
