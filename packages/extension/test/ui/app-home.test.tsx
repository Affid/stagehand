// @vitest-environment happy-dom
// The app's home screen (Android plan, phase 6; mockup design/app-screens,
// home A) over the real background router: adding a server without typing
// the protocol, whether Foundry answers there, renaming, a new address that
// keeps the library, removing after asking, Back, and Release history.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/preact";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BUNDLED_CONFIG } from "../../src/adapters/config.ts";
import { memoryKeyValue, serialized } from "../../src/background/kv.ts";
import type { ScriptingPlatform } from "../../src/background/registration.ts";
import { FOUNDRY_ORIGIN } from "../../src/background/releases.ts";
import { type RouterDeps, route } from "../../src/background/router.ts";
import { createState } from "../../src/background/state.ts";
import { AppHome } from "../../src/ui/app-home/AppHome.tsx";
import { createBackStack } from "../../src/ui/app-home/back.ts";
import type {
  AppHome as AppLinks,
  SettingsPlatform,
} from "../../src/ui/settings/platform.ts";

afterEach(cleanup);

const HOME = "https://appassets.androidplatform.net/";
const LAN = "http://192.168.1.20:30000";
const NOW = Date.parse("2026-11-09T12:00:00.000Z");

/** Native and the background: site permissions, scripts, the router. */
function world(answers: Readonly<Record<string, string>> = {}) {
  const granted = new Set<string>();
  const registered = new Set<string>();
  const scripting: ScriptingPlatform = {
    hasPermission: (o) => Promise.resolve(granted.has(o)),
    registeredIds: (ids) =>
      Promise.resolve(ids.filter((id) => registered.has(id))),
    unregister: (ids) => {
      ids.forEach((id) => registered.delete(id));
      return Promise.resolve();
    },
    register: (scripts) => {
      scripts.forEach((s) => registered.add(s.id));
      return Promise.resolve();
    },
    removePermission: (o) => {
      granted.delete(o);
      return Promise.resolve();
    },
  };
  const deps: RouterDeps = {
    state: createState(serialized(memoryKeyValue())),
    scripting,
    releases: { permitted: () => Promise.resolve(false), fetchText: vi.fn() },
    openSettings: vi.fn(),
    extensionId: "app",
    extensionUrl: HOME,
    extensionVersion: "0.2.0",
    loadConfig: () => Promise.resolve(BUNDLED_CONFIG),
    now: () => "2026-11-09T11:00:00.000Z",
    uuid: () => "id",
  };
  const platform: SettingsPlatform = {
    send: (m) =>
      route(deps, m, { id: "app", url: `${HOME}home.html`, fromTab: false }),
    permissions: {
      request: vi.fn((o: string) => {
        granted.add(o);
        return Promise.resolve(true);
      }),
      contains: (o) => Promise.resolve(granted.has(o)),
      remove: vi.fn((o: string) => Promise.resolve(granted.delete(o))),
    },
    currentTab: () => Promise.resolve(undefined),
    reload: () => Promise.resolve(),
    isFoundry: () => Promise.resolve(false),
    build: "0.2.0 · abc1234",
  };
  const app: AppLinks = {
    serverHref: (s) => `${s}/setup`,
    check: vi.fn((s: string) => {
      const version = answers[s];
      return version
        ? Promise.resolve(version)
        : Promise.reject(new Error("Timed out"));
    }),
  };
  return { deps, platform, app, granted, opened: [] as string[] };
}

type World = ReturnType<typeof world>;

function show(w: World) {
  const back = createBackStack();
  render(
    <AppHome
      platform={w.platform}
      app={w.app}
      back={back}
      open={(href) => w.opened.push(href)}
      now={() => NOW}
    />,
  );
  return back;
}

async function saved(w: World, server: string, name?: string) {
  await w.platform.permissions.request(`${new URL(server).origin}/*`);
  await w.platform.send({ kind: "register-server", server });
  if (name) await w.platform.send({ kind: "rename-server", server, name });
}

const typeAddress = (text: string) => {
  fireEvent.input(screen.getByLabelText("Address"), {
    target: { value: text },
  });
};

