// Queued and finished changes, as the sheet lists them.
import type { Command } from "@module-library/shared/world";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { plural } from "../i18n.ts";
import { isOrphaned, presetModules } from "../model/preview.ts";

const MODE_ICON = { add: "plus", replace: "right-left", remove: "minus" };
const HISTORY_ICON = {
  applied: "circle-check",
  declined: "circle-minus",
  failed: "circle-xmark",
};

const when = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

export function usePresetNames(): (c: Command) => string {
  const { state } = useUi();
  return (c) =>
    c.payload.presetIds
      .map(
        (id) => state.data.library.presets.find((p) => p.id === id)?.name ?? id,
      )
      .join(", ");
}

export function QueuedList(props: { readonly commands: readonly Command[] }) {
  const { state, actions, t, canChange } = useUi();
  const names = usePresetNames();
  return (
    <ol class="ml-queue">
      {props.commands.map((c, i) => (
        <li key={c.id} data-command={c.id}>
          <span class="ml-queue-mode">
            <Icon name={MODE_ICON[c.payload.mode]} />
            {t(`mode.${c.payload.mode}`)}
          </span>
          <span class="ml-queue-what">
            {names(c)}
            <small>
              {plural(
                t,
                "sheet.modules",
                presetModules(state.data, c.payload.presetIds).length,
              )}{" "}
              · {t("sheet.queuedAt", { time: when(c.createdAt) })}
            </small>
            {isOrphaned(state.data, c) ? (
              <small class="ml-warn-text">{t("sheet.orphaned")}</small>
            ) : null}
          </span>
          {canChange ? (
            <button
              type="button"
              class="ml-small"
              aria-label={t("sheet.cancelFor", { n: i + 1 })}
              onClick={() => void actions.cancelCommand(c.id)}
            >
              <Icon name="xmark" />
              {t("sheet.cancel")}
            </button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function HistoryList(props: { readonly commands: readonly Command[] }) {
  const { t } = useUi();
  const names = usePresetNames();
  return (
    <ul class="ml-history">
      {[...props.commands].reverse().map((c) => {
        const status = c.status as keyof typeof HISTORY_ICON;
        return (
          <li key={c.id} class={`ml-history-${status}`}>
            <Icon name={HISTORY_ICON[status]} />
            <span>
              <strong>{t(`sheet.history.${status}`)}</strong> ·{" "}
              {t(`mode.${c.payload.mode}`)} {names(c)}
              {c.error ? <span class="ml-history-error">{c.error}</span> : null}
            </span>
            <time>{when(c.createdAt)}</time>
          </li>
        );
      })}
    </ul>
  );
}
