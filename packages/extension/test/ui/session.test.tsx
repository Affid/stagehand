// @vitest-environment happy-dom
// The About tab's next session, as the prototype: a date with its time zone
// named, a repeating rule or chosen dates, Skip, and moving the date on.
import type { WorldInfo } from "@stagehand/shared/world";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import {
  addDays,
  type Schedule,
  todayIn,
  zonedToUtc,
} from "../../src/ui/model/schedule.ts";
import { el, renderUi, setupState } from "./harness.tsx";
import {
  BROWSER_TZ,
  dateLabel,
  dayName,
} from "../../src/ui/shell/world/about/session/text.ts";

afterEach(cleanup);

const today = new Date().toISOString().slice(0, 10);
const soon = addDays(today, 4);

const worldOf = (over: Partial<WorldInfo>): WorldInfo => ({
  id: "w1",
  title: "Strahd",
  system: "dnd5e",
  systemVersion: "5.1",
  coreVersion: "14.369",
  ...over,
});

function about(over: Partial<WorldInfo> = {}, more: readonly WorldInfo[] = []) {
  const base = setupState();
  const worlds = [worldOf(over), ...more];
  const r = renderUi("shell", {
    data: { setup: base.setup && { ...base.setup, worlds } },
    state: { route: { kind: "world", worldId: "w1" } },
  });
  fireEvent.click(r.getByRole("tab", { name: /^About/ }));
  const box = (): HTMLElement => el(r.container, ".stw-sess");
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
    expect(box().querySelectorAll(".stw-upcoming li")).toHaveLength(3);
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

const thisYear = Number(todayIn(BROWSER_TZ, Date.now()).slice(0, 4));
const label = (date: string): string => dateLabel(date, thisYear);
const later = addDays(soon, 7);
const chosen: Schedule = {
  start: soon,
  time: "19:00",
  tz: "Europe/Berlin",
  freq: "dates",
  skips: [],
  dates: { [later]: "20:30", [soon]: "19:00" },
};

function edit(over: Partial<WorldInfo>, more: readonly WorldInfo[] = []) {
  const r = about(over, more);
  fireEvent.click(
    within(r.box()).getByRole("button", {
      name: over.schedule
        ? "Change the next session"
        : "Set a date for the next session",
    }),
  );
  return r;
}

describe("the editor's quick times", () => {
  test("hold the times your worlds use, marked You use this time", () => {
    const other = worldOf({
      id: "w2",
      title: "Other",
      schedule: { ...weekly, time: "21:15" },
    });
    const { box } = edit({}, [other]);
    const used = within(box()).getByRole("button", { name: "21:15" });
    expect(used.getAttribute("title")).toBe("You use this time");
    expect(
      within(box())
        .getByRole("button", { name: "18:00" })
        .getAttribute("title"),
    ).toBe(null);
    fireEvent.click(used);
    expect(
      within(box()).getByRole<HTMLSelectElement>("combobox", { name: "Hour" })
        .value,
    ).toBe("21");
  });
});

describe("the editor's summary", () => {
  test("says what players see in their own time", () => {
    const { box } = edit({ schedule: weekly });
    const sum = el(box(), ".sum");
    expect(sum.textContent).toContain(
      "Players see it in their own time, for example",
    );
    expect(sum.textContent).toContain("18:00 London");
    expect(sum.textContent).toContain("New York");
    expect(sum.textContent).toContain("Sydney");
    expect(sum.textContent).toContain("Berlin time");
  });

  test("with no chosen dates it says to click days", () => {
    const { box } = edit({
      schedule: { ...chosen, dates: { [soon]: "19:00" } },
    });
    fireEvent.click(
      within(box()).getByRole("button", { name: `Remove ${label(soon)}` }),
    );
    expect(el(box(), ".sum").textContent).toContain(
      "Click days on the calendar to add them.",
    );
  });
});

describe("chosen dates in the editor", () => {
  test("list each date in order with its own time", () => {
    const { box } = edit({ schedule: chosen });
    const items = [...box().querySelectorAll(".stw-chosen li")];
    expect(items.map((li) => li.querySelector(".d")?.textContent)).toEqual([
      label(soon),
      label(later),
    ]);
    const time = within(box()).getByRole<HTMLInputElement>("textbox", {
      name: `Time on ${label(later)}`,
    });
    expect(time.value).toBe("20:30");
  });

  test("the time row is the usual time, which new dates get", () => {
    const { box } = edit({ schedule: chosen });
    expect(box().textContent).toContain("Usual time");
    expect(box().textContent).toContain(
      "New dates get this time; change any date below.",
    );
  });

  test("a date's own time changes on blur and is saved", async () => {
    const { box, page } = edit({ schedule: chosen });
    const time = within(box()).getByRole("textbox", {
      name: `Time on ${label(soon)}`,
    });
    fireEvent.input(time, { target: { value: "18:45" } });
    fireEvent.blur(time);
    fireEvent.click(within(box()).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(page.saveWorld).toHaveBeenCalledWith(
        "w1",
        expect.objectContaining({
          schedule: expect.objectContaining({
            dates: { [soon]: "18:45", [later]: "20:30" },
          }) as unknown,
        }),
      );
    });
  });

  test("a time that is not HH:MM goes back to the date's time", () => {
    const { box } = edit({ schedule: chosen });
    const time = within(box()).getByRole<HTMLInputElement>("textbox", {
      name: `Time on ${label(soon)}`,
    });
    fireEvent.input(time, { target: { value: "25:99" } });
    fireEvent.blur(time);
    expect(time.value).toBe("19:00");
  });

  test("Remove takes a date out; with none left Save is off", () => {
    const { box } = edit({ schedule: chosen });
    for (const date of [soon, later])
      fireEvent.click(
        within(box()).getByRole("button", { name: `Remove ${label(date)}` }),
      );
    expect(el(box(), ".stw-chosen").textContent).toBe("No dates yet.");
    expect(
      within(box()).getByRole<HTMLButtonElement>("button", { name: "Save" })
        .disabled,
    ).toBe(true);
  });

  test("a date already past is marked", () => {
    const past = addDays(today, -3);
    const { box } = edit({
      schedule: { ...chosen, dates: { ...chosen.dates, [past]: "19:00" } },
    });
    const first = box().querySelector(".stw-chosen li");
    expect(first?.querySelector(".d")?.textContent).toBe(label(past));
    expect(first?.classList.contains("past")).toBe(true);
  });
});

