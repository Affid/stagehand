// Release history as one switch: foundryvtt.com allowed for the Update
// page's release notes, or not.
import type { Translate } from "../i18n.ts";
import type { SettingsPlatform } from "../settings/platform.ts";
import { useAccess } from "../settings/ReleaseAccess.tsx";
import { History } from "./icons.tsx";

export function ReleaseSwitch(props: {
  readonly t: Translate;
  readonly platform: SettingsPlatform;
}) {
  const { t } = props;
  const a = useAccess(props.platform);
  return (
    <div class="mlh-card">
      <div class="mlh-row">
        <span class="mlh-row-icon">
          <History />
        </span>
        <span class="mlh-row-text">
          <b id="mlh-release">{t("home.release")}</b>
          <span>{t("home.releaseText")}</span>
          {a.error ? (
            <span class="mlh-err" role="alert">
              {a.error}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          class="mlh-switch"
          role="switch"
          aria-checked={a.granted === true}
          aria-labelledby="mlh-release"
          disabled={a.granted === null}
          onClick={a.granted ? a.remove : a.allow}
        />
      </div>
    </div>
  );
}
