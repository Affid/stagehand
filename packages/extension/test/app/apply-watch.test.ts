// Applying out of sight (phase 7): what the companion's report in the
// world's flags says about this launch's changes.
import type { Report } from "@stagehand/shared/world-flags";
import { describe, expect, test } from "vitest";
import { watchStep } from "../../src/app/apply-watch.ts";

const note = { launchId: "l1", ids: ["c1", "c2"], acked: false };

const flags = (over: Partial<Report> = {}) => ({
  v: 1,
  report: {
    at: "2026-11-09T20:00:00.000Z",
    companion: "0.2.0",
    core: "14.370",
    system: { id: "dnd5e", version: "6.0.6" },
    active: [],
    versions: true,
    partial: false,
    launchId: "l1",
    results: [],
    ...over,
  },
});

describe("watchStep", () => {
  test("a report of another launch, or none yet: waiting", () => {
    expect(watchStep(note, undefined)).toEqual({ acked: false });
    expect(watchStep(note, flags({ launchId: "l0" }))).toEqual({
      acked: false,
    });
    expect(
      watchStep({ ...note, acked: true }, flags({ launchId: null })),
    ).toEqual({ acked: true });
  });

  test("taken up: applying, the world about to reload", () => {
    const step = watchStep(
      note,
      flags({
        results: [
          { id: "c1", status: "applying", targetKey: "k" },
          { id: "c2", status: "applying", targetKey: "k" },
        ],
      }),
    );
    expect(step).toEqual({ acked: true });
  });

  test("applied after the reload: done", () => {
    const step = watchStep(
      { ...note, acked: true },
      flags({
        results: [
          { id: "c1", status: "applied" },
          { id: "c2", status: "applied" },
          { id: "other", status: "failed", error: "not ours" },
        ],
      }),
    );
    expect(step.event).toEqual({ kind: "done" });
  });

  test("failed: the companion's reason", () => {
    const step = watchStep(
      note,
      flags({ results: [{ id: "c1", status: "failed", error: "disk full" }] }),
    );
    expect(step.event).toEqual({ kind: "failed", reason: "disk full" });
  });

  test("failed without a reason, or discarded in the dialog, says so", () => {
    expect(
      watchStep(note, flags({ results: [{ id: "c1", status: "failed" }] }))
        .event,
    ).toMatchObject({
      kind: "failed",
      reason: expect.stringMatching(/didn't say/) as unknown,
    });
    expect(
      watchStep(note, flags({ results: [{ id: "c2", status: "declined" }] }))
        .event,
    ).toMatchObject({
      kind: "failed",
      reason: expect.stringMatching(/discarded/) as unknown,
    });
  });

  test("this launch's report, but none of our changes: nothing was applied", () => {
    expect(watchStep(note, flags()).event).toMatchObject({
      kind: "failed",
      reason: expect.stringMatching(/no longer queued/) as unknown,
    });
  });

  test("a note without the launch's intent never matches", () => {
    expect(watchStep({ acked: false }, flags())).toEqual({ acked: false });
  });
});
