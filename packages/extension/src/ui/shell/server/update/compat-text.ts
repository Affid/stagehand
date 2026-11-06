// How a row of Your packages reads (prototype _update.js ST_INFO, compatWhy):
// its status and icon, and one line on why, in Foundry's own terms.
import type { Translate } from "../../../i18n.ts";
import { plural } from "../../../i18n.ts";
import type { CompatRow, Status } from "./compat.ts";

export const STATUS_ICON: Readonly<Record<Status, string>> = {
  ok: "circle-check",
  unv: "circle-question",
  risk: "triangle-exclamation",
  bad: "circle-xmark",
  dep: "link-slash",
};

export const statusLabel = (t: Translate, s: Status): string => t(`up.st.${s}`);

function worldWhy(t: Translate, x: CompatRow): string {
  const verified = x.sys?.verified ?? "?";
  const sys = t(`up.why.sys.${x.status}`, { verified });
  const mine = x.mine?.length ?? 0;
  const off = x.off?.length ?? 0;
  const mods = x.unknown
    ? t("up.why.modsUnknown")
    : off
      ? t("up.why.modsOff", { off, n: mine })
      : plural(t, "up.why.modsAll", mine);
  return `${sys} · ${mods}`;
}

/** "Latest version was last verified for 14.369; likely still fine · update it to 2.1.0". */
export function why(t: Translate, x: CompatRow, version: string): string {
  if (x.kind === "world") return worldWhy(t, x);
  if (x.status === "dep")
    return t("up.why.dep", { dep: x.dep ?? "?", version });
  const line = t(`up.why.${x.status}`, {
    version,
    verified: x.verified ?? "?",
  });
  const max =
    x.status === "bad" && x.maximum
      ? ` ${t("up.why.max", { max: x.maximum })}`
      : "";
  const update =
    x.needsUpdate && x.status !== "bad" && x.latest
      ? ` · ${t("up.why.update", { latest: x.latest })}`
      : "";
  return `${line}${max}${update}`;
}
