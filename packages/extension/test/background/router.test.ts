import { describe, expect, test, vi } from "vitest";
import { makeEnvelope } from "@module-library/shared/protocol";
import type { SetupData } from "@module-library/shared/world";
import { BUNDLED_CONFIG } from "../../src/adapters/config.ts";
import { memoryKeyValue, serialized } from "../../src/background/kv.ts";
import type { ScriptingPlatform } from "../../src/background/registration.ts";
import { type RouterDeps, route } from "../../src/background/router.ts";
import { createState } from "../../src/background/state.ts";

const S = "http://localhost:30000";
const EXT = "chrome-extension://ext/";

function deps(granted = true) {
  const scripting: ScriptingPlatform = {
    hasPermission: vi.fn().mockResolvedValue(granted),
    registeredIds: vi.fn().mockResolvedValue(["old"]),
    unregister: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
  };
  let n = 0;
  const d: RouterDeps = {
    state: createState(serialized(memoryKeyValue())),
    scripting,
    extensionId: "ext",
    extensionUrl: EXT,
    extensionVersion: "0.1.0",
    loadConfig: () => Promise.resolve(BUNDLED_CONFIG),
    now: () => "2026-11-05T00:00:00.000Z",
    uuid: () => `id${++n}`,
  };
  return d;
}

const fromOptions = { id: "ext", url: `${EXT}options.html`, fromTab: true };
const fromSetup = { id: "ext", url: `${S}/setup`, fromTab: true };
const fromGame = { id: "ext", url: `${S}/game`, fromTab: true };

const setupData = (isAdmin: boolean, version = "14.369"): SetupData => ({
  core: { version, generation: 14, build: Number(version.split(".")[1]) },
  isAdmin,
  lang: "en",
  modules: [],
  systems: [],
  worlds: [],
});

async function registered(d: RouterDeps) {
  await route(d, { kind: "register-server", server: `${S}/` }, fromOptions);
}

describe("router: registration (R-1)", () => {
  test("registers from the extension's own page when permission is granted", async () => {
    const d = deps();
    await expect(
      route(d, { kind: "register-server", server: `${S}/` }, fromOptions),
    ).resolves.toEqual({ server: S });
    expect(d.scripting.unregister).toHaveBeenCalledWith(["old"]);
    expect(Object.keys(await d.state.servers())).toEqual([S]);
  });

  test("refuses without the host permission", async () => {
    await expect(
      route(deps(false), { kind: "register-server", server: S }, fromOptions),
    ).rejects.toThrow(/permission/);
  });

  test("refuses registration requested by a web page", async () => {
    const d = deps();
    await registered(d);
    await expect(
      route(d, { kind: "register-server", server: S }, fromSetup),
    ).rejects.toThrow(/Unexpected/);
  });
});

describe("router: sender checks (8.6)", () => {
  test("ignores other extensions and unregistered pages", async () => {
    const d = deps();
    await expect(
      route(d, { kind: "get-state" }, { ...fromSetup, id: "other" }),
    ).rejects.toThrow(/sender/);
    await expect(route(d, { kind: "get-state" }, fromSetup)).rejects.toThrow(
      /unregistered/,
    );
  });

  test("rejects malformed messages", async () => {
    const d = deps();
    await registered(d);
    await expect(
      route(d, { kind: "library-op", op: { op: "nope" } }, fromSetup),
    ).rejects.toThrow();
  });
});

