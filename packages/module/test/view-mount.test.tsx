// @vitest-environment happy-dom
// The view's chunk: drawn into Foundry's window, unsaved changes kept for
// the window across Foundry's redraws, Foundry's save sent to the review,
// and saving as Foundry does (module configuration, then everyone reloads).
import { emptyLibrary } from "@stagehand/shared/library/schema";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DialogV2 } from "../src/foundry.ts";
import { localPrefs } from "../src/view/prefs.ts";
import { createViewStore } from "../src/view/store.ts";
import { type MountDeps, mountView } from "../src/view/mount.tsx";
import { fakeGame } from "./fakes.ts";

afterEach(() => {
  cleanup();
  // The view renders into its own hosts, outside Testing Library's cleanup.
  document.body.replaceChildren();
});

/** A dialog that presses `action`, ticking nothing. */
const pressing = (action: string) => {
  const wait = vi.fn(
    (options: Parameters<DialogV2["wait"]>[0]): Promise<unknown> => {
      const b = options.buttons.find((x) => x.action === action);
      const form = document.createElement("form");
      const button = document.createElement("button");
      form.append(button);
      return Promise.resolve(
        b?.callback?.(new Event("click"), button) ?? action,
      );
    },
  );
  return { dialog: { wait } as DialogV2, wait };
};

function setup(action = "save", app: object = {}) {
  const { game, set } = fakeGame([
    { id: "stagehand", active: true },
    { id: "a", active: true },
    { id: "b" },
  ]);
  const { dialog, wait } = pressing(action);
  let review: () => void = () => undefined;
  const deps: MountDeps = {
    app,
    game,
    library: emptyLibrary("s"),
    dialog,
    warn: vi.fn(),
    error: vi.fn(),
    reloadAll: vi.fn(),
    prefs: { load: () => ({}), save: vi.fn() },
    canSwitch: true,
    fullGM: true,
    setReview: (r) => {
      review = r;
    },
  };
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = mountView(host, deps);
  return { deps, host, mounted, set, wait, review: () => review() };
}

describe("mountView", () => {
  it("saves the reviewed modules as Foundry does, then reloads everyone", async () => {
    // Arrange
    const s = setup("save");
    fireEvent.click(screen.getByRole("switch", { name: "b on in World One" }));

    // Act: Foundry's save, caught by the guard, asks the view to review
    s.review();

    // Assert
    await waitFor(() => {
      expect(s.deps.reloadAll).toHaveBeenCalledTimes(1);
    });
    expect(s.set).toHaveBeenCalledWith("core", "moduleConfiguration", {
      stagehand: true,
      a: true,
      b: true,
    });
  });

  it("keeps the window's unsaved changes when Foundry draws it again", () => {
    const app = {};
    const first = setup("back", app);
    fireEvent.click(screen.getByRole("switch", { name: "b on in World One" }));
    first.mounted.unmount();
    cleanup();

    setup("back", app);

    expect(screen.getByText("1 change not saved yet")).toBeTruthy();
  });

  it("says when the modules couldn't be saved, and changes nothing", async () => {
    const s = setup("save");
    s.set.mockRejectedValueOnce(new Error("socket closed"));
    fireEvent.click(screen.getByRole("switch", { name: "b on in World One" }));

    s.review();

    await waitFor(() => {
      expect(s.deps.error).toHaveBeenCalledTimes(1);
    });
    expect(s.deps.reloadAll).not.toHaveBeenCalled();
  });

  it("opens one review at a time, however often Save is pressed", async () => {
    const s = setup("back");
    let close: (v: unknown) => void = () => undefined;
    s.wait.mockImplementation(
      () =>
        new Promise<unknown>((resolve) => {
          close = resolve;
        }),
    );

    s.review();
    s.review();
    close("back");
    await waitFor(() => {
      expect(s.wait).toHaveBeenCalledTimes(1);
    });
    await new Promise((r) => setTimeout(r, 0));
    s.review();

    expect(s.wait).toHaveBeenCalledTimes(2);
  });

  it("empties the host when unmounted", () => {
    const s = setup();

    s.mounted.unmount();

    expect(s.host.childElementCount).toBe(0);
  });
});

describe("localPrefs", () => {
  it("keeps the user's choices per user", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    } as unknown as Storage;

    localPrefs(() => storage, "u1").save({ by: "tag", folded: ["f1"] });

    expect(localPrefs(() => storage, "u1").load()).toEqual({
      by: "tag",
      folded: ["f1"],
    });
    expect(localPrefs(() => storage, "u2").load()).toEqual({});
  });

  it("works without storage, keeping nothing", () => {
    const broken = () => {
      throw new Error("SecurityError");
    };

    const prefs = localPrefs(broken, "u1");
    prefs.save({ by: "tag", folded: [] });

    expect(prefs.load()).toEqual({});
  });

  it("ignores what isn't an object", () => {
    const storage = { getItem: () => "[1,2]" } as unknown as Storage;

    expect(localPrefs(() => storage, "u1").load()).toEqual({});
  });
});

describe("createViewStore", () => {
  it("keeps only plausible stored folds and Group by", () => {
    const store = createViewStore({
      load: () => ({ by: "everything", folded: ["f1", 7, "x".repeat(500)] }),
      save: vi.fn(),
    });

    expect(store.get().by).toBe("folder");
    expect([...store.get().folded]).toEqual(["f1"]);
  });
});
