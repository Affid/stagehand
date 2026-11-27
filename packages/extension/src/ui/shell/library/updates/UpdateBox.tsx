// A package's Update box at the top of its panel's Package tab (updates
// plan, phase 3), in place of Foundry's "Update if available": whether it
// was checked and when, what is available and Update to it, why it can't be
// updated, or its progress while it installs. The card's update chip opens
// it, so nothing installs from a card at once.
import type { PackageInfo } from "@stagehand/shared/package";
import type { Row } from "@stagehand/shared/updates/model";
import type { PackageKind } from "@stagehand/ui/context.ts";
import { safeUrl } from "@stagehand/ui/common/safe-url.ts";
import { ago } from "@stagehand/ui/i18n.ts";
import type { ComponentChildren } from "preact";
import { useUi } from "../../../context.ts";
import { checksOf, rowsFor } from "../../../model/package-updates.ts";
import { age } from "../../../model/worlds.ts";
import { checkOne } from "../../../package-check.ts";
import { setBackup, startInstall } from "../../../package-install.ts";
import { InstallingState, RunState } from "./RunParts.tsx";
import { installOf } from "../../../tasks.ts";
import { RowAction, Why } from "./UpdateRow.tsx";
import { useCheckDeps, useInstallDeps } from "./useCheckDeps.ts";

function Box(props: {
  readonly when?: number;
  readonly children: ComponentChildren;
}) {
  const { t } = useUi();
  return (
    <div class="spu-box">
      <h4>
        <span>{t("upd.box.title")}</span>
        {props.when === undefined ? null : (
          <span class="st-muted">
            {t("upd.box.checked", {
              when: ago(t, age(new Date(props.when).toISOString(), Date.now())),
            })}
          </span>
        )}
      </h4>
      {props.children}
    </div>
  );
}

function NotOffered(props: {
  readonly pkg: PackageInfo;
  readonly kind: PackageKind;
  readonly checked: boolean;
  readonly updatedTo?: string;
}) {
  const { t, canChange } = useUi();
  const deps = useCheckDeps();
  const text = props.updatedTo
    ? t("upd.box.updated", { version: props.updatedTo })
    : t(props.checked ? "upd.box.upToDate" : "upd.box.never");
  return (
    <div class="spu-boxacts">
      <p class={props.checked ? "spu-uptodate" : ""}>
        {props.checked ? (
          <i class="fa-solid fa-circle-check" aria-hidden="true" />
        ) : null}{" "}
        {text}
      </p>
      <button
        type="button"
        class="spu-act"
        disabled={!canChange}
        onClick={() => {
          checkOne(deps, props.kind, props.pkg.id);
        }}
      >
        <i class="fa-solid fa-rotate fa-fw" aria-hidden="true" />
        {t(props.checked ? "upd.act.checkAgain" : "upd.box.checkOne")}
      </button>
    </div>
  );
}

/** The box while something happens to the package (locked, installing, checked), or null. */
function Busy(props: { readonly pkg: PackageInfo }) {
  const { state, t } = useUi();
  const { pkg } = props;
  if (pkg.locked) return <p>{t("upd.box.locked")}</p>;
  if (state.install.running?.states[pkg.id]) return <RunState id={pkg.id} />;
  // Foundry's own install of it (its installer, or an update outside ours).
  if (installOf(state, pkg.id)) return <InstallingState id={pkg.id} />;
  if (Object.values(state.check.one).includes(pkg.id))
    return (
      <p>
        <i class="fa-solid fa-spinner fa-spin" aria-hidden="true" />{" "}
        {t("upd.box.checking")}
      </p>
    );
  return null;
}

const isBusy = (
  state: ReturnType<typeof useUi>["state"],
  pkg: PackageInfo,
): boolean =>
  pkg.locked === true ||
  state.install.running?.states[pkg.id] !== undefined ||
  installOf(state, pkg.id) !== undefined ||
  Object.values(state.check.one).includes(pkg.id);

/** What is available, Back up first, and Update to it. */
function Offered(props: { readonly pkg: PackageInfo; readonly row: Row }) {
  const { state, store, t, canChange } = useUi();
  const install = useInstallDeps();
  const { pkg, row } = props;
  const changelog = safeUrl(pkg.changelog);
  return (
    <>
      <p>
        {t("upd.box.available", { to: row.to ?? "", from: row.from })}
        {changelog ? (
          <>
            {" · "}
            <a href={changelog} target="_blank" rel="noopener noreferrer">
              {t("upd.changelog")}
            </a>
          </>
        ) : null}
      </p>
      <div class="spu-boxacts">
        <label class="spu-bfirst" title={t("upd.backupHint")}>
          <input
            type="checkbox"
            checked={state.install.backup}
            onChange={(e) => {
              setBackup(store, e.currentTarget.checked);
            }}
          />
          {t("upd.backupFirst")}
        </label>
        <button
          type="button"
          class="bright"
          disabled={!canChange || state.install.running !== null}
          onClick={() => {
            startInstall(install, [pkg.id]);
          }}
        >
          <i class="fa-solid fa-cloud-arrow-down" aria-hidden="true" />
          {t("upd.box.updateTo", { version: row.to ?? "" })}
        </button>
      </div>
    </>
  );
}

export function UpdateBox(props: {
  readonly pkg: PackageInfo;
  readonly kind: PackageKind;
}) {
  const { state } = useUi();
  const { pkg } = props;
  if (isBusy(state, pkg))
    return (
      <Box>
        <Busy pkg={pkg} />
      </Box>
    );
  const result = checksOf(state)[pkg.id];
  const at = result === undefined ? {} : { when: result.checkedAt };
  const row = rowsFor(state).find((r) => r.id === pkg.id);
  const updatedTo = state.install.last?.ok.find((u) => u.id === pkg.id)?.to;
  if (!row)
    return (
      <Box {...at}>
        <NotOffered
          pkg={pkg}
          kind={props.kind}
          checked={result !== undefined}
          {...(updatedTo ? { updatedTo } : {})}
        />
      </Box>
    );
  if (row.block)
    return (
      <Box {...at}>
        <Why row={row} block={row.block} />
        <div class="spu-boxacts end">
          <RowAction row={row} />
        </div>
      </Box>
    );
  return (
    <Box {...at}>
      <Offered pkg={pkg} row={row} />
    </Box>
  );
}
