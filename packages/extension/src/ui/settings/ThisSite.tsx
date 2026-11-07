// The Foundry server the panel opened over: on already, or one click to use
// Module Library there (asks for that site, adds it, reloads the page).
import { useState } from "preact/hooks";
import type { ServerId } from "../../background/servers.ts";
import type { Translate } from "../i18n.ts";
import type { SettingsTab } from "./platform.ts";
import { serverLabel } from "./useServers.ts";

type Status = "idle" | "busy" | "added" | "refused" | "failed";

/** Adds the site, then reloads its page so the new scripts start. */
function useUse(
  add: () => Promise<boolean>,
  reload: () => Promise<void>,
): { status: Status; error: string; use: () => void } {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const use = (): void => {
    setStatus("busy");
    add()
      .then(async (added) => {
        if (!added) {
          setStatus("refused");
          return;
        }
        setStatus("added");
        await reload();
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("failed");
      });
  };
  return { status, error, use };
}

function Problem(props: { readonly text: string }) {
  return (
    <p class="mlp-err" role="alert">
      {props.text}
    </p>
  );
}

export function ThisSite(props: {
  readonly t: Translate;
  readonly server: ServerId;
  readonly tab: SettingsTab;
  /** Saved in this browser, though maybe off (scripts dropped). */
  readonly saved: boolean;
  readonly on: boolean;
  readonly add: (server: ServerId) => Promise<boolean>;
  readonly reload: (tabId: number) => Promise<void>;
}) {
  const { t } = props;
  const { status, error, use } = useUse(
    () => props.add(props.server),
    () => props.reload(props.tab.id),
  );
  const on = props.on || status === "added";
  return (
    <section class="mlp-site" aria-labelledby="mlp-site-h">
      <h2 id="mlp-site-h">{t("set.thisSite")}</h2>
      <p class="mlp-addr">{serverLabel(props.server)}</p>
      {on ? (
        <p class="mlp-ok" role="status">
          {status === "added" ? t("set.reloading") : t("set.on")}
        </p>
      ) : (
        <button
          type="button"
          class="mlp-primary"
          disabled={status === "busy"}
          onClick={use}
        >
          {props.saved ? t("set.again") : t("set.use")}
        </button>
      )}
      {status === "refused" ? <Problem text={t("set.refused")} /> : null}
      {status === "failed" ? <Problem text={error} /> : null}
    </section>
  );
}
