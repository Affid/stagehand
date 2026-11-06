// The Library's notices (safe mode, untested build, not verified) and folder counts.
import { useUi } from "../context.ts";

export function Banners() {
  const { state, t } = useUi();
  const version = state.data.setup?.core.version ?? "";
  if (state.adapter.status === "safe-mode")
    return <p class="ml-banner ml-warn">{t("notice.safeMode", { version })}</p>;
  if (state.adapter.status === "untested-build")
    return <p class="ml-banner">{t("notice.untestedBuild", { version })}</p>;
  if (!state.data.adminVerified)
    return <p class="ml-banner ml-warn">{t("notice.notVerified")}</p>;
  return null;
}

export function folderCounts(state: ReturnType<typeof useUi>["state"]) {
  const counts: Record<string, number> = {};
  const known = new Set(state.data.library.folders.map((f) => f.id));
  let unfiled = 0;
  for (const m of state.data.setup?.modules ?? []) {
    const f = state.data.library.modules[m.id]?.folderId ?? null;
    if (f !== null && known.has(f)) counts[f] = (counts[f] ?? 0) + 1;
    else unfiled++;
  }
  return { counts, unfiled };
}