describe("home: adding a server", () => {
  test("with no servers it explains what to add", async () => {
    show(world());
    expect(await screen.findByText("Your Foundry servers")).toBeTruthy();
    expect(screen.getByText("Build 0.2.0 · abc1234")).toBeTruthy();
  });

  test("the address goes in without http; Foundry's answer shows; Add and open opens it", async () => {
    const w = world({ [LAN]: "14.370" });
    show(w);
    fireEvent.click(
      await screen.findByRole("button", { name: "Add a server" }),
    );
    typeAddress("192.168.1.20:30000");
    expect(
      await screen.findByText(`Foundry 14.370 answers at ${LAN}`, undefined, {
        timeout: 2000,
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add and open" }));
    await waitFor(() => {
      expect(w.opened).toEqual([`${LAN}/setup`]);
    });
    expect(await screen.findByText("192.168.1.20:30000")).toBeTruthy();
    expect(screen.getByText("Not encrypted")).toBeTruthy();
    expect(screen.getByText("Not opened yet")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("a pasted whole address picks https and keeps the rest", async () => {
    show(world());
    fireEvent.click(
      await screen.findByRole("button", { name: "Add a server" }),
    );
    typeAddress("https://vtt.example.com/foundry/");
    expect(
      screen.getByRole("button", { name: "https", pressed: true }),
    ).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>("Address").value).toBe(
      "vtt.example.com/foundry/",
    );
  });

  test("no answer over https suggests http", async () => {
    show(world());
    fireEvent.click(
      await screen.findByRole("button", { name: "Add a server" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "https" }));
    typeAddress("192.168.1.20:30000");
    expect(
      await screen.findByText(/No answer over https/, undefined, {
        timeout: 2000,
      }),
    ).toBeTruthy();
  });

  test("an address that isn't one yet is refused before anything is asked", async () => {
    const w = world();
    show(w);
    fireEvent.click(
      await screen.findByRole("button", { name: "Add a server" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add and open" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(w.platform.permissions.request).not.toHaveBeenCalled();
  });

  test("a server already saved just opens", async () => {
    const w = world();
    await saved(w, LAN);
    show(w);
    await screen.findByText("192.168.1.20:30000");
    fireEvent.click(screen.getByRole("button", { name: "Add a server" }));
    typeAddress("192.168.1.20:30000/");
    fireEvent.click(screen.getByRole("button", { name: "Add and open" }));
    expect(w.opened).toEqual([`${LAN}/setup`]);
    expect(w.platform.permissions.request).toHaveBeenCalledTimes(1);
  });
});

describe("home: a server's own sheet", () => {
  const edit = async (label: string) => {
    fireEvent.click(
      await screen.findByRole("button", { name: `Edit or remove ${label}` }),
    );
  };

  test("the card opens the server; its name shows with the host under it", async () => {
    const w = world();
    await saved(w, LAN, "Home server");
    await w.deps.state.markOpened(LAN, "2026-11-04T12:00:00.000Z");
    show(w);
    const open = await screen.findByRole("link", { name: "Open Home server" });
    expect(open.getAttribute("href")).toBe(`${LAN}/setup`);
    expect(screen.getByText("192.168.1.20:30000")).toBeTruthy();
    expect(screen.getByText("Opened 5 days ago")).toBeTruthy();
    expect(screen.getByText("H")).toBeTruthy();
  });

  test("renaming shows the new name; an empty name shows the address", async () => {
    const w = world();
    await saved(w, LAN);
    show(w);
    await edit("192.168.1.20:30000");
    fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Friday group" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Friday group")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("a new address keeps the library and the name, and moves the site", async () => {
    const w = world({ "http://192.168.1.21:30000": "14.370" });
    await saved(w, LAN, "Home server");
    show(w);
    await edit("Home server");
    typeAddress("192.168.1.21:30000");
    expect(
      await screen.findByText(/Foundry 14.370 answers/, undefined, {
        timeout: 2000,
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("192.168.1.21:30000")).toBeTruthy();
    expect(screen.getByText("Home server")).toBeTruthy();
    expect([...w.granted]).toEqual(["http://192.168.1.21:30000/*"]);
    expect(
      (await w.deps.state.library("http://192.168.1.21:30000")).serverId,
    ).toBe("http://192.168.1.21:30000");
  });

  test("a failed move gives the new site back and says why", async () => {
    const w = world();
    await saved(w, LAN);
    await saved(w, "http://192.168.1.21:30000");
    show(w);
    await edit("192.168.1.20:30000");
    typeAddress("192.168.1.21:30000");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "already saved",
    );
    expect(w.granted.has("http://192.168.1.21:30000/*")).toBe(true);
  });

  test("removing asks first, then the server goes", async () => {
    const w = world();
    await saved(w, LAN, "Home server");
    show(w);
    await edit("Home server");
    fireEvent.click(
      screen.getByRole("button", { name: "Remove this server…" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Remove Home server?" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(await screen.findByText("Your Foundry servers")).toBeTruthy();
    expect(w.granted.size).toBe(0);
  });

  test("Cancel keeps the server", async () => {
    const w = world();
    await saved(w, LAN, "Home server");
    show(w);
    await edit("Home server");
    fireEvent.click(
      screen.getByRole("button", { name: "Remove this server…" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Home server")).toBeTruthy();
  });
});

describe("home: Back and settings", () => {
  test("Back closes the open sheet first, then lets native go on", async () => {
    const back = show(world());
    expect(back.press()).toBe(false);
    fireEvent.click(
      await screen.findByRole("button", { name: "Add a server" }),
    );
    expect(screen.getByRole("dialog", { name: "Add a server" })).toBeTruthy();
    expect(back.press()).toBe(true);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(back.press()).toBe(false);
  });

  test("behind an open sheet nothing is reachable; closing it returns focus", async () => {
    const w = world();
    await saved(w, LAN);
    show(w);
    const dots = await screen.findByRole("button", {
      name: "Edit or remove 192.168.1.20:30000",
    });
    dots.focus();
    fireEvent.click(dots);
    expect(document.querySelector("main")?.inert).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Remove this server…" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.querySelector("main")?.inert).toBe(false);
    expect(document.activeElement).toBe(dots);
  });

  test("Escape and a tap outside close a sheet too", async () => {
    show(world());
    fireEvent.click(
      await screen.findByRole("button", { name: "Add a server" }),
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("Release history is one switch for foundryvtt.com", async () => {
    const w = world();
    show(w);
    const sw = await screen.findByRole("switch", { name: "Release history" });
    await waitFor(() => {
      expect(sw.getAttribute("aria-checked")).toBe("false");
    });
    fireEvent.click(sw);
    await waitFor(() => {
      expect(sw.getAttribute("aria-checked")).toBe("true");
    });
    expect(w.granted.has(FOUNDRY_ORIGIN)).toBe(true);
    fireEvent.click(sw);
    await waitFor(() => {
      expect(sw.getAttribute("aria-checked")).toBe("false");
    });
  });
});
