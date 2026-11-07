// @vitest-environment happy-dom
// The settings panel (toolbar popup and options dialog): the Foundry server
// you are on in one click, the servers with Remove, adding by address, the
// foundryvtt.com permission for Release history, and the build line.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/preact";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ServerRecord } from "../../src/background/state.ts";
import { FOUNDRY_ORIGIN } from "../../src/background/releases.ts";
import type { ExtensionMessage } from "../../src/messages.ts";
import type { SettingsPlatform } from "../../src/ui/settings/platform.ts";
import { SettingsPanel } from "../../src/ui/settings/SettingsPanel.tsx";

afterEach(cleanup);

const S = "http://localhost:30000";

interface Fake {
  readonly platform: SettingsPlatform;
  readonly sent: ExtensionMessage[];
  readonly granted: Set<string>;
}

function fake(
  opts: {
    readonly url?: string;
    readonly servers?: readonly string[];
    readonly grant?: boolean;
    /** Whether the page is Foundry's (its stylesheet); true by default. */
    readonly foundry?: boolean;
    readonly failRemove?: boolean;
  } = {},
): Fake {
  const sent: ExtensionMessage[] = [];
  const granted = new Set<string>();
  let servers: ServerRecord[] = (opts.servers ?? []).map((id) => ({
    id,
    addedAt: "2026-11-07T00:00:00.000Z",
  }));
  const send = vi.fn((m: ExtensionMessage): Promise<unknown> => {
    sent.push(m);
    if (m.kind === "register-server") {
      const id = m.server.replace(/\/+$/, "");
      servers = [...servers, { id, addedAt: "2026-11-07T01:00:00.000Z" }];
      return Promise.resolve({ server: id });
    }
    if (m.kind === "remove-server") {
      if (opts.failRemove) return Promise.reject(new Error("Storage is full"));
      servers = servers.filter((s) => s.id !== m.server);
    }
    return Promise.resolve({ servers });
  });
  const platform: SettingsPlatform = {
    send,
    permissions: {
      request: vi.fn((o: string) => {
        if (opts.grant === false) return Promise.resolve(false);
        granted.add(o);
        return Promise.resolve(true);
      }),
      contains: vi.fn((o: string) => Promise.resolve(granted.has(o))),
      remove: vi.fn((o: string) => {
        granted.delete(o);
        return Promise.resolve(true);
      }),
    },
    currentTab: () =>
      Promise.resolve(opts.url ? { id: 7, url: opts.url } : undefined),
    reload: vi.fn(() => Promise.resolve()),
    isFoundry: vi.fn(() => Promise.resolve(opts.foundry ?? true)),
    build: "0.2.0 · abc1234 · 2026-11-07 12:00",
  };
  return { platform, sent, granted };
}

const show = (f: Fake) => render(<SettingsPanel platform={f.platform} />);

