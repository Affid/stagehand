// A world column's menu (prototype gcolmenu): Open world, Copy this set to…
// (a world, then match it or add only, as the world page's Add does), and
// Discard its changes.
import type { WorldInfo } from "@stagehand/shared/world";
import { MAX_PICKED } from "@stagehand/shared/world";
import { useRef, useState } from "preact/hooks";
import { useDisclosure, useFocusFirst } from "../../../common/disclosure.ts";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { worldOrder } from "../../../model/order.ts";
import { pendingFor } from "../../../model/preview.ts";
import { nextSet } from "../../../model/world-modules.ts";

type Step =
  | { readonly kind: "main" }
  | { readonly kind: "to" }
  | { readonly kind: "mode"; readonly to: WorldInfo };

function Btn(props: {
  readonly icon: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled ?? false}
      onClick={props.onClick}
    >
      <Icon name={props.icon} />
      {props.label}
    </button>
  );
}

/** The modules on in a world after its next launch, the companion left out. */
function useSet(world: WorldInfo): readonly string[] {
  const { state } = useUi();
  return nextSet(state.data, world.id);
}

function Targets(props: {
  readonly from: WorldInfo;
  readonly onTo: (w: WorldInfo) => void;
}) {
  const { state } = useUi();
  const worlds = worldOrder(
    state.data.setup?.worlds ?? [],
    state.data.setup?.lang,
  ).filter((w) => w.id !== props.from.id && w.id in state.data.snapshots);
  return (
    <>
      {worlds.map((w) => (
        <Btn
          key={w.id}
          icon="globe"
          label={w.title}
          onClick={() => props.onTo(w)}
        />
      ))}
    </>
  );
}

function ModeStep(props: {
  readonly from: WorldInfo;
  readonly to: WorldInfo;
  readonly close: () => void;
}) {
  const { actions, t } = useUi();
  const set = useSet(props.from);
  const copy = (mode: "replace" | "add"): void => {
    props.close();
    void actions.queueApply(props.to.id, mode, [], set);
  };
  const world = props.from.title;
  return (
    <>
      <Btn
        icon="equals"
        label={t("wp.add.match", { world })}
        onClick={() => copy("replace")}
      />
      <Btn
        icon="plus"
        label={t("wp.add.addAll", { world })}
        onClick={() => copy("add")}
      />
    </>
  );
}

function MainStep(props: {
  readonly world: WorldInfo;
  readonly setStep: (s: Step) => void;
  readonly close: () => void;
}) {
  const { state, store, actions, t } = useUi();
  const { world } = props;
  const set = useSet(world);
  const queued = pendingFor(state.data, world.id).length;
  const run = (fn: () => void) => () => {
    props.close();
    fn();
  };
  return (
    <>
      <Btn
        icon="globe"
        label={t("grid.m.open")}
        onClick={run(() =>
          store.set({ route: { kind: "world", worldId: world.id } }),
        )}
      />
      <Btn
        icon="copy"
        label={t("grid.m.copy")}
        disabled={!set.length || set.length > MAX_PICKED}
        onClick={() => props.setStep({ kind: "to" })}
      />
      <Btn
        icon="trash"
        label={t("grid.m.discard")}
        disabled={!queued}
        onClick={run(() => void actions.discard(world.id))}
      />
    </>
  );
}

function Body(props: {
  readonly world: WorldInfo;
  readonly step: Step;
  readonly setStep: (s: Step) => void;
  readonly close: () => void;
}) {
  const { step } = props;
  if (step.kind === "to")
    return (
      <Targets
        from={props.world}
        onTo={(to) => props.setStep({ kind: "mode", to })}
      />
    );
  if (step.kind === "mode")
    return <ModeStep from={props.world} to={step.to} close={props.close} />;
  return (
    <MainStep world={props.world} setStep={props.setStep} close={props.close} />
  );
}

export function ColumnMenu(props: { readonly world: WorldInfo }) {
  const { t } = useUi();
  const d = useDisclosure<HTMLSpanElement>();
  const [step, setStep] = useState<Step>({ kind: "main" });
  const menu = useRef<HTMLDivElement>(null);
  useFocusFirst(menu, d.open, step);
  const close = (): void => {
    d.close(true);
    setStep({ kind: "main" });
  };
  return (
    <span class="stw-gmenu" ref={d.wrap} onFocusOut={d.onFocusOut}>
      <button
        type="button"
        ref={d.trigger}
        class="st-hbtn"
        aria-label={t("grid.m.actions", { world: props.world.title })}
        title={t("grid.m.actions", { world: props.world.title })}
        aria-expanded={d.open}
        aria-haspopup="true"
        onClick={() => {
          setStep({ kind: "main" });
          d.setOpen(!d.open);
        }}
      >
        <Icon name="ellipsis-vertical" />
      </button>
      {d.open ? (
        <div
          class="sth-menu"
          role="group"
          aria-label={props.world.title}
          ref={menu}
        >
          <Body
            world={props.world}
            step={step}
            setStep={setStep}
            close={close}
          />
        </div>
      ) : null}
    </span>
  );
}
