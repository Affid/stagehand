// Fakes for Foundry's client objects, for unit tests.
import { vi } from "vitest";
import type {
  DialogV2,
  FoundryGame,
  FoundryModule,
  FoundryUser,
} from "../src/foundry.ts";

interface FakeModuleData {
  readonly id: string;
  readonly active?: boolean;
  readonly requires?: readonly string[];
  readonly conflicts?: readonly string[];
  readonly compatibility?: Record<string, string>;
}

/** Shaped like a live Foundry Module: relationships are Sets. */
function fakeModule(
  m: FakeModuleData,
): FoundryModule & Record<string, unknown> {
  return {
    id: m.id,
    title: m.id,
    active: m.active ?? false,
    version: "1.0.0",
    compatibility: m.compatibility ?? { minimum: "13", verified: "14" },
    relationships: {
      requires: new Set(
        (m.requires ?? []).map((id) => ({ id, type: "module" })),
      ),
      conflicts: new Set(
        (m.conflicts ?? []).map((id) => ({ id, type: "module" })),
      ),
      recommends: new Set(),
      systems: new Set(),
    },
  };
}

export function fakeGame(
  modules: readonly FakeModuleData[],
  role = 4,
  users: readonly FoundryUser[] = [{ id: "u1", role, active: true }],
) {
  const settings = new Map<string, unknown>();
  const set = vi.fn((ns: string, key: string, value: unknown) => {
    settings.set(`${ns}.${key}`, value);
    return Promise.resolve(value);
  });
  const game: FoundryGame = {
    user: { id: "u1", role },
    users,
    world: { id: "w1", title: "World One" },
    system: { id: "dnd5e", version: "5.1.0" },
    release: { generation: 14, build: 369 },
    modules: new Map(modules.map((m) => [m.id, fakeModule(m)])),
    settings: {
      get: (ns, key) => settings.get(`${ns}.${key}`),
      set,
      register: vi.fn(),
    },
    i18n: { localize: (key) => key, format: (key) => key },
  };
  return { game, set };
}

/** A dialog whose `wait` returns `result`, or calls the apply callback. */
export function fakeDialog(
  result: unknown,
  form: Record<string, boolean> = {},
) {
  const wait = vi.fn((options: Parameters<DialogV2["wait"]>[0]) => {
    if (result !== "apply") return Promise.resolve(result);
    const elements = {
      namedItem: (name: string) =>
        name in form ? { checked: form[name] } : null,
    };
    const button = { form: { elements } } as unknown as HTMLButtonElement;
    const apply = options.buttons.find((b) => b.action === "apply");
    return Promise.resolve(apply?.callback?.(new Event("click"), button));
  });
  return { dialog: { wait } as DialogV2, wait };
}
