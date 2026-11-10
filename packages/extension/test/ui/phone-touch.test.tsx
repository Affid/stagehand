// @vitest-environment happy-dom
// Touch in the phone and tablet layouts (Android plan, phase 3, package 2):
// tooltips by tap or long press, sheets, and the scrim behind menus.
import { cleanup, fireEvent, render } from "@testing-library/preact";
import { useRef } from "preact/hooks";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  SCRIM_LINGER_MS,
  usePopupOpen,
} from "../../src/ui/shell/phone/popups.ts";
import { DRAG_CLOSE_PX, Sheet } from "../../src/ui/shell/phone/Sheet.tsx";
import {
  LONG_PRESS_MS,
  showsOnTap,
  TIP_MAX_CHARS,
  tipAt,
  TipBubble,
  tipTarget,
  underFinger,
  useTouchTips,
} from "../../src/ui/shell/phone/TouchTip.tsx";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** The element, or a failing test. */
function must<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error("missing element");
  return v;
}

const html = (markup: string): HTMLElement => {
  const box = document.createElement("div");
  box.innerHTML = markup;
  document.body.append(box);
  return box;
};

describe("which explanation a touch shows", () => {
  test("the nearest element with a title, if it says something", () => {
    const box = html(
      '<span title="Queued for the next launch"><b>2</b></span><i title="  "></i>',
    );
    const b = box.querySelector("b");
    expect(b && tipTarget(b)?.title).toBe("Queued for the next launch");
    const blank = box.querySelector("i");
    expect(blank && tipTarget(blank)).toBeNull();
    box.remove();
  });

  test("a tap shows it on things that only explain, or wrap a disabled control", () => {
    const box = html(
      '<i id="a" title="x"></i><button id="b" title="y"></button><span id="c" title="z"><button disabled></button></span><a id="d" href="#" title="w">l</a>',
    );
    const at = (id: string) => box.querySelector<HTMLElement>(`#${id}`);
    expect(showsOnTap(must(at("a")))).toBe(true);
    expect(showsOnTap(must(at("b")))).toBe(false);
    expect(showsOnTap(must(at("c")))).toBe(true);
    expect(showsOnTap(must(at("d")))).toBe(false);
    box.remove();
  });

  test("an explained icon inside the control the finger was moved to", () => {
    const box = html(
      '<button><i title="Not tracked"></i><span>row</span></button>',
    );
    const button = must(box.querySelector("button"));
    const icon = must(box.querySelector("i"));
    vi.spyOn(icon, "getBoundingClientRect").mockReturnValue(
      new DOMRect(100, 50, 10, 10),
    );
    expect(underFinger(button, 104, 54)).toBe(icon);
    expect(underFinger(button, 300, 54)).toBe(button);
    box.remove();
  });

  test("the tip sits above what it explains, or below near the top", () => {
    const box = html('<i title=" Why "></i>');
    const icon = must(box.querySelector("i"));
    vi.spyOn(icon, "getBoundingClientRect").mockReturnValue(
      new DOMRect(100, 600, 20, 10),
    );
    expect(tipAt(icon, 900)).toEqual({
      text: "Why",
      x: 110,
      y: 592,
      above: true,
    });
    vi.spyOn(icon, "getBoundingClientRect").mockReturnValue(
      new DOMRect(100, 50, 20, 10),
    );
    expect(tipAt(icon, 900)).toMatchObject({ y: 68, above: false });
    box.remove();
  });
});

function Probe() {
  const root = useRef<HTMLDivElement>(null);
  const tip = useTouchTips(root);
  return (
    <div ref={root}>
      <i class="flag" title="Not tracked" />
      <button type="button" class="act" title="Edit World" onClick={clicked}>
        Edit
      </button>
      <TipBubble tip={tip} />
    </div>
  );
}

const clicked = vi.fn();
const touch = (el: Element, type: string): void => {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      pointerType: "touch",
      clientX: 0,
      clientY: 0,
    }),
  );
};

