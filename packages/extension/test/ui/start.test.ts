// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ExtensionMessage } from "../../src/messages.ts";
import type { Send } from "../../src/ui/actions.ts";
import { localChannelPair } from "../../src/page-channel.ts";
import { startSetupMain } from "../../src/page/main.ts";
import { startSetupUi } from "../../src/ui/start.ts";
import { fakePorts, setupState } from "./harness.tsx";

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

afterEach(async () => {
  // Library sync runs on after each test's checks: let its last status
  // render before the page goes, not after the environment is gone.
  for (let i = 0; i < 10; i++) await flush();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  document.documentElement.className = "";
});

/** Library sync's answer when there is nothing to do. */
const QUIET = {
  ok: true,
  changedLocal: false,
  push: null,
  clashes: [],
  repaired: false,
};

function start(states = [setupState()]) {
  const [main, ui] = localChannelPair();
  const atMain: [string, unknown][] = [];
  main.listen((type, payload) => {
    atMain.push([type, payload]);
    // Library sync: no file on this server, so nothing waits on a timer.
    if (type === "LIBRARY_FILE") {
      const { requestId } = payload as { requestId: string };
      main.send("LIBRARY_FILE_DONE", { requestId, missing: true });
    }
  });
  const state = states[0] ?? setupState();
  let seen = 0;
  const send = vi.fn((m: ExtensionMessage) =>
    Promise.resolve(
      m.kind === "setup-seen"
        ? (states[seen++] ?? states.at(-1))
        : m.kind === "library-sync"
          ? QUIET
          : {},
    ),
  );
  startSetupUi({
    channel: ui,
    send: send as unknown as Send,
    ports: fakePorts(),
    doc: document,
  });
  return { main, atMain, send, state };
}

describe("setup-ui: our half of the Setup page", () => {
  test("reports Setup's data to the background, then asks to take over", async () => {
    const s = start();
    s.main.send("SETUP_DATA", s.state.setup);
    await vi.waitFor(() => {
      expect(s.atMain.map((m) => m[0])).toContain("SHELL");
    });
    expect(s.send).toHaveBeenCalledWith({
      kind: "setup-seen",
      data: expect.objectContaining({
        isAdmin: true,
        worlds: [expect.objectContaining({ id: "w1" })],
      }) as unknown,
    });
    expect(s.atMain).toContainEqual(["SHELL", { on: true }]);
  });

  test("ignores Setup data that doesn't check out", async () => {
    const s = start();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    s.main.send("SETUP_DATA", { isAdmin: true });
    await flush();
    await flush();
    expect(s.send).not.toHaveBeenCalled();
    // Not started: Foundry's page comes back at once.
    expect(document.documentElement.classList.contains("st-shell-off")).toBe(
      true,
    );
  });

  test("a second report updates the page it already started", async () => {
    const s = start();
    const seen = () =>
      s.send.mock.calls.filter(([m]) => m.kind === "setup-seen").length;
    s.main.send("SETUP_DATA", s.state.setup);
    await vi.waitFor(() => {
      expect(seen()).toBe(1);
    });
    s.main.send("SETUP_DATA", s.state.setup);
    await vi.waitFor(() => {
      expect(seen()).toBe(2);
    });
    await flush();
    expect(s.atMain.filter((m) => m[0] === "SHELL")).toHaveLength(1);
  });
});

describe("both halves in one closure over the private channel (the app)", () => {
  test("Foundry's Setup data reaches our page, which takes over Foundry's layout", async () => {
    document.body.innerHTML = `<div id="setup"></div><nav id="setup-menu"></nav>`;
    // Library sync reads the server's file: there is none.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status: 404 }))),
    );
    const [mainEnd, uiEnd] = localChannelPair();
    const empty = { values: () => [].values() };
    startSetupMain({
      channel: mainEnd,
      page: {
        game: {
          view: "setup",
          release: { generation: 14, build: 370 },
          data: { isAdmin: true },
          modules: empty,
          worlds: empty,
          systems: empty,
        },
        ui: { setupPackages: {} },
      },
      doc: document,
    });
    const state = setupState();
    const send = vi.fn((m: ExtensionMessage) =>
      Promise.resolve(
        m.kind === "setup-seen"
          ? state
          : m.kind === "library-sync"
            ? QUIET
            : {},
      ),
    );
    startSetupUi({
      channel: uiEnd,
      send: send as unknown as Send,
      ports: fakePorts(),
      doc: document,
    });
    await vi.waitFor(() => {
      expect(document.querySelector("#st-shell-root .sts-top")).toBeTruthy();
    });
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      kind: "setup-seen",
      data: { isAdmin: true, core: { version: "14.370" } },
    });
    expect(document.body.classList.contains("st-shell-on")).toBe(true);
  });

  test("a background that fails leaves Foundry's page alone", async () => {
    const [mainEnd, uiEnd] = localChannelPair();
    const send = vi.fn(() => Promise.reject(new Error("No reply")));
    const logged = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    startSetupUi({
      channel: uiEnd,
      send: send,
      ports: fakePorts(),
      doc: document,
    });
    mainEnd.send("SETUP_DATA", setupState().setup);
    await vi.waitFor(() => {
      expect(logged).toHaveBeenCalled();
    });
    expect(document.getElementById("st-shell-root")).toBe(null);
    // Foundry's page comes back at once, not after the veil's 15 s.
    expect(document.documentElement.classList.contains("st-shell-off")).toBe(
      true,
    );
  });

  test("library sync starts on an admin's Setup, and only there", async () => {
    const s = start();
    s.main.send("SETUP_DATA", s.state.setup);
    await vi.waitFor(() => {
      expect(s.atMain.map((m) => m[0])).toContain("LIBRARY_FILE");
    });
  });

  test("library sync starts once a later Setup report is verified", async () => {
    const s = start([
      setupState({ adminVerified: false }),
      setupState({ adminVerified: true }),
    ]);
    s.main.send("SETUP_DATA", s.state.setup);
    await vi.waitFor(() => {
      expect(s.atMain.map((m) => m[0])).toContain("SHELL");
    });
    await flush();
    expect(s.atMain.map((m) => m[0])).not.toContain("LIBRARY_FILE");
    s.main.send("SETUP_DATA", s.state.setup);
    await vi.waitFor(() => {
      expect(s.atMain.map((m) => m[0])).toContain("LIBRARY_FILE");
    });
  });
});
