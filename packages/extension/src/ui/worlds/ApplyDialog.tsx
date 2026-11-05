// Apply presets to a world (P-3 to P-6), in a Foundry window: choices on the
// left, and on the right what the world's next launch will change, including
// anything already queued for it.
import type { ApplyMode } from "@module-library/shared/resolver";
import { useMemo, useRef, useState } from "preact/hooks";
import { FoundryWindow } from "../common/FoundryWindow.tsx";
import { Icon } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { ago, plural } from "../i18n.ts";
import { type Preview, previewApply } from "../model/preview.ts";
import { age, worldStatus } from "../model/worlds.ts";
import { ModeCards, PresetPicker, Step, WorldPicker } from "./ApplyChoices.tsx";
import { PlanDiff, PlanSummary } from "./PlanView.tsx";

const SIZE = { width: 980, height: 780 } as const;

/** The dialog's choices and the preview they produce. */
function useApplyForm(initialWorld: string | null) {
  const { state } = useUi();
  const [worldId, setWorldId] = useState(initialWorld);
  const [presetIds, setPresetIds] = useState<readonly string[]>([]);
  const [mode, setMode] = useState<ApplyMode>("add");
  const [removeDependents, setRemoveDependents] = useState(false);
  const preview = useMemo(
    () =>
      worldId
        ? previewApply(state.data, {
            worldId,
            change: presetIds.length > 0 ? { presetIds, mode } : undefined,
            removeDependents,
          })
        : undefined,
    [state.data, worldId, presetIds, mode, removeDependents],
  );
  const toggle = (id: string): void => {
    setPresetIds(
      presetIds.includes(id)
        ? presetIds.filter((p) => p !== id)
        : [...presetIds, id],
    );
  };
  return {
    ...{ worldId, setWorldId, presetIds, toggle, mode, setMode },
    ...{ removeDependents, setRemoveDependents, preview },
  };
}

function Warnings(props: { readonly worldId: string }) {
  const { state, t } = useUi();
  const world = state.data.setup?.worlds.find((w) => w.id === props.worldId);
  const snapshot = state.data.snapshots[props.worldId];
  if (!world) return null;
  const text = !snapshot
    ? t("apply.noSnapshot")
    : worldStatus(world, snapshot, state.data) === "stale"
      ? t("apply.stale", { age: ago(t, age(snapshot.takenAt, Date.now())) })
      : undefined;
  if (!text) return null;
  return (
    <p class="ml-callout" role="note">
      <Icon name="clock-rotate-left" />
      <span>{text}</span>
    </p>
  );
}

function Result(props: {
  readonly worldId: string | null;
  readonly preview: Preview | undefined;
  readonly chosen: number;
}) {
  const { t } = useUi();
  const { worldId, preview } = props;
  const queued = preview?.queued ?? 0;
  const aside =
    queued > 0
      ? plural(t, "apply.queuedBefore", queued)
      : t("apply.queuedNone");
  const plan = preview?.plan;
  const orphaned = preview?.orphaned ?? 0;
  return (
    <section class="ml-apply-result" aria-live="polite">
      <Step n={3} title={t("apply.result")} aside={worldId ? aside : ""} />
      {worldId ? <Warnings worldId={worldId} /> : null}
      {orphaned > 0 ? (
        <p class="ml-callout" role="note">
          <Icon name="triangle-exclamation" />
          <span>{plural(t, "apply.orphaned", orphaned)}</span>
        </p>
      ) : null}
      {!worldId ? (
        <p class="ml-empty">{t("apply.pickWorldFirst")}</p>
      ) : props.chosen === 0 && !plan?.changed ? (
        <p class="ml-empty">{t("apply.pickPresets")}</p>
      ) : plan && !plan.changed && plan.missing.length === 0 ? (
        <p class="ml-empty">{t("apply.noChange")}</p>
      ) : plan ? (
        <>
          <PlanSummary plan={plan} />
          <PlanDiff plan={plan} />
        </>
      ) : null}
    </section>
  );
}

function Footer(props: {
  readonly canQueue: boolean;
  readonly onCancel: () => void;
  readonly onQueue: () => void;
}) {
  const { t } = useUi();
  return (
    <>
      <p class="ml-footer-note">
        <Icon name="circle-info" />
        {t("apply.footer")}
      </p>
      <button type="button" onClick={props.onCancel}>
        {t("apply.cancel")}
      </button>
      <button
        type="button"
        class="ml-primary ml-big"
        disabled={!props.canQueue}
        onClick={props.onQueue}
      >
        <Icon name="hourglass-half" />
        {t("apply.queue")}
      </button>
    </>
  );
}

function Choices(props: { readonly fixedWorld: boolean; readonly form: Form }) {
  const { form } = props;
  return (
    <div class="ml-apply-choices">
      {props.fixedWorld ? null : (
        <WorldPicker worldId={form.worldId} onPick={form.setWorldId} />
      )}
      <PresetPicker n={1} chosen={form.presetIds} onToggle={form.toggle} />
      <ModeCards
        n={2}
        mode={form.mode}
        onMode={form.setMode}
        removeDependents={form.removeDependents}
        onRemoveDependents={form.setRemoveDependents}
      />
    </div>
  );
}

type Form = ReturnType<typeof useApplyForm>;

/** Queues the form's change once, however often the button is clicked. */
function useQueue(form: Form, close: () => void) {
  const { state, actions, t } = useUi();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const queue = async (): Promise<void> => {
    const worldId = form.worldId;
    if (!worldId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const ok = await actions.queueApply(worldId, form.mode, form.presetIds);
    inFlight.current = false;
    setBusy(false);
    if (!ok) return;
    const world = state.data.setup?.worlds.find((w) => w.id === worldId);
    actions.notify(
      "info",
      t("apply.queued", { world: world?.title ?? worldId }),
    );
    close();
  };
  return { busy, queue };
}

export function ApplyDialog(props: { readonly worldId: string | null }) {
  const { state, store, t, canChange } = useUi();
  const form = useApplyForm(props.worldId);
  const world = state.data.setup?.worlds.find((w) => w.id === form.worldId);
  const close = (): void => {
    store.set({ apply: null });
  };
  const { busy, queue } = useQueue(form, close);
  const title = props.worldId
    ? t("apply.title", { world: world?.title ?? props.worldId })
    : t("apply.titleAny");
  const canQueue =
    canChange && !busy && form.worldId !== null && form.presetIds.length > 0;
  return (
    <FoundryWindow
      kind="apply"
      title={title}
      icon="fa-solid fa-layer-group"
      size={SIZE}
      onClose={close}
      footer={
        <Footer
          canQueue={canQueue}
          onCancel={close}
          onQueue={() => void queue()}
        />
      }
    >
      <div class="ml-apply-cols">
        <Choices fixedWorld={props.worldId !== null} form={form} />
        <Result
          worldId={form.worldId}
          preview={form.preview}
          chosen={form.presetIds.length}
        />
      </div>
    </FoundryWindow>
  );
}