describe("this site, in one click", () => {
  test("on a Foundry page not yet added: Use Module Library here asks for that site, adds it and reloads the page", async () => {
    const f = fake({ url: "http://192.168.1.20:30000/setup" });
    show(f);
    const use = await screen.findByRole("button", {
      name: "Use Module Library here",
    });
    expect(screen.getByText("192.168.1.20:30000")).toBeTruthy();
    fireEvent.click(use);
    await waitFor(() => {
      expect(f.platform.reload).toHaveBeenCalledWith(7);
    });
    expect(f.platform.permissions.request).toHaveBeenCalledWith(
      "http://192.168.1.20:30000/*",
    );
    expect(f.sent).toContainEqual({
      kind: "register-server",
      server: "http://192.168.1.20:30000",
    });
    expect(await screen.findByText(/On for this server/)).toBeTruthy();
  });

  test("refused, nothing is added and it says so", async () => {
    const f = fake({ url: `${S}/join`, grant: false });
    show(f);
    fireEvent.click(
      await screen.findByRole("button", { name: "Use Module Library here" }),
    );
    expect(await screen.findByText(/didn't allow/)).toBeTruthy();
    expect(f.sent.some((m) => m.kind === "register-server")).toBe(false);
    expect(f.platform.reload).not.toHaveBeenCalled();
  });

  test("on a server already added it says it is on; elsewhere there is no This site", async () => {
    const on = fake({ url: `${S}/game`, servers: [S] });
    show(on);
    expect(await screen.findByText(/On for this server/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Use Module Library here" }),
    ).toBeNull();
    cleanup();
    show(fake({ url: "https://example.com/news" }));
    await screen.findByText("Servers");
    expect(screen.queryByText("This site")).toBeNull();
  });

  test("an address like Foundry's is not enough: the page itself must be Foundry's (code review)", async () => {
    const f = fake({ url: "https://github.com/join", foundry: false });
    show(f);
    await screen.findByText("Servers");
    await waitFor(() => {
      expect(f.platform.isFoundry).toHaveBeenCalledWith(7);
    });
    expect(screen.queryByText("This site")).toBeNull();
  });

  test("the background hears which server is being added before the browser asks (a popup may close meanwhile)", async () => {
    const f = fake({ url: `${S}/setup` });
    show(f);
    fireEvent.click(
      await screen.findByRole("button", { name: "Use Module Library here" }),
    );
    await waitFor(() => {
      expect(f.platform.reload).toHaveBeenCalled();
    });
    const kinds = f.sent.map((m) => m.kind);
    expect(kinds.indexOf("adding-server")).toBeLessThan(
      kinds.indexOf("register-server"),
    );
    expect(f.sent).toContainEqual({ kind: "adding-server", server: S });
  });
});

describe("servers", () => {
  test("each server with Remove; removing takes it off the list", async () => {
    const f = fake({ servers: [S, "https://vtt.example.com/foundry"] });
    show(f);
    expect(await screen.findByText("localhost:30000")).toBeTruthy();
    expect(screen.getByText("vtt.example.com/foundry")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove localhost:30000" }),
    );
    await waitFor(() => {
      expect(screen.queryByText("localhost:30000")).toBeNull();
    });
    expect(f.sent).toContainEqual({ kind: "remove-server", server: S });
  });

  test("a removal that fails says why and keeps the server listed (code review)", async () => {
    show(fake({ servers: [S], failRemove: true }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Remove localhost:30000" }),
    );
    expect(await screen.findByText("Storage is full")).toBeTruthy();
    expect(screen.getByText("localhost:30000")).toBeTruthy();
  });

  test("none yet: how to add one", async () => {
    show(fake());
    expect(await screen.findByText(/No servers yet/)).toBeTruthy();
  });

  test("adding by address: a bad one says why; a good one is asked for, added and listed", async () => {
    const f = fake();
    show(f);
    const field = await screen.findByLabelText("Server address");
    fireEvent.input(field, { target: { value: "ftp://nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText(/http and https/)).toBeTruthy();
    fireEvent.input(field, { target: { value: "http://10.0.0.5:30000/" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("10.0.0.5:30000")).toBeTruthy();
    expect(f.platform.permissions.request).toHaveBeenCalledWith(
      "http://10.0.0.5:30000/*",
    );
  });
});

describe("Release history's permission, and the build", () => {
  test("Allow asks for foundryvtt.com; once allowed it can be removed", async () => {
    const f = fake();
    show(f);
    fireEvent.click(
      await screen.findByRole("button", { name: "Allow foundryvtt.com" }),
    );
    expect(f.platform.permissions.request).toHaveBeenCalledWith(FOUNDRY_ORIGIN);
    fireEvent.click(
      await screen.findByRole("button", { name: "Remove the permission" }),
    );
    await screen.findByRole("button", { name: "Allow foundryvtt.com" });
    expect(f.granted.has(FOUNDRY_ORIGIN)).toBe(false);
  });

  test("the build line", async () => {
    show(fake());
    expect(await screen.findByText(/abc1234/)).toBeTruthy();
  });
});
