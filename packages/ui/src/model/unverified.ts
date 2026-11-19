// "Not verified for Foundry 14": the running generation, when it is known.
import type { Translate } from "../i18n.ts";

export function unverifiedText(
  t: Translate,
  generation: number | undefined,
): string {
  return generation
    ? t("wp.why.unverified", { version: String(generation) })
    : t("wp.why.unverifiedAny");
}
