// How the About tab reads Foundry's world data (prototype _calm.js).
import type { Translate } from "../../../i18n.ts";

const HOUR = 3600;

/** "61 hours", from Foundry's seconds; under an hour reads "less than an hour". */
export function playedFor(t: Translate, seconds: number | undefined): string {
  if (seconds === undefined) return t("about.unknown");
  const hours = Math.round(seconds / HOUR);
  if (hours < 1) return t("about.underHour");
  return t(hours === 1 ? "about.hours.one" : "about.hours.other", {
    n: String(hours),
  });
}

/** "Foundry 14 · checked with build 369", from the verified version. */
export function madeFor(t: Translate, verified: string | undefined): string {
  if (!verified) return t("about.unknown");
  const [generation, build] = verified.split(".");
  return build
    ? t("about.madeForBuild", { generation: generation ?? "", build })
    : t("about.madeForGen", { generation: generation ?? "" });
}

/** The world was last saved by an older Foundry generation: it migrates. */
export function isOlder(coreVersion: string, generation: number): boolean {
  const g = Number(coreVersion.split(".")[0]);
  return Number.isFinite(g) && g > 0 && g < generation;
}
