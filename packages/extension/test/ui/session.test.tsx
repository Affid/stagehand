// @vitest-environment happy-dom
// The About tab's next session, as the prototype: a date with its time zone
// named, a repeating rule or chosen dates, Skip, and moving the date on.
import type { WorldInfo } from "@module-library/shared/world";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import {
  addDays,
  type Schedule,
  zonedToUtc,
} from "../../src/ui/model/schedule.ts";
import { el, renderUi, setupState } from "./harness.tsx";
import { dayName } from "../../src/ui/shell/world/about/session/text.ts";

afterEach(cleanup);

const today = new Date().toISOString().slice(0, 10);
const soon = addDays(today, 4);

function about(over: Partial<WorldInfo> = {}) {
  const base = setupState();
  const world: WorldInfo = {
    id: "w1",
    title: "Strahd",
    system: "dnd5e",
    systemVersion: "5.1",
    coreVersion: "14.369",
    ...over,
  };
  const r = renderUi("shell", {
    data: { setup: base.setup && { ...base.setup, worlds: [world] } },
    state: { route: { kind: "world", worldId: "w1" } },
  });
  fireEvent.click(r.getByRole("tab", { name: /^About/ }));
  const box = (): HTMLElement => el(r.container, ".mlw-sess");
  return { ...r, box };
}

const weekly: Schedule = {
  start: soon,
  time: "19:00",
  tz: "Europe/Berlin",
  freq: "w1",
  skips: [],
};

describe("the next session", () => {
  test("without one it says so and offers Set a date", () => {
    const { box } = about();
    expect(box().textContent).toContain("No next session set");
    expect(
      within(box()).getByRole("button", {
        name: "Set a date for the next session",
      }),
    );
  });

  test("a schedule shows the next date with its zone, the rule and the next dates", () => {
    const { box } = about({ schedule: weekly });
    const text = box().textContent;
    expect(text).toContain("19:00");
    expect(text).toContain("UTC+");
    expect(text).toMatch(/Every \w+day at 19:00/);
    expect(box().querySelectorAll(".mlw-upcoming li")).toHaveLength(3);
  });

  test("Skip saves the schedule with that date skipped, and moves the next session", async () => {
    const { box, page } = about({ schedule: weekly });
    fireEvent.click(
      within(box()).getAllByRole("button", { name: /^Skip/ })[0]!,
    );
    await waitFor(() => {
      expect(page.saveWorld).toHaveBeenCalledWith("w1", {
        schedule: { ...weekly, skips: [soon] },
        nextSession: new Date(
          zonedToUtc(addDays(soon, 7), "19:00", "Europe/Berlin"),
        ).toISOString(),
      });
    });
  });

  test("set a weekly session: a day, a time, Repeats, Save", async () => {
    const { box, page } = about();
    fireEvent.click(
      within(box()).getByRole("button", {
        name: "Set a date for the next session",
      }),
    );
    fireEvent.click(within(box()).getByRole("button", { name: dayName(soon) }));
    fireEvent.change(within(box()).getByRole("combobox", { name: "Hour" }), {
      target: { value: "20" },
    });
    fireEvent.change(within(box()).getByRole("combobox", { name: "Repeats" }), {
      target: { value: "w1" },
    });
    fireEvent.click(within(box()).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(page.saveWorld).toHaveBeenCalledWith(
        "w1",
        expect.objectContaining({
          schedule: expect.objectContaining({
            start: soon,
            freq: "w1",
            time: expect.stringMatching(/^20:/) as unknown,
          }) as unknown,
        }),
      );
    });
  });

  test("No next session removes the schedule and Foundry's date", async () => {
    const { box, page } = about({ schedule: weekly });
    fireEvent.click(
      within(box()).getByRole("button", { name: "Change the next session" }),
    );
    fireEvent.click(
      within(box()).getByRole("button", { name: "No next session" }),
    );
    await waitFor(() => {
      expect(page.saveWorld).toHaveBeenCalledWith("w1", {
        schedule: null,
        nextSession: null,
      });
    });
  });

  test("Find another time zone searches every zone by city", () => {
    const { box } = about();
    fireEvent.click(
      within(box()).getByRole("button", {
        name: "Set a date for the next session",
      }),
    );
    fireEvent.click(
      within(box()).getByRole("button", { name: "Find another" }),
    );
    fireEvent.input(
      within(box()).getByRole("combobox", { name: "Find a time zone" }),
      {
        target: { value: "Toky" },
      },
    );
    fireEvent.click(within(box()).getByRole("option", { name: /Tokyo/ }));
    expect(box().textContent).toContain("Japan");
  });
});

describe("the time zone search by keyboard (review)", () => {
  test("arrows move through the results, Enter picks one", () => {
    const { box } = about();
    fireEvent.click(
      within(box()).getByRole("button", {
        name: "Set a date for the next session",
      }),
    );
    fireEvent.click(
      within(box()).getByRole("button", { name: "Find another" }),
    );
    const input = within(box()).getByRole("combobox", {
      name: "Find a time zone",
    });
    fireEvent.input(input, { target: { value: "Toky" } });
    const first = input.getAttribute("aria-activedescendant") ?? "";
    expect(
      box().querySelector(`#${first}`)?.getAttribute("aria-selected"),
    ).toBe("true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(box().textContent).toContain("Japan");
  });

  test("Escape goes back to the list of zones", () => {
    const { box } = about();
    fireEvent.click(
      within(box()).getByRole("button", {
        name: "Set a date for the next session",
      }),
    );
    fireEvent.click(
      within(box()).getByRole("button", { name: "Find another" }),
    );
    fireEvent.keyDown(
      within(box()).getByRole("combobox", { name: "Find a time zone" }),
      {
        key: "Escape",
      },
    );
    expect(
      within(box()).getByRole("combobox", { name: "Time zone" }),
    ).toBeTruthy();
  });
});

describe("moving the next session on (review)", () => {
  test("a date still to come is left alone, even off the schedule", async () => {
    const future = new Date(Date.now() + 2 * 864e5).toISOString();
    const { page } = about({ schedule: weekly, nextSession: future });
    await new Promise((r) => setTimeout(r, 50));
    expect(page.saveWorld).not.toHaveBeenCalled();
  });

  test("a locked world is left alone", async () => {
    const past = new Date(Date.now() - 2 * 864e5).toISOString();
    const { page } = about({
      schedule: weekly,
      nextSession: past,
      locked: true,
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(page.saveWorld).not.toHaveBeenCalled();
  });
});

describe("moving the next session on", () => {
  test("when Setup opens, a passed date moves to the schedule's next one", async () => {
    const past = new Date(Date.now() - 2 * 864e5).toISOString();
    const { page } = about({ schedule: weekly, nextSession: past });
    await waitFor(() => {
      expect(page.saveWorld).toHaveBeenCalledWith("w1", {
        nextSession: new Date(
          zonedToUtc(soon, "19:00", "Europe/Berlin"),
        ).toISOString(),
      });
    });
  });
});
