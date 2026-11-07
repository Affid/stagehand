import { describe, expect, test, vi } from "vitest";
import { makeEnvelope } from "@module-library/shared/protocol";
import type { SetupData } from "@module-library/shared/world";
import { BUNDLED_CONFIG } from "../../src/adapters/config.ts";
import { memoryKeyValue, serialized } from "../../src/background/kv.ts";
import type { ScriptingPlatform } from "../../src/background/registration.ts";
import {
  type ContentScript,
  contentScriptsFor,
} from "../../src/background/servers.ts";
import {
  grantedOrigins,
  restoreServers,
  type RouterDeps,
  route,
} from "../../src/background/router.ts";
import { createState } from "../../src/background/state.ts";

const S = "http://localhost:30000";
/** Content scripts per server (servers.ts contentScriptsFor). */
const SCRIPTS = contentScriptsFor(S).length;
const EXT = "chrome-extension://ext/";

function deps(granted = true) {
  const scripting: ScriptingPlatform = {
    hasPermission: vi.fn().mockResolvedValue(granted),
    registeredIds: vi.fn().mockResolvedValue(["old"]),
    unregister: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
    removePermission: vi.fn().mockResolvedValue(undefined),
  };
  let n = 0;
  const d: RouterDeps = {
    state: createState(serialized(memoryKeyValue())),
    scripting,
    releases: {
      permitted: vi.fn().mockResolvedValue(true),
      fetchText: vi.fn().mockResolvedValue("<ol></ol>"),
    },
    openSettings: vi.fn().mockResolvedValue(undefined),
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

/** An installed module, as Setup reports it. */
const installedModule = (id: string) => ({
  id,
  title: id,
  version: "1",
  authors: [],
  library: false,
  hasPacks: false,
  hasCode: true,
  compatibility: {},
  requires: [],
  recommends: [],
  conflicts: [],
  systems: [],
});

const setupData = (isAdmin: boolean, version = "14.369"): SetupData => ({
  core: { version, generation: 14, build: Number(version.split(".")[1]) },
  isAdmin,
  lang: "en",
  modules: [],
  systems: [],
  worlds: [
    {
      id: "w",
      title: "W",
      system: "dnd5e",
      systemVersion: "5",
      coreVersion: "14.369",
    },
  ],
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

  test("a launch hold is set and cleared from Setup once verified", async () => {
    const d = deps();
    await registered(d);
    await route(d, { kind: "setup-seen", data: setupData(true) }, fromSetup);
    await route(
      d,
      { kind: "launch-hold", worldId: "w", hold: true },
      fromSetup,
    );
    expect(await d.state.launchHolds(S)).toEqual([
      { worldId: "w", at: "2026-11-05T00:00:00.000Z" },
    ]);
    await route(
      d,
      { kind: "launch-hold", worldId: "w", hold: false },
      fromSetup,
    );
    expect(await d.state.launchHolds(S)).toEqual([]);
  });

  test("Apply and launch records the reviewed result, installed modules only", async () => {
    const d = deps();
    await registered(d);
    await route(
      d,
      {
        kind: "setup-seen",
        data: { ...setupData(true), modules: [installedModule("a")] },
      },
      fromSetup,
    );
    await route(
      d,
      {
        kind: "launch-hold",
        worldId: "w",
        hold: false,
        reviewed: ["a", "ghost"],
      },
      fromSetup,
    );
    expect(await d.state.launchHolds(S)).toEqual([
      { worldId: "w", at: "2026-11-05T00:00:00.000Z", reviewed: ["a"] },
    ]);
  });

  test("a launch hold needs the verified admin, and only Setup may ask", async () => {
    const d = deps();
    await registered(d);
    await route(d, { kind: "setup-seen", data: setupData(false) }, fromSetup);
    await expect(
      route(d, { kind: "launch-hold", worldId: "w", hold: true }, fromSetup),
    ).rejects.toThrow();
    await expect(
      route(d, { kind: "launch-hold", worldId: "w", hold: true }, fromGame),
    ).rejects.toThrow();
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

  test("modules to turn on are kept only if installed (security review)", async () => {
    const d = deps();
    await registered(d);
    await route(
      d,
      {
        kind: "setup-seen",
        data: { ...setupData(true), modules: [installedModule("a")] },
      },
      fromSetup,
    );
    await route(
      d,
      {
        kind: "queue-apply",
        worldId: "w",
        mode: "add",
        presetIds: [],
        modules: ["a", "ghost"],
      },
      fromSetup,
    );
    expect((await d.state.commands(S))[0]?.payload.modules).toEqual(["a"]);
  });

  test("modules can be queued without a preset; an empty change is refused", async () => {
    const d = deps();
    await registered(d);
    await route(d, { kind: "setup-seen", data: setupData(true) }, fromSetup);
    await route(
      d,
      {
        kind: "queue-apply",
        worldId: "w",
        mode: "remove",
        presetIds: [],
        modules: ["dice-so-nice"],
      },
      fromSetup,
    );
    expect((await d.state.commands(S))[0]?.payload).toEqual({
      mode: "remove",
      presetIds: [],
      modules: ["dice-so-nice"],
    });
    await expect(
      route(
        d,
        { kind: "queue-apply", worldId: "w", mode: "add", presetIds: [] },
        fromSetup,
      ),
    ).rejects.toThrow();
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

describe("router: no page preference any more", () => {
  test("set-pref is refused: the new page is the page", async () => {
    const d = deps();
    await registered(d);
    await route(d, { kind: "setup-seen", data: setupData(true) }, fromSetup);
    await expect(
      route(
        d,
        { kind: "set-pref", key: "newSetupPage", value: true },
        fromSetup,
      ),
    ).rejects.toThrow();
  });
});

describe("router: modules installed since they were last sorted (intake)", () => {
  const mod = (id: string) => ({
    id,
    title: id,
    version: "1",
    authors: [],
    library: false,
    hasPacks: false,
    hasCode: true,
    compatibility: {},
    requires: [],
    recommends: [],
    conflicts: [],
    systems: [],
  });
  const seen = (ids: string[]): SetupData => ({
    ...setupData(true),
    modules: ids.map(mod),
  });
  const fresh = async (d: RouterDeps, ids: string[]): Promise<unknown> =>
    (
      (await route(d, { kind: "setup-seen", data: seen(ids) }, fromSetup)) as {
        fresh: unknown;
      }
    ).fresh;

  test("the first visit counts everything as sorted; later installs are new", async () => {
    const d = deps();
    await registered(d);
    expect(await fresh(d, ["a", "b"])).toEqual([]);
    expect(await fresh(d, ["a", "b", "c"])).toEqual(["c"]);
  });

  test("marking modules sorted clears them; it needs the verified admin", async () => {
    const d = deps();
    await registered(d);
    await fresh(d, ["a"]);
    await fresh(d, ["a", "c", "d"]);
    await route(d, { kind: "modules-sorted", ids: ["c"] }, fromSetup);
    const s = (await route(d, { kind: "get-state" }, fromSetup)) as {
      fresh: string[];
    };
    expect(s.fresh).toEqual(["d"]);
    await route(d, { kind: "setup-seen", data: setupData(false) }, fromSetup);
    await expect(
      route(d, { kind: "modules-sorted", ids: ["d"] }, fromSetup),
    ).rejects.toThrow();
  });
});

describe("router: review fixes (Phase 3)", () => {
  const mod = (id: string) => ({
    id,
    title: id,
    version: "1",
    authors: [],
    library: false,
    hasPacks: false,
    hasCode: true,
    compatibility: {},
    requires: [],
    recommends: [],
    conflicts: [],
    systems: [],
  });
  const seen = (ids: string[], isAdmin = true): SetupData => ({
    ...setupData(isAdmin),
    modules: ids.map(mod),
  });
  const freshOf = async (d: RouterDeps): Promise<unknown> =>
    ((await route(d, { kind: "get-state" }, fromSetup)) as { fresh: unknown })
      .fresh;

  test("only a real admin visit seeds the sorted modules", async () => {
    const d = deps();
    await registered(d);
    await route(d, { kind: "setup-seen", data: seen([], false) }, fromSetup);
    await route(d, { kind: "setup-seen", data: seen(["a", "b"]) }, fromSetup);
    expect(await freshOf(d)).toEqual([]);
  });

  test("sorting keeps only modules that are installed", async () => {
    const d = deps();
    await registered(d);
    await route(d, { kind: "setup-seen", data: seen(["a"]) }, fromSetup);
    await route(
      d,
      { kind: "modules-sorted", ids: ["a", "ghost-1", "ghost-2"] },
      fromSetup,
    );
    expect(await d.state.sortedModules(S)).toEqual(["a"]);
  });

  test("changes and holds for a world Setup doesn't list are refused", async () => {
    const d = deps();
    await registered(d);
    await route(d, { kind: "setup-seen", data: setupData(true) }, fromSetup);
    await expect(
      route(
        d,
        {
          kind: "queue-apply",
          worldId: "nope",
          mode: "add",
          presetIds: [],
          modules: ["a"],
        },
        fromSetup,
      ),
    ).rejects.toThrow(/world/i);
    await expect(
      route(d, { kind: "launch-hold", worldId: "nope", hold: true }, fromSetup),
    ).rejects.toThrow(/world/i);
  });
});

describe("router: Foundry's release pages (package 7)", () => {
  test("Setup reads the list or one release, only with the permission", async () => {
    const d = deps();
    await registered(d);
    expect(await route(d, { kind: "foundry-releases" }, fromSetup)).toEqual({
      permitted: true,
      html: "<ol></ol>",
    });
    await route(d, { kind: "foundry-releases", version: "14.370" }, fromSetup);
    expect(d.releases.fetchText).toHaveBeenLastCalledWith(
      "https://foundryvtt.com/releases/14.370",
    );
    vi.mocked(d.releases.permitted).mockResolvedValue(false);
    expect(await route(d, { kind: "foundry-releases" }, fromSetup)).toEqual({
      permitted: false,
    });
  });

  test("only a plain version reaches the URL", async () => {
    const d = deps();
    await registered(d);
    for (const version of ["../x", "14.370/../../a", "14.370?q", "x.1"])
      await expect(
        route(d, { kind: "foundry-releases", version }, fromSetup),
      ).rejects.toThrow();
    expect(d.releases.fetchText).not.toHaveBeenCalled();
  });

  test("the permission is asked in the settings panel; a game page can't read", async () => {
    const d = deps();
    await registered(d);
    await route(d, { kind: "open-settings" }, fromSetup);
    expect(d.openSettings).toHaveBeenCalled();
    await expect(
      route(d, { kind: "foundry-releases" }, fromGame),
    ).rejects.toThrow();
  });
});

describe("router: news read state (Phase 6)", () => {
  const article = (n: string) => ({
    title: n,
    url: `https://foundryvtt.com/article/${n}/`,
  });
  const withNews = (names: string[], featured?: string): SetupData => ({
    ...setupData(true),
    news: names.map(article),
    ...(featured ? { featured: article(featured) } : {}),
  });
  const unread = async (d: RouterDeps, data: SetupData): Promise<unknown> =>
    (
      (await route(d, { kind: "setup-seen", data }, fromSetup)) as {
        newsUnread: unknown;
      }
    ).newsUnread;
  const url = (n: string) => article(n).url;

  test("nothing is new on the first visit; a later article is", async () => {
    const d = deps();
    await registered(d);
    expect(await unread(d, withNews(["a", "b"], "f"))).toEqual([]);
    expect(await unread(d, withNews(["c", "a", "b"], "g"))).toEqual([
      url("c"),
      url("g"),
    ]);
  });

  test("a visit without news seeds nothing, so the first news isn't new", async () => {
    const d = deps();
    await registered(d);
    expect(await unread(d, setupData(true))).toEqual([]);
    expect(await unread(d, withNews(["a"]))).toEqual([]);
  });

  test("marking news seen clears only articles Setup listed", async () => {
    const d = deps();
    await registered(d);
    await unread(d, withNews(["a"]));
    await unread(d, withNews(["b", "a"], "f"));
    await route(
      d,
      { kind: "news-seen", urls: [url("b"), url("f"), url("ghost")] },
      fromSetup,
    );
    const s = (await route(d, { kind: "get-state" }, fromSetup)) as {
      newsUnread: string[];
    };
    expect(s.newsUnread).toEqual([]);
    // An article that was never listed was not remembered.
    expect(await d.state.newsSeen(S)).not.toContain(url("ghost"));
  });

  test("news-seen is refused from a world's page and when too long", async () => {
    const d = deps();
    await registered(d);
    await expect(
      route(d, { kind: "news-seen", urls: [url("a")] }, fromGame),
    ).rejects.toThrow();
    await expect(
      route(
        d,
        {
          kind: "news-seen",
          urls: Array.from({ length: 50 }, (_, i) => url(`x${i}`)),
        },
        fromSetup,
      ),
    ).rejects.toThrow();
  });

  test("the remembered list stays bounded", async () => {
    const d = deps();
    await registered(d);
    for (let round = 0; round < 12; round++) {
      const names = Array.from({ length: 20 }, (_, i) => `r${round}-${i}`);
      await unread(d, withNews(names));
      await route(
        d,
        { kind: "news-seen", urls: names.map((n) => url(n)) },
        fromSetup,
      );
    }
    expect((await d.state.newsSeen(S))?.length).toBeLessThanOrEqual(200);
  });
});

describe("router: the settings panel lists and removes servers", () => {
  const other = "http://localhost:30000/other";

  test("lists the registered servers, oldest first", async () => {
    const d = deps();
    await registered(d);
    await route(
      d,
      { kind: "register-server", server: "http://h:1" },
      fromOptions,
    );
    const r = (await route(d, { kind: "list-servers" }, fromOptions)) as {
      servers: { id: string }[];
    };
    expect(r.servers.map((x) => x.id)).toEqual([S, "http://h:1"]);
  });

  test("removing unregisters its scripts and gives the host permission back", async () => {
    const d = deps();
    await registered(d);
    vi.mocked(d.scripting.registeredIds).mockResolvedValue(["ml-setup-main-x"]);
    await route(d, { kind: "remove-server", server: S }, fromOptions);
    expect(d.scripting.unregister).toHaveBeenLastCalledWith([
      "ml-setup-main-x",
    ]);
    expect(d.scripting.removePermission).toHaveBeenCalledWith(
      "http://localhost:30000/*",
    );
    expect(await d.state.servers()).toEqual({});
  });

  test("the permission stays while another server shares the origin", async () => {
    const d = deps();
    await registered(d);
    await route(d, { kind: "register-server", server: other }, fromOptions);
    await route(d, { kind: "remove-server", server: S }, fromOptions);
    expect(d.scripting.removePermission).not.toHaveBeenCalled();
    expect(Object.keys(await d.state.servers())).toEqual([other]);
  });

  test("only the extension's own pages list or remove; Setup can only open the panel", async () => {
    const d = deps();
    await registered(d);
    await expect(
      route(d, { kind: "list-servers" }, fromSetup),
    ).rejects.toThrow();
    await expect(
      route(d, { kind: "remove-server", server: S }, fromSetup),
    ).rejects.toThrow();
    await expect(
      route(d, { kind: "open-settings" }, fromGame),
    ).rejects.toThrow();
    expect(Object.keys(await d.state.servers())).toEqual([S]);
  });

  test("removing a server that isn't registered changes nothing", async () => {
    const d = deps();
    await registered(d);
    await route(
      d,
      { kind: "remove-server", server: "http://nope:1" },
      fromOptions,
    );
    expect(d.scripting.removePermission).not.toHaveBeenCalled();
    expect(Object.keys(await d.state.servers())).toEqual([S]);
  });
});

describe("router: a server being added finishes in the background (code review)", () => {
  test("once its site is allowed, a server the panel was adding is registered", async () => {
    const d = deps();
    await route(d, { kind: "adding-server", server: `${S}/` }, fromOptions);
    const done = await grantedOrigins(d, ["http://localhost:30000/*"]);
    expect(done).toEqual([S]);
    expect(Object.keys(await d.state.servers())).toEqual([S]);
    // Once only.
    expect(await grantedOrigins(d, ["http://localhost:30000/*"])).toEqual([]);
  });

  test("another site's permission registers nothing; a page can't announce one", async () => {
    const d = deps();
    await route(d, { kind: "adding-server", server: S }, fromOptions);
    expect(await grantedOrigins(d, ["https://foundryvtt.com/*"])).toEqual([]);
    await registered(d);
    await expect(
      route(d, { kind: "adding-server", server: "http://evil:1" }, fromSetup),
    ).rejects.toThrow();
  });
});

describe("router: registrations run one at a time", () => {
  test("the panel's add and the background's finishing it don't clash", async () => {
    const d = deps();
    const live = new Set<string>();
    d.scripting.registeredIds = vi.fn((ids: readonly string[]) =>
      Promise.resolve(ids.filter((id) => live.has(id))),
    );
    d.scripting.unregister = vi.fn((ids: readonly string[]) => {
      ids.forEach((id) => live.delete(id));
      return Promise.resolve();
    });
    d.scripting.register = vi.fn(async (scripts: readonly ContentScript[]) => {
      await Promise.resolve();
      for (const sc of scripts) {
        if (live.has(sc.id)) throw new Error(`Duplicate script ID ${sc.id}`);
        live.add(sc.id);
      }
    });
    await route(d, { kind: "adding-server", server: S }, fromOptions);
    await expect(
      Promise.all([
        grantedOrigins(d, ["http://localhost:30000/*"]),
        route(d, { kind: "register-server", server: S }, fromOptions),
      ]),
    ).resolves.toBeTruthy();
    expect(Object.keys(await d.state.servers())).toEqual([S]);
  });
});

describe("router: servers come back after an update or reload (owner's bug)", () => {
  /** Scripts the browser holds, as Chrome keeps them. */
  function liveScripts(d: RouterDeps, granted: (o: string) => boolean) {
    const live = new Set<string>();
    d.scripting.hasPermission = vi.fn((o: string) =>
      Promise.resolve(granted(o)),
    );
    d.scripting.registeredIds = vi.fn((ids: readonly string[]) =>
      Promise.resolve(ids.filter((id) => live.has(id))),
    );
    d.scripting.unregister = vi.fn((ids: readonly string[]) => {
      ids.forEach((id) => live.delete(id));
      return Promise.resolve();
    });
    d.scripting.register = vi.fn((scripts: readonly ContentScript[]) => {
      scripts.forEach((sc) => live.add(sc.id));
      return Promise.resolve();
    });
    return live;
  }

  test("a saved server whose scripts the browser dropped gets them back; one no longer allowed stays off", async () => {
    const d = deps();
    const live = liveScripts(d, (o) => o === "http://localhost:30000/*");
    await registered(d);
    await route(
      d,
      { kind: "register-server", server: "http://h:1" },
      fromOptions,
    ).catch(() => undefined);
    await d.state.addServer("http://h:1", "t");
    live.clear(); // Chrome dropped them on the update.
    await restoreServers(d);
    expect([...live].filter((id) => id.includes("localhost"))).toHaveLength(
      SCRIPTS,
    );
    expect([...live].filter((id) => id.includes("h_1"))).toHaveLength(0);
  });

  test("one server failing doesn't keep the others off (code review)", async () => {
    const d = deps();
    const live = liveScripts(d, () => true);
    await registered(d);
    await d.state.addServer("http://h:1", "t");
    live.clear();
    const register = vi.mocked(d.scripting.register).getMockImplementation();
    d.scripting.register = vi.fn((scripts: readonly ContentScript[]) =>
      scripts[0]?.id.includes("localhost")
        ? Promise.reject(new Error("broken"))
        : (register?.(scripts) ?? Promise.resolve()),
    );
    await restoreServers(d);
    expect([...live].filter((id) => id.includes("h_1"))).toHaveLength(SCRIPTS);
  });

  test("a server removed while the restore waits isn't brought back (code review)", async () => {
    const d = deps();
    const live = liveScripts(d, () => true);
    await registered(d);
    await d.state.addServer("http://localhost:30000/b", "t");
    live.clear();
    const restoring = restoreServers(d);
    await route(
      d,
      { kind: "remove-server", server: "http://localhost:30000/b" },
      fromOptions,
    );
    await restoring;
    expect([...live].filter((id) => id.includes("_b"))).toHaveLength(0);
    expect([...live].filter((id) => !id.includes("_b"))).toHaveLength(SCRIPTS);
  });

  test("the list says which servers are really on", async () => {
    const d = deps();
    const live = liveScripts(d, (o) => o === "http://localhost:30000/*");
    await registered(d);
    await d.state.addServer("http://h:1", "t");
    let r = (await route(d, { kind: "list-servers" }, fromOptions)) as {
      servers: { id: string; active: boolean }[];
    };
    expect(r.servers.map((x) => [x.id, x.active])).toEqual([
      [S, true],
      ["http://h:1", false],
    ]);
    live.clear();
    r = (await route(d, { kind: "list-servers" }, fromOptions)) as typeof r;
    expect(r.servers[0]?.active).toBe(false);
  });
});
