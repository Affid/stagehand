// Queued and finished changes, as the sheet lists them.
import { type Command, changeModules } from "@stagehand/shared/world";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { plural } from "../i18n.ts";
import { isOrphaned } from "../model/preview.ts";

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

/** Picked modules are named by title while there are only a few. */
const NAMED_PICKS = 3;

/** What a change applies: its presets' names and any picked modules. */
export function useChangeNames(): (c: Command) => string {
  const { state, t } = useUi();
  const { library, setup } = state.data;
  const title = (id: string): string =>
    setup?.modules.find((m) => m.id === id)?.title ?? id;
  return (c) => {
    const presets = c.payload.presetIds.map(
      (id) => library.presets.find((p) => p.id === id)?.name ?? id,
    );
    const picked = c.payload.modules ?? [];
    const picks =
      picked.length === 0
        ? []
        : picked.length <= NAMED_PICKS
          ? picked.map(title)
          : [plural(t, "sheet.picked", picked.length)];
    return [...presets, ...picks].join(", ");
  };
}

export function QueuedList(props: { readonly commands: readonly Command[] }) {
  const { state, actions, t, canChange } = useUi();
  const names = useChangeNames();
  return (
    <ol class="st-queue">
      {props.commands.map((c, i) => (
        <li key={c.id} data-command={c.id}>
          <span class="st-queue-mode">
            <Icon name={MODE_ICON[c.payload.mode]} />
            {t(`mode.${c.payload.mode}`)}
          </span>
          <span class="st-queue-what">
            {names(c)}
            <small>
              {plural(
                t,
                "sheet.modules",
                changeModules(state.data.library.presets, c.payload).length,
              )}{" "}
              · {t("sheet.queuedAt", { time: when(c.createdAt) })}
            </small>
            {isOrphaned(state.data, c) ? (
              <small class="st-warn-text">{t("sheet.orphaned")}</small>
            ) : null}
          </span>
          {canChange ? (
            <button
              type="button"
              class="st-small"
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
  const names = useChangeNames();
  return (
    <ul class="st-history">
      {[...props.commands].reverse().map((c) => {
        const status = c.status as keyof typeof HISTORY_ICON;
        return (
          <li key={c.id} class={`st-history-${status}`}>
            <Icon name={HISTORY_ICON[status]} />
            <span>
              <strong>{t(`sheet.history.${status}`)}</strong> ·{" "}
              {t(`mode.${c.payload.mode}`)} {names(c)}
              {c.error ? <span class="st-history-error">{c.error}</span> : null}
            </span>
            <time>{when(c.createdAt)}</time>
          </li>
        );
      })}
    </ul>
  );
}
