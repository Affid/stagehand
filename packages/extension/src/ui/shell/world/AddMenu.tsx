// "Add ▾" on the world page: queue a preset, or copy another world's
// modules (match it, or add only). Everything waits for the next launch.
import { useCallback, useId, useRef, useState } from "preact/hooks";
import { MAX_PICKED } from "@module-library/shared/world";
import { useDismiss } from "../../common/dismiss.ts";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { plural } from "../../i18n.ts";
import { COMPANION_ID } from "../../model/preview.ts";

interface Source {
  readonly id: string;
  readonly title: string;
  readonly modules: readonly string[];
}

function useSources(worldId: string): Source[] {
  const { state } = useUi();
  return (state.data.setup?.worlds ?? []).flatMap((w) => {
    const snap = state.data.snapshots[w.id];
    if (w.id === worldId || !snap) return [];
    const modules = snap.active
      .map((m) => m.id)
      .filter((id) => id !== COMPANION_ID);
    return [{ id: w.id, title: w.title, modules }];
  });
}

function CopyStep(props: {
  readonly source: Source;
  readonly onPick: (mode: "replace" | "add") => void;
  readonly onBack: () => void;
}) {
  const { t } = useUi();
  const world = props.source.title;
  // An empty set can't be queued, and one change holds at most MAX_PICKED.
  const n = props.source.modules.length;
  const tooMany = n > MAX_PICKED;
  const none = n === 0 || tooMany;
  const id = useId();
  return (
    <div class="mlw-addstep">
      <button
        type="button"
        disabled={none}
        aria-label={t("wp.add.match", { world })}
        aria-describedby={`${id}-m`}
        onClick={() => props.onPick("replace")}
      >
        <strong>{t("wp.add.match", { world })}</strong>
        <span id={`${id}-m`}>{t("wp.add.matchHint")}</span>
      </button>
      <button
        type="button"
        disabled={none}
        aria-label={t("wp.add.addAll", { world })}
        aria-describedby={`${id}-a`}
        onClick={() => props.onPick("add")}
      >
        <strong>{t("wp.add.addAll", { world })}</strong>
        <span id={`${id}-a`}>{t("wp.add.addAllHint")}</span>
      </button>
      {tooMany ? (
        <p class="ml-hint">
          {t("wp.add.tooMany", { max: MAX_PICKED, world, n })}
        </p>
      ) : null}
      <button type="button" class="ml-link" onClick={props.onBack}>
        {t("wp.add.back")}
      </button>
    </div>
  );
}

function Choices(props: {
  readonly worldId: string;
  readonly onPickSource: (s: Source) => void;
  readonly onPreset: (id: string) => void;
}) {
  const { state, t } = useUi();
  const sources = useSources(props.worldId);
  const { presets } = state.data.library;
  return (
    <>
      <h4>{t("wp.add.presets")}</h4>
      {presets.length === 0 ? (
        <p class="ml-empty">{t("wp.add.noPresets")}</p>
      ) : null}
      {presets.map((p) => (
        <button
          type="button"
          key={p.id}
          aria-label={t("wp.add.preset", { name: p.name })}
          onClick={() => props.onPreset(p.id)}
        >
          <Icon name="layer-group" />
          {p.name}
        </button>
      ))}
      <h4>{t("wp.add.copy")}</h4>
      {sources.length === 0 ? (
        <p class="ml-empty">{t("wp.add.noWorlds")}</p>
      ) : null}
      {sources.map((s) => (
        <button
          type="button"
          key={s.id}
          aria-label={t("wp.add.copyFrom", { world: s.title })}
          onClick={() => props.onPickSource(s)}
        >
          <Icon name="copy" />
          <span>{s.title}</span>
          <span class="n">{plural(t, "wp.add.count", s.modules.length)}</span>
        </button>
      ))}
    </>
  );
}

/** The menu's open state and its second step; closing resets both. */
function useMenu() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    setSource(null);
    if (refocus) trigger.current?.focus();
  }, []);
  useDismiss(open, close, wrap);
  return { open, setOpen, source, setSource, wrap, trigger, close };
}

export function AddMenu(props: { readonly worldId: string }) {
  const { actions, t } = useUi();
  const { open, setOpen, source, setSource, wrap, trigger, close } = useMenu();
  const queue = (
    mode: "add" | "replace",
    presets: string[],
    mods: readonly string[],
  ) => {
    close(true);
    void actions.queueApply(props.worldId, mode, presets, mods);
  };
  return (
    <div class="mlw-add" ref={wrap}>
      <button
        type="button"
        ref={trigger}
        aria-expanded={open}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <Icon name="plus" />
        {t("wp.add")}
        <i class="fa-solid fa-caret-down" aria-hidden="true" />
      </button>
      {open ? (
        <div class="mlw-addmenu">
          {source ? (
            <CopyStep
              source={source}
              onPick={(mode) => queue(mode, [], source.modules)}
              onBack={() => setSource(null)}
            />
          ) : (
            <Choices
              worldId={props.worldId}
              onPickSource={setSource}
              onPreset={(id) => queue("add", [id], [])}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
