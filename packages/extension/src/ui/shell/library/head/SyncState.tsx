// Library sync's state beside the toolbar's Import and export: a quiet icon
// while synced or syncing, words only when it failed. The reason is in the
// tooltip and read out by screen readers.
import { useUi } from "../../../context.ts";
import type { SyncStatus } from "../../../library-sync.ts";
import type { Translate } from "../../../i18n.ts";

const ICONS = {
  synced: "cloud",
  syncing: "rotate",
  failed: "triangle-exclamation",
} as const;

/** The tooltip: what is happening, and why it failed. */
export function syncLabel(t: Translate, status: SyncStatus): string {
  if (status.kind !== "failed") return t(`sync.${status.kind}`);
  const why = t(`sync.reason.${status.reason}`, { error: status.error ?? "" });
  return `${t("sync.failed")}: ${why}`;
}

export function SyncState() {
  const { state, t } = useUi();
  const status = state.librarySync;
  if (!status) return null;
  const label = syncLabel(t, status);
  const spin = status.kind === "syncing" ? " fa-spin" : "";
  return (
    <span
      class={`stl-sync ${status.kind}`}
      role="status"
      title={label}
      aria-label={label}
    >
      <i
        class={`fa-solid fa-${ICONS[status.kind]} fa-fw${spin}`}
        aria-hidden="true"
      />
      {status.kind === "failed" ? (
        <span class="stl-sync-text">{t("sync.failed")}</span>
      ) : null}
    </span>
  );
}
