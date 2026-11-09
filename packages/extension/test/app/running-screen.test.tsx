// @vitest-environment happy-dom
// The app's screen while a world runs (Android plan, phase 3, package 6):
// when it shows, what it says, and Return to Setup with its question and
// the password Foundry wants.
import { cleanup, fireEvent, render, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, test, vi } from "vitest";
import { RunningScreen } from "../../src/app/running/RunningScreen.tsx";
import type { CloseResult, Status } from "../../src/app/running/server.ts";
import { showsRunning, startRunning } from "../../src/app/running/start.tsx";
import { createTranslator } from "../../src/ui/i18n.ts";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.replaceChildren();
  document.documentElement.className = "";
});

const SERVER = "http://localhost:30000";
const t = createTranslator("en");
const WORLD = { id: "strahd", title: "Curse of Strahd", background: "a.webp" };
const status = (over: Partial<Status> = {}): Status => ({
  active: true,
  version: "14.370",
  system: "dnd5e",
  systemVersion: "6.0.6",
  users: 2,
  uptime: 6_000_000,
  ...over,
});

describe("showsRunning", () => {
  test("on the server's /join, after a launch from Setup too", () => {
    expect(showsRunning(`${SERVER}/join`, SERVER)).toBe(true);
  });

  test("not on other pages or servers", () => {
    expect(showsRunning(`${SERVER}/game`, SERVER)).toBe(false);
    expect(showsRunning("http://other:30000/join", SERVER)).toBe(false);
  });
});

function screen(
  s: Status | undefined,
  close: (pw?: string) => Promise<CloseResult>,
  more: { readonly launched?: number } = {},
) {
  return render(
    <RunningScreen
      t={t}
      world={WORLD}
      status={s}
      origin={SERVER}
      close={close}
      launched={more.launched}
      serversHref="https://appassets.androidplatform.net/home.html"
    />,
  );
}

describe("the two ways on (owner, phase 7)", () => {
  test("Back to Setup first, Server list second; the game is never offered", () => {
    const r = screen(status(), vi.fn());
    const body = r.container.querySelector(".mlr-body");
    const ways = body?.querySelectorAll("button, a") ?? [];
    expect(ways[0]?.textContent).toContain("Back to Setup");
    expect(ways[0]?.className).toContain("bright");
    expect(ways[1]?.textContent).toContain("Server list");
    expect(ways[1]?.getAttribute("href")).toBe(
      "https://appassets.androidplatform.net/home.html",
    );
    expect(r.container.textContent).not.toMatch(/Join|Gamemaster/);
    expect(r.container.textContent).toContain(
      "Back to Setup closes the world and disconnects the 2 people in it. Server list leaves it running.",
    );
  });

  test("after a launch with changes, it says they went with it", () => {
    const r = screen(status({ users: 0 }), vi.fn(), { launched: 2 });
    expect(r.container.textContent).toContain(
      "Launched from here with 2 changes queued.",
    );
  });

  test("the top bar goes back to the app's servers", () => {
    const r = screen(status(), vi.fn());
    expect(r.getByRole("link", { name: "Servers" }).getAttribute("href")).toBe(
      "https://appassets.androidplatform.net/home.html",
    );
  });
});

