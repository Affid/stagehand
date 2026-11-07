// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/preact";
import { useState } from "preact/hooks";
import { afterEach, describe, expect, test } from "vitest";
import { TabList, TabPanel } from "../../src/ui/common/tabs.tsx";
import { renderUi } from "./harness.tsx";

afterEach(cleanup);

type K = "one" | "two" | "three";
const KEYS: readonly K[] = ["one", "two", "three"];

function Harness(props: { readonly start?: K }) {
  const [tab, setTab] = useState<K>(props.start ?? "one");
  return (
    <>
      <TabList
        id="ml-t"
        label="Sections"
        tabs={KEYS}
        current={tab}
        onTab={setTab}
        render={(k) => `Tab ${k}`}
      />
      <TabPanel id="ml-t" tab={tab}>
        <p>Panel {tab}</p>
      </TabPanel>
    </>
  );
}

describe("the ARIA tabs pattern (Phase 6)", () => {
  test("a labelled tablist; tabs point at the panel, the panel names its tab", () => {
    const { getByRole, getAllByRole } = render(<Harness />);
    expect(getByRole("tablist").getAttribute("aria-label")).toBe("Sections");
    const tabs = getAllByRole("tab");
    expect(tabs.map((x) => x.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
      "false",
    ]);
    const panel = getByRole("tabpanel");
    expect(tabs[0]?.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-labelledby")).toBe(tabs[0]?.id);
    expect(panel.textContent).toBe("Panel one");
  });

  test("only the selected tab is in the Tab order", () => {
    const { getAllByRole } = render(<Harness start="two" />);
    expect(getAllByRole("tab").map((x) => x.tabIndex)).toEqual([-1, 0, -1]);
  });

  test("arrow keys, Home and End move focus and select, wrapping around", () => {
    const { getAllByRole, getByRole } = render(<Harness />);
    const tabs = () => getAllByRole("tab");
    tabs()[0]?.focus();
    fireEvent.keyDown(tabs()[0]!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs()[1]);
    expect(getByRole("tabpanel").textContent).toBe("Panel two");
    fireEvent.keyDown(tabs()[1]!, { key: "End" });
    expect(document.activeElement).toBe(tabs()[2]);
    fireEvent.keyDown(tabs()[2]!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs()[0]);
    fireEvent.keyDown(tabs()[0]!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tabs()[2]);
    fireEvent.keyDown(tabs()[2]!, { key: "Home" });
    expect(document.activeElement).toBe(tabs()[0]);
    expect(getByRole("tabpanel").textContent).toBe("Panel one");
  });

  test("other keys are left alone; a click selects", () => {
    const { getAllByRole, getByRole } = render(<Harness />);
    const first = getAllByRole("tab")[0]!;
    const ev = new KeyboardEvent("keydown", { key: "a", cancelable: true });
    first.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    fireEvent.click(getAllByRole("tab")[2]!);
    expect(getByRole("tabpanel").textContent).toBe("Panel three");
  });

  test("the panel can be reached with Tab", () => {
    const { getByRole } = render(<Harness />);
    expect(getByRole("tabpanel").tabIndex).toBe(0);
  });
});

describe("every tab row on the Setup page uses the pattern", () => {
  const rows = (container: Element) =>
    [...container.querySelectorAll<HTMLElement>('[role="tablist"]')].map(
      (list) => {
        const selected = list.querySelector('[aria-selected="true"]');
        const panelId = selected?.getAttribute("aria-controls") ?? "";
        const panel = container.querySelector(`[id="${panelId}"]`);
        return {
          label: list.getAttribute("aria-label"),
          panel: panel?.getAttribute("role"),
          named: panel?.getAttribute("aria-labelledby") === selected?.id,
        };
      },
    );

  test("the world page and the Library", () => {
    const world = renderUi("shell", {
      state: { route: { kind: "world", worldId: "w1" } },
    });
    expect(rows(world.container)).toEqual([
      { label: "World sections", panel: "tabpanel", named: true },
    ]);
    cleanup();
    const lib = renderUi("shell", { state: { route: { kind: "library" } } });
    fireEvent.click(lib.getByRole("button", { name: "Title a" }));
    expect(rows(lib.container)).toEqual([
      { label: "Library sections", panel: "tabpanel", named: true },
      { label: "Details of Title a", panel: "tabpanel", named: true },
    ]);
  });
});