describe("router: admin verification (PR-1, PR-2, PR-3)", () => {
  test("an authenticated Setup page verifies the admin", async () => {
    const d = deps();
    await registered(d);
    const s = (await route(
      d,
      { kind: "setup-seen", data: setupData(true) },
      fromSetup,
    )) as { adminVerified: boolean };
    expect(s.adminVerified).toBe(true);
  });

  test("without verification, library writes and queueing are refused", async () => {
    const d = deps();
    await registered(d);
    await route(d, { kind: "setup-seen", data: setupData(false) }, fromSetup);
    const op = {
      kind: "library-op",
      op: { op: "tag.create", tag: { id: "t", name: "x", color: "#000000" } },
    };
    await expect(route(d, op, fromSetup)).rejects.toThrow(/admin/);
    await expect(
      route(
        d,
        { kind: "queue-apply", worldId: "w", mode: "add", presetIds: ["p"] },
        fromSetup,
      ),
    ).rejects.toThrow(/admin/);
  });

  test("an unknown core version is read-only (safe mode)", async () => {
    const d = deps();
    await registered(d);
    await route(
      d,
      { kind: "setup-seen", data: setupData(true, "15.1") },
      fromSetup,
    );
    await expect(
      route(d, { kind: "library-export" }, fromSetup),
    ).rejects.toThrow(/read-only/);
  });

  test("queue and cancel work once verified", async () => {
    const d = deps();
    await registered(d);
    await route(d, { kind: "setup-seen", data: setupData(true) }, fromSetup);
    await d.state.applyLibraryOp(S, {
      op: "preset.create",
      preset: {
        id: "p",
        name: "P",
        description: "",
        modules: [],
        source: "user",
      },
    });
    const q = (await route(
      d,
      { kind: "queue-apply", worldId: "w", mode: "add", presetIds: ["p"] },
      fromSetup,
    )) as { queued: string };
    await route(d, { kind: "cancel-command", id: q.queued }, fromSetup);
    expect((await d.state.commands(S))[0]?.status).toBe("cancelled");
  });

  test("export and import round-trip", async () => {
    const d = deps();
    await registered(d);
    await route(d, { kind: "setup-seen", data: setupData(true) }, fromSetup);
    const { text } = (await route(
      d,
      { kind: "library-export" },
      fromSetup,
    )) as { text: string };
    const result = (await route(
      d,
      { kind: "library-import", text },
      fromSetup,
    )) as { ok: boolean };
    expect(result.ok).toBe(true);
    expect(
      await route(d, { kind: "library-import", text: "{" }, fromSetup),
    ).toMatchObject({ ok: false });
  });
});

describe("router: game page bridge (PR-7)", () => {
  const hello = makeEnvelope(
    "module",
    "HELLO",
    { moduleVersion: "1", protocol: [1], worldId: "w", coreVersion: "14" },
    "r",
  );

  test("the bridge is off and relays nothing until the admin is verified", async () => {
    const d = deps();
    await registered(d);
    expect(await route(d, { kind: "bridge-init" }, fromGame)).toMatchObject({
      enabled: false,
    });
    await expect(
      route(d, { kind: "relay", msg: hello }, fromGame),
    ).rejects.toThrow();
  });

  test("relays once verified, and only module messages", async () => {
    const d = deps();
    await registered(d);
    await route(d, { kind: "setup-seen", data: setupData(true) }, fromSetup);
    expect(
      await route(d, { kind: "relay", msg: hello }, fromGame),
    ).toMatchObject({ type: "HELLO_ACK" });
    const forged = { ...hello, from: "bridge" };
    await expect(
      route(d, { kind: "relay", msg: forged }, fromGame),
    ).rejects.toThrow();
  });

  test("setup actions are refused from the game page", async () => {
    const d = deps();
    await registered(d);
    await route(d, { kind: "setup-seen", data: setupData(true) }, fromSetup);
    await expect(
      route(d, { kind: "library-export" }, fromGame),
    ).rejects.toThrow(/game page/);
  });
});

describe("router: review fixes", () => {
  test("Setup reporting isAdmin:false revokes verification", async () => {
    const d = deps();
    await registered(d);
    await route(d, { kind: "setup-seen", data: setupData(true) }, fromSetup);
    await route(d, { kind: "setup-seen", data: setupData(false) }, fromSetup);
    expect(await route(d, { kind: "bridge-init" }, fromGame)).toMatchObject({
      enabled: false,
    });
  });

  test("verification expires", async () => {
    const d = deps();
    await registered(d);
    await route(d, { kind: "setup-seen", data: setupData(true) }, fromSetup);
    const later = { ...d, now: () => "2099-01-01T00:00:00.000Z" };
    expect(await route(later, { kind: "bridge-init" }, fromGame)).toMatchObject(
      { enabled: false },
    );
  });

  test("queueing unknown presets is refused", async () => {
    const d = deps();
    await registered(d);
    await route(d, { kind: "setup-seen", data: setupData(true) }, fromSetup);
    await expect(
      route(
        d,
        { kind: "queue-apply", worldId: "w", mode: "add", presetIds: ["nope"] },
        fromSetup,
      ),
    ).rejects.toThrow(/preset/);
  });

  test("lookalike paths are not Setup or game pages", async () => {
    const d = deps();
    await registered(d);
    await expect(
      route(d, { kind: "get-state" }, { ...fromSetup, url: `${S}/setupx` }),
    ).rejects.toThrow(/unexpected page/);
    await expect(
      route(d, { kind: "bridge-init" }, { ...fromGame, url: `${S}/gamex` }),
    ).rejects.toThrow(/unexpected page/);
  });
});
