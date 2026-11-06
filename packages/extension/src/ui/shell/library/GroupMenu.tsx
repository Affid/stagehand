// A Library group's menu (prototype lmenu): for a folder Rename, Colour…,
// Move up and down; for any group Select its modules, New preset from these,
// Turn on in a world…; for a folder Delete folder. Colour and the world
// list open as a second step in the same menu.
import type { Folder } from "@module-library/shared/library/schema";
import { useState } from "preact/hooks";
import { PALETTE, PALETTE_NAMES } from "../../actions.ts";
import { useDisclosure } from "../../common/disclosure.ts";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { orderedFolders } from "../../model/modules.ts";
import { worldOrder } from "../../model/order.ts";
import { useFolderOps } from "../../modules/folder-ops.ts";
import { useNewPreset } from "./panels/PresetsPanel.tsx";

type Step = "main" | "colour" | "world";

export interface GroupMenuProps {
  readonly name: string;
  readonly folder: Folder | undefined;
  readonly ids: readonly string[];
  readonly onRename: () => void;
  readonly onSelect: () => void;
}

function Item(props: {
  readonly icon: string;
  readonly label: string;
  readonly first?: ((el: HTMLButtonElement | null) => void) | undefined;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      ref={(el) => {
        props.first?.(el);
      }}
      disabled={props.disabled ?? false}
      onClick={props.onClick}
    >
      <Icon name={props.icon} />
      {props.label}
    </button>
  );
}

function Colours(props: {
  readonly folder: Folder;
  readonly done: () => void;
}) {
  const { t } = useUi();
  const ops = useFolderOps();
  return (
    <div class="ml-swatches" role="group" aria-label={t("folder.color")}>
      {PALETTE.map((c, i) => (
        <button
          key={c}
          type="button"
          class={`ml-swatch${c === props.folder.color ? " ml-on" : ""}`}
          style={{ background: c }}
          aria-label={t(`color.${PALETTE_NAMES[i] ?? "grey"}`)}
          aria-pressed={c === props.folder.color}
          onClick={() => {
            if (c !== props.folder.color)
              ops.update(props.folder, { color: c });
            props.done();
          }}
        />
      ))}
    </div>
  );
}

function Worlds(props: {
  readonly ids: readonly string[];
  readonly done: () => void;
}) {
  const { state, actions, t } = useUi();
  const worlds = worldOrder(
    state.data.setup?.worlds ?? [],
    state.data.setup?.lang,
  );
  return (
    <>
      {worlds.map((w) => {
        const tracked = w.id in state.data.snapshots;
        return (
          <Item
            key={w.id}
            icon="globe"
            label={tracked ? w.title : `${w.title} · ${t("lib.companionOff")}`}
            disabled={!tracked}
            onClick={() => {
              void actions.queueApply(w.id, "add", [], props.ids);
              props.done();
            }}
          />
        );
      })}
    </>
  );
}

/** A menu item's click: close the menu first, then act. */
const closing = (close: () => void) => (fn: () => void) => (): void => {
  close();
  fn();
};

function FolderItems(
  props: GroupMenuProps & {
    readonly close: () => void;
    readonly setStep: (s: Step) => void;
    readonly first: (el: HTMLButtonElement | null) => void;
  },
) {
  const { state, t } = useUi();
  const ops = useFolderOps();
  const folder = props.folder;
  if (!folder) return null;
  const order = orderedFolders(state.data.library).filter(
    (f) => f.parentId === null,
  );
  const at = order.findIndex((f) => f.id === folder.id);
  const then = closing(props.close);
  return (
    <>
      <Item
        icon="pen"
        label={t("folder.rename")}
        first={props.first}
        onClick={then(() => props.onRename())}
      />
      <Item
        icon="palette"
        label={t("folder.colorMenu")}
        onClick={() => props.setStep("colour")}
      />
      <Item
        icon="arrow-up"
        label={t("folder.moveUp")}
        disabled={at <= 0}
        onClick={then(() => ops.move(folder, at - 1))}
      />
      <Item
        icon="arrow-down"
        label={t("folder.moveDown")}
        disabled={at < 0 || at >= order.length - 1}
        onClick={then(() => ops.move(folder, at + 1))}
      />
    </>
  );
}

function Main(
  props: GroupMenuProps & {
    readonly close: () => void;
    readonly setStep: (s: Step) => void;
    readonly first: (el: HTMLButtonElement | null) => void;
  },
) {
  const { t } = useUi();
  const ops = useFolderOps();
  const newPreset = useNewPreset();
  const none = !props.ids.length;
  const then = closing(props.close);
  const folder = props.folder;
  return (
    <>
      <FolderItems {...props} />
      <Item
        icon="square-check"
        label={t("lib.g.select")}
        disabled={none}
        first={props.folder ? undefined : props.first}
        onClick={then(() => props.onSelect())}
      />
      <Item
        icon="layer-group"
        label={t("lib.g.preset")}
        disabled={none}
        onClick={then(() => newPreset(props.ids))}
      />
      <Item
        icon="globe"
        label={t("lib.g.world")}
        disabled={none}
        onClick={() => props.setStep("world")}
      />
      {folder ? (
        <Item
          icon="trash"
          label={t("folder.delete")}
          onClick={then(() => ops.remove(folder))}
        />
      ) : null}
    </>
  );
}

export function GroupMenu(props: GroupMenuProps) {
  const { t } = useUi();
  const d = useDisclosure<HTMLSpanElement>();
  const [step, setStep] = useState<Step>("main");
  const close = (): void => {
    d.close(true);
    setStep("main");
  };
  const first = (el: HTMLButtonElement | null): void => {
    d.first.current = el;
  };
  return (
    <span class="mlw-gmenu" ref={d.wrap} onFocusOut={d.onFocusOut}>
      <button
        type="button"
        ref={d.trigger}
        class="ml-hbtn"
        aria-label={t("lib.g.actions", { group: props.name })}
        title={t("lib.g.actions", { group: props.name })}
        aria-expanded={d.open}
        aria-haspopup="true"
        onClick={() => {
          setStep("main");
          d.setOpen(!d.open);
        }}
      >
        <Icon name="ellipsis-vertical" />
      </button>
      {d.open ? (
        <div class="mlh-menu" role="menu" aria-label={props.name}>
          {step === "colour" && props.folder ? (
            <Colours folder={props.folder} done={close} />
          ) : step === "world" ? (
            <Worlds ids={props.ids} done={close} />
          ) : (
            <Main {...props} close={close} setStep={setStep} first={first} />
          )}
        </div>
      ) : null}
    </span>
  );
}
