// "Foundry has stopped": where Foundry stops at once and sends the browser
// nowhere (Foundry 13's quit, compat/quirks.ts), our page says so instead of
// Foundry's quit page. Over everything, as the launching screen is.
import { useEffect, useRef } from "preact/hooks";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";

export function StoppedScreen() {
  const { state, t } = useUi();
  const box = useRef<HTMLDivElement>(null);
  const stopped = state.serverStopped === true;
  useEffect(() => {
    if (stopped) box.current?.focus();
  }, [stopped]);
  if (!stopped) return null;
  return (
    <div class="stl-launch">
      <div
        class="stl-box sts-stopped"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sts-stopped-title"
        tabIndex={-1}
        ref={box}
      >
        <h2 id="sts-stopped-title">
          <Icon name="power-off" />
          {t("stopped.title")}
        </h2>
        <ul class="stc-how">
          <li>
            <Icon name="rotate" />
            <span>{t("cfg.stop.service")}</span>
          </li>
          <li>
            <Icon name="terminal" />
            <span>{t("cfg.stop.hand")}</span>
          </li>
        </ul>
        <button
          type="button"
          onClick={() => {
            window.location.reload();
          }}
        >
          <Icon name="arrows-rotate" />
          {t("stopped.reload")}
        </button>
      </div>
    </div>
  );
}
