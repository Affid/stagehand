// The Library's notices (safe mode, untested build, not verified).
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