describe("useTouchTips", () => {
  test("a tap on an explanation shows it; the next touch hides it", async () => {
    const r = render(<Probe />);
    const flag = must(r.container.querySelector(".flag"));
    touch(flag, "pointerdown");
    touch(flag, "pointerup");
    await vi.waitFor(() => {
      expect(r.container.querySelector(".stp-tip")?.textContent).toBe(
        "Not tracked",
      );
    });
    expect(r.getByRole("tooltip")).toBeTruthy();
    touch(flag, "pointerdown");
    await vi.waitFor(() => {
      expect(r.container.querySelector(".stp-tip")).toBeNull();
    });
  });

  test("a tap on a button acts and shows nothing", async () => {
    clicked.mockClear();
    const r = render(<Probe />);
    const button = must(r.container.querySelector(".act"));
    touch(button, "pointerdown");
    touch(button, "pointerup");
    fireEvent.click(button);
    expect(clicked).toHaveBeenCalledTimes(1);
    await new Promise((res) => setTimeout(res, 10));
    expect(r.container.querySelector(".stp-tip")).toBeNull();
  });

  test("a long press on a button shows its tip, and its click doesn't act", async () => {
    clicked.mockClear();
    const r = render(<Probe />);
    const button = must(r.container.querySelector(".act"));
    touch(button, "pointerdown");
    await new Promise((res) => setTimeout(res, LONG_PRESS_MS + 50));
    touch(button, "pointerup");
    const menu = new Event("contextmenu", { bubbles: true, cancelable: true });
    button.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    fireEvent.click(button);
    expect(clicked).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(r.container.querySelector(".stp-tip")?.textContent).toBe(
        "Edit World",
      );
    });
  });

  test("a finger that moves is scrolling: no tip; a mouse never gets one", async () => {
    const r = render(<Probe />);
    const button = must(r.container.querySelector(".act"));
    touch(button, "pointerdown");
    button.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerType: "touch",
        clientX: 0,
        clientY: 40,
      }),
    );
    await new Promise((res) => setTimeout(res, LONG_PRESS_MS + 50));
    const flag = must(r.container.querySelector(".flag"));
    flag.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" }),
    );
    flag.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerType: "mouse" }),
    );
    await new Promise((res) => setTimeout(res, 10));
    expect(r.container.querySelector(".stp-tip")).toBeNull();
  });

  test("a tip goes by itself after a few seconds", async () => {
    vi.useFakeTimers();
    const r = render(<Probe />);
    const flag = must(r.container.querySelector(".flag"));
    touch(flag, "pointerdown");
    touch(flag, "pointerup");
    await vi.advanceTimersByTimeAsync(100);
    expect(r.container.querySelector(".stp-tip")).not.toBeNull();
    await vi.advanceTimersByTimeAsync(4100);
    expect(r.container.querySelector(".stp-tip")).toBeNull();
  });
});

