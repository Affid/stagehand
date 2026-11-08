// @vitest-environment happy-dom
// The phone and tablet layouts' frame (Android plan, phase 3): the worlds
// list as home, the tab bar, Back and Escape, the dock, Foundry's notice.
import type { WorldInfo } from "@module-library/shared/world";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useDismiss } from "../../src/ui/common/popover.ts";
import { pressBack } from "../../src/ui/shell/phone/back.ts";
import { DockContext, Docked } from "../../src/ui/shell/phone/Dock.tsx";
import { el, renderUi, setupState } from "./harness.tsx";

const world = (id: string, over: Partial<WorldInfo> = {}): WorldInfo => ({
  id,
  title: `World ${id}`,
  system: "dnd5e",
  systemVersion: "5",
  coreVersion: "14.370",
  ...over,
});

const base = setupState();
const withWorlds = {
  setup: base.setup
    ? { ...base.setup, worlds: [world("w1"), world("w2")] }
    : undefined,
  fresh: ["a", "b"],
};

/** happy-dom's own controls on its window. */
const happy = () =>
  (
    window as unknown as {
      happyDOM: { setViewport(v: { width: number; height: number }): void };
    }
  ).happyDOM;

function viewport(width: number, height: number, coarse = false): void {
  happy().setViewport({ width, height });
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: coarse && query === "(pointer: coarse)",
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

const phone = (over: Parameters<typeof renderUi>[1] = {}) =>
  renderUi("shell", { data: withWorlds, ...over });

const root = (c: Element) => el(c, ".mls-shell");
const tab = (c: Element, name: RegExp) =>
  within(el(c, ".mlp-tabs")).getByRole("button", { name });
const escape = (): boolean =>
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", cancelable: true }),
  );

beforeEach(() => {
  viewport(412, 915);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  happy().setViewport({ width: 1024, height: 768 });
});

describe("which layout", () => {
  test("a mouse window narrower than 700 px is a phone", () => {
    const { container } = phone();
    expect(root(container).classList.contains("mlp")).toBe(true);
    expect(container.querySelector("header.mlh")).toBeNull();
  });

  test("a touch screen on its side is a tablet; rotating switches", async () => {
    viewport(1024, 768, true);
    const { container } = phone();
    expect(root(container).classList.contains("mlp-wide")).toBe(true);
    viewport(768, 1024, true);
    window.dispatchEvent(new Event("resize"));
    await waitFor(() => {
      expect(root(container).classList.contains("mlp-wide")).toBe(false);
    });
    viewport(1366, 768);
    window.dispatchEvent(new Event("resize"));
    await waitFor(() => {
      expect(container.querySelector("header.mlh")).not.toBeNull();
    });
    expect(container.querySelector(".mlp")).toBeNull();
  });

  test("Foundry's window-size notice is asked away while the layout is on", () => {
    const { page, unmount } = phone();
    expect(page.setCompact.mock.calls).toEqual([[true]]);
    void act(() => {
      unmount();
    });
    expect(page.setCompact.mock.calls).toEqual([[true], [false]]);
  });
});

describe("review fixes", () => {
  test("the layout stays while a text field has focus (Android's keyboard)", async () => {
    viewport(1024, 800, true);
    const { container } = phone();
    const field = el(container, ".mls-railbar input");
    field.focus();
    viewport(1024, 450, true);
    window.dispatchEvent(new Event("resize"));
    await new Promise((r) => setTimeout(r, 20));
    expect(root(container).classList.contains("mlp-wide")).toBe(true);
    field.blur();
    await waitFor(() => {
      expect(root(container).classList.contains("mlp-wide")).toBe(false);
    });
  });

  test("coming into the phone layout starts a fresh trail at the page shown", async () => {
    viewport(1366, 768);
    const { container, store, queryByRole } = phone({
      state: {
        route: { kind: "library" },
        phone: {
          home: false,
          trail: [],
          at: { kind: "world", worldId: "w1" },
        },
      },
    });
    viewport(412, 915);
    window.dispatchEvent(new Event("resize"));
    await waitFor(() => {
      expect(container.querySelector(".mlp")).not.toBeNull();
    });
    await waitFor(() => {
      expect(store.get().phone.at).toEqual({ kind: "library" });
    });
    expect(store.get().phone.trail).toEqual([]);
    await waitFor(() => {
      expect(queryByRole("button", { name: "Back" })).toBeNull();
    });
  });

  test("after Back, focus goes to the list's heading", async () => {
    const { container, getByRole } = phone();
    fireEvent.click(el(container, '.mls-world[data-world="w1"]'));
    const back = getByRole("button", { name: "Back" });
    back.focus();
    fireEvent.click(back);
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("Foundry VTT");
    });
  });
});

