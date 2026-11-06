// "Add to a world…" / "Turn on in a world…": every world in Foundry's
// order; worlds without the companion are listed but off.
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { worldOrder } from "../../../model/order.ts";
import { PopMenu } from "../common/PopMenu.tsx";

export function WorldPick(props: {
  readonly label: string;
  readonly title: string;
  readonly note: string;
  readonly bright?: boolean;
  readonly disabled?: boolean;
  readonly onPick: (worldId: string) => void;
}) {
  const { state, t, canChange } = useUi();
  const worlds = worldOrder(
    state.data.setup?.worlds ?? [],
    state.data.setup?.lang,
  );
  const items = worlds.map((w) => {
    const tracked = w.id in state.data.snapshots;
    return {
      key: w.id,
      label: w.title,
      icon: <Icon name="globe" />,
      extra: tracked ? "" : t("lib.companionOff"),
      disabled: !tracked,
      onPick: () => props.onPick(w.id),
    };
  });
  return (
    <PopMenu
      label={props.label}
      icon="globe"
      title={props.title}
      items={items}
      note={props.note}
      bright={props.bright ?? false}
      disabled={!canChange || (props.disabled ?? false)}
    />
  );
}
