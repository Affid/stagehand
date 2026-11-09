// What server.check found at the typed address.
import type { Translate } from "../i18n.ts";
import { Check as CheckIcon, Warn } from "./icons.tsx";
import type { Check } from "./useCheck.ts";

export function CheckLine(props: {
  readonly t: Translate;
  readonly check: Check;
}) {
  const { t, check } = props;
  if (check.kind === "idle") return null;
  if (check.kind === "checking")
    return (
      <p class="mlh-check mlh-wait" role="status">
        {t("home.checking", { server: check.server })}
      </p>
    );
  if (check.kind === "ok")
    return (
      <p class="mlh-check" role="status">
        <CheckIcon />
        {t("home.answers", { version: check.version, server: check.server })}
      </p>
    );
  const https = check.server.startsWith("https:");
  return (
    <p class="mlh-check mlh-warn" role="status">
      <Warn />
      {https
        ? t("home.noAnswerHttps")
        : t("home.noAnswer", { server: check.server, error: check.error })}
    </p>
  );
}