describe("the phone's home and pages", () => {
  test("opens on the worlds list with Foundry's name, the version and ⏻", () => {
    const { container, getByRole } = phone();
    expect(root(container).dataset.screen).toBe("home");
    expect(getByRole("heading", { name: "Foundry VTT" })).toBeTruthy();
    expect(el(container, ".mlh-ver").textContent).toBe("14 · 369");
    expect(getByRole("button", { name: "Log out or shut down" })).toBeTruthy();
    expect(tab(container, /^Worlds/).getAttribute("aria-current")).toBe("page");
  });

  test("a world opens its page with Back; Back returns to the list", () => {
    const { container, getByRole, queryByRole } = phone();
    fireEvent.click(el(container, '.mls-world[data-world="w2"]'));
    expect(root(container).dataset.screen).toBe("page");
    expect(root(container).dataset.page).toBe("world");
    expect(getByRole("heading", { name: "World w2", level: 1 })).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Back" }));
    expect(root(container).dataset.screen).toBe("home");
    expect(queryByRole("button", { name: "Back" })).toBeNull();
  });

  test("the tabs open their pages without Back, and light up", () => {
    const { container, getByRole, queryByRole, store } = phone();
    fireEvent.click(tab(container, /^Library/));
    expect(store.get().route).toEqual({ kind: "library" });
    expect(getByRole("heading", { name: "Library", level: 1 })).toBeTruthy();
    expect(queryByRole("button", { name: "Back" })).toBeNull();
    expect(tab(container, /^Library/).getAttribute("aria-current")).toBe(
      "page",
    );
    fireEvent.click(tab(container, /^Backups/));
    expect(store.get().route).toEqual({ kind: "server", page: "backups" });
    fireEvent.click(tab(container, /^Configuration/));
    expect(store.get().route).toEqual({ kind: "server", page: "config" });
    fireEvent.click(tab(container, /^Worlds/));
    expect(root(container).dataset.screen).toBe("home");
  });

  test("a link from one page to another is retraced by Back", () => {
    const { container, store, getByRole } = phone();
    fireEvent.click(tab(container, /^Library/));
    void act(() => {
      store.set({ route: { kind: "world", worldId: "w1" } });
    });
    // Still the Library's tab: the world was reached from it.
    expect(tab(container, /^Library/).getAttribute("aria-current")).toBe(
      "page",
    );
    fireEvent.click(getByRole("button", { name: "Back" }));
    expect(store.get().route).toEqual({ kind: "library" });
  });

  test("the badges count worlds with changes and new modules", () => {
    const { container } = phone();
    expect(tab(container, /^Library/).textContent).toContain("2");
    expect(tab(container, /^Library/).textContent).toContain("2 new modules");
  });
});

