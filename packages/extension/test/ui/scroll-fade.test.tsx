// @vitest-environment happy-dom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/preact";
import { useRef } from "preact/hooks";
import { afterEach, describe, expect, test } from "vitest";
import { useScrollFade } from "../../src/ui/common/scroll-fade.ts";

afterEach(cleanup);

function List(props: { readonly axis: "y" | "x" }) {
  const ref = useRef<HTMLDivElement>(null);
  const more = useScrollFade(ref, props.axis);
  return <div ref={ref} data-testid="l" class={more ? "more" : ""} />;
}

/** happy-dom lays nothing out: give the box its sizes by hand. */
function sized(el: HTMLElement, s: Record<string, number>): void {
  for (const [k, v] of Object.entries(s))
    Object.defineProperty(el, k, { configurable: true, value: v });
}

describe("a list cut off where more is hidden fades (Phase 6)", () => {
  test("down: fades while more is below, not at the end", () => {
    const { getByTestId } = render(<List axis="y" />);
    const l = getByTestId("l");
    sized(l, { scrollHeight: 900, clientHeight: 300, scrollTop: 0 });
    fireEvent.scroll(l);
    expect(l.className).toBe("more");
    sized(l, { scrollTop: 600 });
    fireEvent.scroll(l);
    expect(l.className).toBe("");
  });

  test("sideways: fades while more is to the right", () => {
    const { getByTestId } = render(<List axis="x" />);
    const l = getByTestId("l");
    sized(l, { scrollWidth: 3000, clientWidth: 1000, scrollLeft: 0 });
    fireEvent.scroll(l);
    expect(l.className).toBe("more");
    sized(l, { scrollLeft: 2000 });
    fireEvent.scroll(l);
    expect(l.className).toBe("");
  });

  test("nothing hidden: no fade", () => {
    const { getByTestId } = render(<List axis="y" />);
    const l = getByTestId("l");
    sized(l, { scrollHeight: 300, clientHeight: 300, scrollTop: 0 });
    fireEvent.scroll(l);
    expect(l.className).toBe("");
  });
});

describe("the fade follows changes without a scroll (review)", () => {
  test("new content re-checks; unmounting stops listening", async () => {
    const { getByTestId, unmount } = render(<List axis="y" />);
    const l = getByTestId("l");
    sized(l, { scrollHeight: 900, clientHeight: 300, scrollTop: 0 });
    l.append(document.createElement("span"));
    await waitFor(() => expect(l.className).toBe("more"));
    unmount();
    // No listener left: a scroll after unmounting changes nothing, and throws nothing.
    expect(() => fireEvent.scroll(l)).not.toThrow();
  });
});