describe("Sheet", () => {
  const panel = (
    <aside class="sts-panel" aria-label="Stagehand Fixture">
      <h2 class="divider">Module</h2>
      <button type="button">Inside</button>
    </aside>
  );

  test("is a named dialog that takes focus and gives it back", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const r = render(
      <Sheet layout="phone" onClose={() => undefined}>
        {panel}
      </Sheet>,
    );
    const dialog = r.getByRole("dialog");
    await vi.waitFor(() => {
      expect(dialog.getAttribute("aria-label")).toBe("Stagehand Fixture");
    });
    expect(document.activeElement).toBe(dialog);
    r.unmount();
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(opener);
    });
    opener.remove();
  });

  test("a tap outside closes it", () => {
    const onClose = vi.fn();
    const r = render(
      <Sheet layout="phone" onClose={onClose}>
        {panel}
      </Sheet>,
    );
    fireEvent.click(must(r.container.querySelector(".stp-scrim")));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  const drag = (el: Element, type: string, y: number): void => {
    el.dispatchEvent(
      new PointerEvent(type, { bubbles: true, pointerId: 1, clientY: y }),
    );
  };

  test("dragged down far enough by its top it closes; a short drag springs back", () => {
    const onClose = vi.fn();
    const r = render(
      <Sheet layout="phone" onClose={onClose}>
        {panel}
      </Sheet>,
    );
    const sheet = r.getByRole("dialog");
    sheet.setPointerCapture = () => undefined;
    const top = must(r.container.querySelector("h2"));
    drag(top, "pointerdown", 100);
    drag(top, "pointermove", 150);
    expect(sheet.style.transform).toBe("translateY(50px)");
    drag(top, "pointerup", 150);
    expect(sheet.style.transform).toBe("");
    expect(onClose).not.toHaveBeenCalled();
    drag(top, "pointerdown", 100);
    drag(top, "pointerup", 100 + DRAG_CLOSE_PX + 1);
    expect(onClose).toHaveBeenCalledTimes(1);
    // Not from a button, nor anywhere below the bar.
    drag(r.getByRole("button", { name: "Inside" }), "pointerdown", 100);
    drag(top, "pointerup", 400);
    drag(top, "pointercancel", 0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a tablet's sheet has no handle and doesn't drag", () => {
    const onClose = vi.fn();
    const r = render(
      <Sheet layout="tablet" onClose={onClose}>
        {panel}
      </Sheet>,
    );
    expect(r.container.querySelector(".stp-grab")).toBeNull();
    const top = must(r.container.querySelector("h2"));
    drag(top, "pointerdown", 100);
    drag(top, "pointerup", 400);
    expect(onClose).not.toHaveBeenCalled();
  });
});

function Popups(props: { readonly open: boolean; readonly inSheet: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const open = usePopupOpen(root, ".stp-sheet");
  const pop = props.open ? <section class="st-pop">Menu</section> : null;
  return (
    <div ref={root}>
      <span data-open={String(open)} />
      {props.inSheet ? <div class="stp-sheet">{pop}</div> : pop}
    </div>
  );
}

describe("usePopupOpen", () => {
  test("follows menus opening and closing, but not inside a sheet", async () => {
    const r = render(<Popups open={false} inSheet={false} />);
    const flag = () => r.container.querySelector("span")?.dataset.open;
    expect(flag()).toBe("false");
    r.rerender(<Popups open inSheet={false} />);
    await vi.waitFor(() => {
      expect(flag()).toBe("true");
    });
    r.rerender(<Popups open inSheet />);
    await vi.waitFor(() => {
      expect(flag()).toBe("false");
    });
  });
});

describe("security review fixes", () => {
  test("the scrim outlives the menu, so the closing tap lands on it", async () => {
    vi.useFakeTimers();
    const r = render(<Popups open inSheet={false} />);
    const flag = () => r.container.querySelector("span")?.dataset.open;
    expect(flag()).toBe("true");
    r.rerender(<Popups open={false} inSheet={false} />);
    await vi.advanceTimersByTimeAsync(SCRIM_LINGER_MS - 100);
    expect(flag()).toBe("true");
    await vi.advanceTimersByTimeAsync(200);
    expect(flag()).toBe("false");
  });

  test("a long title is cut short", () => {
    const box = html("<i></i>");
    const icon = must(box.querySelector("i"));
    icon.title = "x".repeat(TIP_MAX_CHARS + 50);
    const tip = tipAt(icon, 900);
    expect(tip.text).toHaveLength(TIP_MAX_CHARS);
    expect(tip.text.endsWith("…")).toBe(true);
    box.remove();
  });

  test("a long press cut short by the browser doesn't swallow a later click", async () => {
    clicked.mockClear();
    const r = render(<Probe />);
    const button = must(r.container.querySelector(".act"));
    touch(button, "pointerdown");
    await new Promise((res) => setTimeout(res, LONG_PRESS_MS + 50));
    touch(button, "pointercancel");
    fireEvent.click(button);
    expect(clicked).toHaveBeenCalledTimes(1);
  });
});

describe("code review fixes", () => {
  test("a tap outside the sheet while its menu is open only closes the menu", async () => {
    const onClose = vi.fn();
    const r = render(
      <Sheet layout="phone" onClose={onClose}>
        <aside class="sts-panel" aria-label="Tags">
          <section class="st-pop">Menu</section>
        </aside>
      </Sheet>,
    );
    await vi.waitFor(() => {
      expect(
        r.container.querySelector(".stp-sheet > .stp-scrim.pop"),
      ).not.toBeNull();
    });
    fireEvent.click(must(r.container.querySelector(":scope > .stp-scrim")));
    expect(onClose).not.toHaveBeenCalled();
  });

  test("a hidden titled icon (no box) isn't taken for the one under the finger", () => {
    const box = html('<button><i title="Hidden"></i></button>');
    const button = must(box.querySelector("button"));
    vi.spyOn(
      must(box.querySelector("i")),
      "getBoundingClientRect",
    ).mockReturnValue(new DOMRect(0, 0, 0, 0));
    expect(underFinger(button, 2, 2)).toBe(button);
    box.remove();
  });
});
