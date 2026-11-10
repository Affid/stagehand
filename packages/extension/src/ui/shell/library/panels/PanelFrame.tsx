// A panel in the column beside the Library, as the prototype's sts-panel:
// a divider title, a close button, a scrolling body and an optional footer.
import type { ComponentChildren } from "preact";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";

export function PanelFrame(props: {
  readonly title: string;
  readonly label: string;
  readonly footer?: ComponentChildren;
  readonly children: ComponentChildren;
}) {
  const { t, store } = useUi();
  return (
    <aside class="application framed sts-panel st-app" aria-label={props.label}>
      <h2 class="divider">{props.title}</h2>
      <button
        type="button"
        class="icon sts-close"
        aria-label={t("mp.close")}
        title={t("mp.close")}
        onClick={() => store.set({ side: null })}
      >
        <Icon name="xmark" />
      </button>
      <div class="scroll">{props.children}</div>
      {props.footer ? <footer>{props.footer}</footer> : null}
    </aside>
  );
}