describe("Escape as Android's Back", () => {
  test("goes back a page, and is left alone at home", () => {
    const { container } = phone();
    fireEvent.click(el(container, '.mls-world[data-world="w1"]'));
    let handled = false;
    void act(() => {
      handled = !escape();
    });
    expect(handled).toBe(true);
    expect(root(container).dataset.screen).toBe("home");
    void act(() => {
      handled = !escape();
    });
    expect(handled).toBe(false);
  });

  test("an open menu takes it first", () => {
    const { container, getByRole } = phone();
    fireEvent.click(el(container, '.mls-world[data-world="w1"]'));
    fireEvent.click(tab(container, /^Worlds/));
    fireEvent.click(getByRole("button", { name: "Log out or shut down" }));
    void act(() => {
      escape();
    });
    expect(container.querySelector(".mlh-menu")).toBeNull();
    expect(root(container).dataset.screen).toBe("home");
  });

  test("Android's Back, from native, goes back even from a text field", () => {
    const { container } = phone();
    fireEvent.click(tab(container, /^Library/));
    const field = document.createElement("input");
    el(container, ".mls-main").append(field);
    field.focus();
    let handled = false;
    void act(() => {
      handled = pressBack(document);
    });
    expect(handled).toBe(true);
    expect(root(container).dataset.screen).toBe("home");
    void act(() => {
      handled = pressBack(document);
    });
    expect(handled).toBe(false);
  });

  test("native Back never reaches Foundry's own key handling", () => {
    const { container } = phone();
    fireEvent.click(tab(container, /^Library/));
    const foundry = vi.fn((e: KeyboardEvent) => {
      e.preventDefault();
    });
    window.addEventListener("keydown", foundry);
    try {
      let handled = false;
      void act(() => {
        handled = pressBack(document);
      });
      expect(handled).toBe(true);
      void act(() => {
        handled = pressBack(document);
      });
      expect(handled).toBe(false);
      expect(foundry).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", foundry);
    }
  });

  test("a page script's Escape in a text field stays the field's", () => {
    const { container } = phone();
    fireEvent.click(tab(container, /^Library/));
    const field = document.createElement("input");
    el(container, ".mls-main").append(field);
    void act(() => {
      field.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(root(container).dataset.screen).toBe("page");
  });

  test("native Back closes an open menu first", () => {
    const { container, getByRole } = phone();
    fireEvent.click(el(container, '.mls-world[data-world="w1"]'));
    fireEvent.click(tab(container, /^Worlds/));
    const menuButton = getByRole("button", { name: "Log out or shut down" });
    fireEvent.click(menuButton);
    void act(() => {
      pressBack(document);
    });
    expect(container.querySelector(".mlh-menu")).toBeNull();
    expect(root(container).dataset.screen).toBe("home");
  });

  test("on the desktop Escape does nothing", () => {
    viewport(1366, 768);
    phone();
    let handled = false;
    void act(() => {
      handled = !escape();
    });
    expect(handled).toBe(false);
  });
});

describe("the tablet", () => {
  test("keeps the worlds list beside the page, with the home bar", () => {
    viewport(1024, 768, true);
    const { container, getByRole, store } = phone();
    expect(root(container).dataset.screen).toBe("page");
    expect(getByRole("heading", { name: "Foundry VTT" })).toBeTruthy();
    fireEvent.click(tab(container, /^Library/));
    fireEvent.click(tab(container, /^Worlds/));
    expect(store.get().route).toBeNull();
  });
});

describe("the dock", () => {
  const page = (
    <div class="page">
      <Docked>
        <b>bar</b>
      </Docked>
    </div>
  );

  test("renders in place without a dock (the desktop)", () => {
    const r = render(page);
    expect(r.container.querySelector(".page b")).not.toBeNull();
  });

  test("renders nothing until the dock exists, then into it", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const r = render(
      <DockContext.Provider value={null}>{page}</DockContext.Provider>,
    );
    expect(r.container.querySelector("b")).toBeNull();
    r.rerender(
      <DockContext.Provider value={host}>{page}</DockContext.Provider>,
    );
    expect(host.querySelector("b")?.textContent).toBe("bar");
    expect(r.container.querySelector(".page b")).toBeNull();
    host.remove();
  });
});

describe("a popover opened after the shell", () => {
  function Pop() {
    const ref = useDismiss();
    return (
      <details ref={ref} open>
        <summary>Colour</summary>
      </details>
    );
  }

  test("takes Escape first: it closes, the page stays", () => {
    const { container } = phone();
    fireEvent.click(el(container, '.mls-world[data-world="w1"]'));
    // Mounted after the shell: its listener comes later on the document.
    const pop = render(<Pop />);
    let handled = false;
    void act(() => {
      handled = !escape();
    });
    expect(handled).toBe(true);
    expect(pop.container.querySelector("details")?.open).toBe(false);
    expect(root(container).dataset.screen).toBe("page");
  });
});
