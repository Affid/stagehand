// The optional permission to read foundryvtt.com, for the Update page's
// Release history (background/releases.ts).
import { useEffect, useState } from "preact/hooks";
import { FOUNDRY_ORIGIN } from "../../background/releases.ts";
import type { Translate } from "../i18n.ts";
import type { SettingsPlatform } from "./platform.ts";

/** Whether foundryvtt.com is allowed, and changing it. */
export function useAccess(platform: SettingsPlatform) {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const check = async (): Promise<void> => {
    setGranted(await platform.permissions.contains(FOUNDRY_ORIGIN));
  };
  useEffect(() => {
    void check();
  }, [platform]);
  const run = (work: Promise<boolean>): void => {
    work.then(check).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
    });
  };
  return {
    granted,
    error,
    allow: () => {
      run(platform.permissions.request(FOUNDRY_ORIGIN));
    },
    remove: () => {
      run(platform.permissions.remove(FOUNDRY_ORIGIN));
    },
  };
}

export function ReleaseAccess(props: {
  readonly t: Translate;
  readonly platform: SettingsPlatform;
}) {
  const { t } = props;
  const a = useAccess(props.platform);
  return (
    <section aria-labelledby="mlp-release-h">
      <h2 id="mlp-release-h">{t("set.release")}</h2>
      <p class="mlp-muted">{t("set.releaseText")}</p>
      {a.granted === false ? (
        <button type="button" onClick={a.allow}>
          {t("set.allow")}
        </button>
      ) : null}
      {a.granted ? (
        <p class="mlp-row">
          <span class="mlp-ok">{t("set.allowed")}</span>
          <button type="button" class="mlp-quiet" onClick={a.remove}>
            {t("set.removePerm")}
          </button>
        </p>
      ) : null}
      {a.error ? (
        <p class="mlp-err" role="alert">
          {a.error}
        </p>
      ) : null}
    </section>
  );
}