describe("the Repeats row and switching to chosen dates (Phase 6)", () => {
  test("a repeating rule is said under Repeats; chosen dates say to click days", () => {
    const { box } = edit({ schedule: weekly });
    const repeats = within(box()).getByRole("combobox", { name: "Repeats" });
    // The rule in words, as the box's view says it.
    expect(repeats.parentElement?.querySelector(".tzl")?.textContent).toContain(
      "19:00",
    );
    fireEvent.change(repeats, { target: { value: "dates" } });
    expect(
      within(box())
        .getByRole("combobox", { name: "Repeats" })
        .parentElement?.querySelector(".tzl")?.textContent,
    ).toBe("Click days on the calendar to add or remove them.");
  });

  test("switching to chosen dates starts from the rule's next dates", () => {
    const { box } = edit({ schedule: weekly });
    fireEvent.change(within(box()).getByRole("combobox", { name: "Repeats" }), {
      target: { value: "dates" },
    });
    const items = box().querySelectorAll(".stw-chosen li:not(.none)");
    expect(items.length).toBe(4);
  });

  test("Save says Saved on the box", async () => {
    const { box } = edit({ schedule: weekly });
    fireEvent.click(within(box()).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(
        within(box())
          .getAllByRole("status")
          .some((x) => x.textContent === "Saved"),
      ).toBe(true),
    );
  });
});
