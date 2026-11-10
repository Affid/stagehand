// "On this server": Foundry's own favourite and lock for the module, and
// its own dialogs to edit the manifest, update, back up or uninstall it.
import type { PackageInfo } from "@stagehand/shared/package";
import type { FoundryAction } from "../../../page-protocol.ts";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";

type PackageAction = Extract<FoundryAction, { id: string }>["action"];

export type Kind = "module" | "system";

function useRun(pkg: PackageInfo, kind: Kind) {
  const { page } = useUi();
  return (action: PackageAction): void => {
    page.foundryAction({ action, packageType: kind, id: pkg.id });
  };
}

function Switch(props: {
  readonly label: string;
  readonly hint: string;
  readonly on: boolean;
  readonly disabled: boolean;
  readonly onFlip: () => void;
}) {
  return (
    <li>
      <span>
        {props.label}
        <br />
        <span class="st-muted sts-hint">{props.hint}</span>
      </span>
      <span />
      <input
        type="checkbox"
        role="switch"
        class="sts-switch"
        checked={props.on}
        disabled={props.disabled}
        aria-label={props.label}
        onClick={(e) => {
          e.preventDefault();
          props.onFlip();
        }}
      />
    </li>
  );
}

function Acts(props: { readonly pkg: PackageInfo; readonly kind: Kind }) {
  const { t, canChange } = useUi();
  const run = useRun(props.pkg, props.kind);
  const btn = (action: PackageAction, icon: string, label: string) => (
    <button type="button" disabled={!canChange} onClick={() => run(action)}>
      <Icon name={icon} />
      {t(label)}
    </button>
  );
  return (
    <div class="sts-foundry-acts">
      {props.pkg.locked || props.kind === "system"
        ? null
        : btn("editPackage", "pen-to-square", "pk.edit")}
      {props.pkg.locked
        ? null
        : btn("updatePackage", "rotate", "pk.checkUpdate")}
      {btn("backupPackage", "floppy-disk", "pk.backup")}
      {btn("uninstallPackage", "trash", "pk.uninstall")}
    </div>
  );
}

export function OnServer(props: {
  readonly pkg: PackageInfo;
  readonly kind: Kind;
}) {
  const { state, t, canChange } = useUi();
  const { pkg } = props;
  const run = useRun(pkg, props.kind);
  const a = state.adapter;
  const canLock =
    canChange &&
    a.status !== "safe-mode" &&
    a.adapter.flags.lockPackage === true;
  return (
    <div class="sts-chg">
      <h4>
        <span>{t("pk.onServer")}</span>
      </h4>
      <ul class="sts-wlist">
        <Switch
          label={t("pk.favourite")}
          hint={t("pk.favouriteHint")}
          on={pkg.favorite === true}
          disabled={!canChange}
          onFlip={() => run("favoritePackage")}
        />
        <Switch
          label={t("pk.lock")}
          hint={t("pk.lockHint")}
          on={pkg.locked === true}
          disabled={!canLock}
          onFlip={() => run(pkg.locked ? "unlockPackage" : "lockPackage")}
        />
      </ul>
      <Acts pkg={pkg} kind={props.kind} />
    </div>
  );
}