describe("RunningScreen", () => {
  test("which world runs, who is in it and for how long", () => {
    const r = screen(status(), vi.fn());
    expect(r.getByRole("heading", { name: "Curse of Strahd" })).toBeTruthy();
    const text = r.container.textContent;
    expect(text).toContain("Running now");
    expect(text).toContain("dnd5e 6.0.6");
    expect(text).toContain("2 people in the game");
    expect(text).toContain("For 1 h 40 min");
    expect(text).toContain("14 · 370");
    expect(text).toContain("disconnects the 2 people in it");
  });

  test("with people in the game, Back to Setup asks first", async () => {
    const close = vi.fn(() => Promise.resolve<CloseResult>("closing"));
    const r = screen(status(), close);
    fireEvent.click(r.getByRole("button", { name: "Back to Setup" }));
    const ask = r.getByRole("dialog", { name: "Back to Setup?" });
    expect(ask.textContent).toContain("2 people are in Curse of Strahd");
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(r.getByRole("button", { name: "Disconnect and close" }));
    await waitFor(() => {
      expect(close).toHaveBeenCalledWith(undefined);
    });
    expect(
      r.getByRole("button", { name: "Closing Curse of Strahd…" }),
    ).toHaveProperty("disabled", true);
  });

  test("nobody in the game: it closes at once", async () => {
    const close = vi.fn(() => Promise.resolve<CloseResult>("closing"));
    const r = screen(status({ users: 0 }), close);
    expect(r.container.textContent).toContain("Nobody in the game");
    fireEvent.click(r.getByRole("button", { name: "Back to Setup" }));
    await waitFor(() => {
      expect(close).toHaveBeenCalledTimes(1);
    });
  });

  test("Foundry wants the password: asked, sent, and a wrong one said", async () => {
    const close = vi
      .fn<(pw?: string) => Promise<CloseResult>>()
      .mockResolvedValueOnce("password")
      .mockResolvedValueOnce("password")
      .mockResolvedValueOnce("closing");
    const r = screen(status({ users: 0 }), close);
    const field = (): HTMLInputElement => {
      const el = r.container.querySelector<HTMLInputElement>(
        "input[type=password]",
      );
      if (!el) throw new Error("no password field");
      return el;
    };
    const send = (pw: string): void => {
      fireEvent.input(field(), { target: { value: pw } });
      const form = field().closest("form");
      if (form) fireEvent.submit(form);
    };
    fireEvent.click(r.getByRole("button", { name: "Back to Setup" }));
    await waitFor(() => {
      expect(r.getByRole("dialog", { name: "Administrator password" }));
    });
    expect(r.queryByRole("alert")).toBeNull();
    send("nope");
    await waitFor(() => {
      expect(r.getByRole("alert").textContent).toContain("didn't accept");
    });
    expect(close).toHaveBeenLastCalledWith("nope");
    send("right");
    await waitFor(() => {
      expect(close).toHaveBeenLastCalledWith("right");
    });
  });

  test("a failure says so and leaves Back to Setup", async () => {
    const r = screen(status({ users: 0 }), () => Promise.resolve("failed"));
    fireEvent.click(r.getByRole("button", { name: "Back to Setup" }));
    await waitFor(() => {
      expect(r.getByRole("alert").textContent).toContain("didn't close");
    });
    expect(r.getByRole("button", { name: "Back to Setup" })).toBeTruthy();
  });

  test("Escape on the question cancels it", () => {
    const r = screen(status(), vi.fn());
    fireEvent.click(r.getByRole("button", { name: "Back to Setup" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(r.queryByRole("dialog")).toBeNull();
  });
});

describe("startRunning", () => {
  const response = (s: Status) =>
    Promise.resolve(new Response(JSON.stringify(s)));

  function deps(game: () => unknown, fetch: typeof window.fetch) {
    const assign = vi.fn();
    const win = Object.assign(Object.create(window) as Window, {
      location: { origin: SERVER, assign },
      setTimeout: window.setTimeout.bind(window),
      setInterval: window.setInterval.bind(window),
      clearInterval: window.clearInterval.bind(window),
    });
    return {
      assign,
      d: {
        win,
        doc: document,
        css: "#ml-run-root{}",
        game,
        server: { fetch, route: (p: string) => `${SERVER}/${p}` },
        serversHref: "https://appassets.androidplatform.net/home.html",
      },
    };
  }

  test("waits for Foundry's join data behind a veil, then shows the screen", async () => {
    // Foundry's data, arriving later.
    const page: { game?: unknown } = {};
    const { d } = deps(
      () => page.game,
      () => response(status()),
    );
    startRunning(d);
    expect(document.documentElement.classList.contains("ml-run-wait")).toBe(
      true,
    );
    expect(document.getElementById("ml-run-style")).not.toBeNull();
    page.game = { view: "join", world: WORLD };
    await waitFor(() => {
      expect(document.getElementById("ml-run-root")).not.toBeNull();
    });
    expect(document.documentElement.classList.contains("ml-run-wait")).toBe(
      false,
    );
    await waitFor(() => {
      expect(document.body.textContent).toContain("2 people in the game");
    });
  });

  test("goes to Setup once the world has closed", async () => {
    const game = { view: "join", world: WORLD };
    const { d, assign } = deps(
      () => game,
      () => response(status({ active: false })),
    );
    startRunning(d);
    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith(`${SERVER}/setup`);
    });
  });

  test("a world that closes before its data comes: Setup, not a blank page (seen on the emulator)", async () => {
    vi.useFakeTimers();
    const { d, assign } = deps(
      () => undefined,
      () => response(status({ active: false })),
    );
    startRunning(d);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith(`${SERVER}/setup`);
  });

  test("while the world still runs, waiting for its data goes nowhere", async () => {
    vi.useFakeTimers();
    const { d, assign } = deps(
      () => undefined,
      () => response(status()),
    );
    startRunning(d);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(assign).not.toHaveBeenCalled();
  });

  test("gives Foundry's page back when its data never comes", async () => {
    vi.useFakeTimers();
    const { d } = deps(
      () => undefined,
      () => response(status()),
    );
    startRunning(d);
    await vi.advanceTimersByTimeAsync(31_000);
    expect(document.documentElement.classList.contains("ml-run-wait")).toBe(
      false,
    );
    expect(document.getElementById("ml-run-root")).toBeNull();
  });
});

describe("review fixes", () => {
  test("Foundry's join page is inert under the screen", async () => {
    const form = document.createElement("form");
    document.body.append(form);
    const game = { view: "join", world: WORLD };
    startRunning({
      win: Object.assign(Object.create(window) as Window, {
        location: { origin: SERVER, assign: vi.fn() },
        setTimeout: window.setTimeout.bind(window),
        setInterval: window.setInterval.bind(window),
        clearInterval: window.clearInterval.bind(window),
        clearTimeout: window.clearTimeout.bind(window),
      }),
      doc: document,
      serversHref: "x",
      css: "",
      game: () => game,
      server: {
        fetch: () => Promise.resolve(new Response(JSON.stringify(status()))),
        route: (p: string) => `${SERVER}/${p}`,
      },
    });
    await waitFor(() => {
      expect(document.getElementById("ml-run-root")).not.toBeNull();
    });
    expect(form.inert).toBe(true);
  });

  test("a screen that can't start gives Foundry's page back", () => {
    const form = document.createElement("form");
    document.body.append(form);
    startRunning({
      win: Object.defineProperty(
        Object.assign(Object.create(window) as Window, {
          location: { origin: SERVER },
          setTimeout: window.setTimeout.bind(window),
        }),
        // Breaks the start-up itself (Foundry's globals read while mounting).
        "game",
        {
          get() {
            throw new Error("broken");
          },
        },
      ),
      doc: document,
      css: "",
      game: () => ({ view: "join", world: WORLD }),
      server: { fetch: vi.fn(), route: (p: string) => p },
      serversHref: "x",
    });
    expect(document.documentElement.classList.contains("ml-run-wait")).toBe(
      false,
    );
    expect(document.getElementById("ml-run-root")).toBeNull();
    expect(form.inert).toBe(false);
  });

  test("while the question is open the screen behind it is inert", async () => {
    const r = screen(status(), vi.fn());
    fireEvent.click(r.getByRole("button", { name: "Back to Setup" }));
    // happy-dom has no inert property: Preact sets the attribute instead.
    const main = r.container.querySelector<HTMLElement>(".mlr-scroll");
    await waitFor(() => {
      expect(main?.inert === true || main?.hasAttribute("inert")).toBe(true);
    });
  });
});
