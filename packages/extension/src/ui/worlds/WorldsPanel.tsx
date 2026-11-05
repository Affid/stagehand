// Worlds view on the Game Worlds tab (W-1, W-2): last snapshot, status,
// pending changes with cancel (P-5), and "Apply presets…".
import type { Command } from "@module-library/shared/world";
import { Notices } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { age, type WorldRow, worldRows } from "../model/worlds.ts";
import { Banners } from "../modules/ModulesView.tsx";

const COMPANION = "module-library";

function CommandLine(props: { readonly command: Command }) {
  const { state, actions, t, canChange } = useUi();
  const { command } = props;
  const names = command.payload.presetIds
    .map(
      (id) => state.data.library.presets.find((p) => p.id === id)?.name ?? id,
    )
    .join(", ");
  return (
    <li class={`ml-command ml-${command.status}`} data-command={command.id}>
      <span>
        {t("worlds.command", { mode: command.payload.mode, presets: names })}
      </span>
      {command.status === "pending" ? (
        canChange ? (
          <button
            type="button"
            class="ml-link"
            onClick={() => void actions.cancelCommand(command.id)}
          >
            {t("worlds.cancel")}
          </button>
        ) : null
      ) : (
        <span class="ml-badge">
          {t(`worlds.commandStatus.${command.status}`)}
        </span>
      )}
      {command.error ? <span class="ml-warn-text">{command.error}</span> : null}
    </li>
  );
}

function WorldHead(props: { readonly row: WorldRow }) {
  const { t } = useUi();
  const { world, snapshot, status, pending } = props.row;
  const when = snapshot ? age(snapshot.takenAt, Date.now()) : undefined;
  return (
    <>
      <div class="ml-world-head">
        <strong>{world.title}</strong>
        <span class="ml-id">
          {world.system} · {world.coreVersion}
        </span>
        {snapshot && when ? (
          <span class="ml-meta">
            {t("worlds.activeCount", { n: snapshot.active.length })} ·{" "}
            {t("worlds.snapshotAge", {
              n: when.n,
              unit: t(`worlds.${when.unit}`),
            })}
          </span>
        ) : null}
      </div>
      <div class="ml-world-status">
        <span class="ml-badge">{t(`worlds.status.${status}`)}</span>
        {pending.length > 0 ? (
          <span class="ml-badge ml-pending">
            {t("worlds.pending", { n: pending.length })}
          </span>
        ) : null}
      </div>
    </>
  );
}

function WorldActions(props: { readonly row: WorldRow }) {
  const { store, t } = useUi();
  const { world, snapshot } = props.row;
  const fromWorld = (): void => {
    const active = (snapshot?.active ?? [])
      .map((m) => m.id)
      .filter((id) => id !== COMPANION);
    store.set({ editingPreset: "new", draftModules: active });
  };
  return (
    <div class="ml-world-actions">
      <button
        type="button"
        class="ml-primary"
        onClick={() => store.set({ applyWorld: world.id })}
      >
        {t("worlds.apply")}
      </button>
      {snapshot ? (
        <button type="button" class="ml-link" onClick={fromWorld}>
          {t("preset.fromWorld", { title: world.title })}
        </button>
      ) : null}
    </div>
  );
}

function WorldItem(props: { readonly row: WorldRow }) {
  const { canChange } = useUi();
  const { world, status, pending, recent } = props.row;
  return (
    <li class={`ml-world ml-status-${status}`} data-world={world.id}>
      <WorldHead row={props.row} />
      {pending.length + recent.length > 0 ? (
        <ul class="ml-commands">
          {[...pending, ...recent].map((c) => (
            <CommandLine key={c.id} command={c} />
          ))}
        </ul>
      ) : null}
      {canChange ? <WorldActions row={props.row} /> : null}
    </li>
  );
}

export function WorldsPanel() {
  const { state, t } = useUi();
  const rows = worldRows(state.data);
  return (
    <details class="ml-app ml-worlds" open>
      <summary>{t("worlds.title")}</summary>
      <Banners />
      <Notices />
      {rows.length === 0 ? <p>{t("worlds.none")}</p> : null}
      <ul class="ml-world-list">
        {rows.map((r) => (
          <WorldItem key={r.world.id} row={r} />
        ))}
      </ul>
    </details>
  );
}
