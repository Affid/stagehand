// A server page's heading, as the prototype: the name in Foundry's display
// face, one line under it that sums up the page, and the page's actions.
import type { ComponentChildren } from "preact";

export function PageHead(props: {
  readonly title: string;
  readonly summary?: ComponentChildren;
  readonly children?: ComponentChildren;
}) {
  return (
    <div class="mlb-head">
      <div>
        <h2>{props.title}</h2>
        {props.summary ? <p>{props.summary}</p> : null}
      </div>
      <span class="ml-spacer" />
      {props.children}
    </div>
  );
}
