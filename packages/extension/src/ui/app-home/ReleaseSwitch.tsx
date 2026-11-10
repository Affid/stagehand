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
    <div class="sth-card">
      <div class="sth-row">
        <span class="sth-row-icon">
          <History />
        </span>
        <span class="sth-row-text">
          <b id="sth-release">{t("home.release")}</b>
          <span>{t("home.releaseText")}</span>
          {a.error ? (
            <span class="sth-err" role="alert">
              {a.error}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          class="sth-switch"
          role="switch"
          aria-checked={a.granted === true}
          aria-labelledby="sth-release"
          disabled={a.granted === null}
          onClick={a.granted ? a.remove : a.allow}
        />
      </div>
    </div>
  );
}
