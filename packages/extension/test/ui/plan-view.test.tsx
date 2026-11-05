// @vitest-environment happy-dom
import type { Plan } from "@module-library/shared/resolver";
import { cleanup, fireEvent, render } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { createActions, type Send } from "../../src/ui/actions.ts";
import { UiContext } from "../../src/ui/context.ts";
import { createTranslator } from "../../src/ui/i18n.ts";
import { createStore } from "../../src/ui/store.ts";
import { PlanDiff, PlanSummary } from "../../src/ui/worlds/PlanView.tsx";
import { fakePage, uiState } from "./harness.tsx";

afterEach(cleanup);

const plan = (over: Partial<Plan> = {}): Plan => ({
  start: ["module-library", "b"],
  target: ["module-library", "a"],
  enable: ["a"],
  disable: ["b"],
  changed: true,
  dependencyAdditions: [],
  missing: ["ghost"],
  blocked: [{ id: "c", reason: "missing-requirement", detail: ["lib"] }],
  incompatible: [{ id: "old", reason: "core" }],
  conflicts: [{ id: "a", with: "b" }],
  dependents: [{ id: "b", requiredBy: ["a"] }],
  ...over,
});

function show(p: Plan) {
  const t = createTranslator("en");
  const store = createStore(uiState());
  const { page } = fakePage();
  const send = (() => Promise.resolve()) as unknown as Send;
  const deps = { store, actions: createActions(store, send, t, page), t, page };
  return render(
    <UiContext.Provider value={deps}>
      <PlanSummary plan={p} />
      <PlanDiff plan={p} />
    </UiContext.Provider>,
  );
}

describe("plan diff (P-4)", () => {
  test("problems come first, worded with titles", () => {
    const { getAllByRole, getByText } = show(plan());
    const lines = getAllByRole("listitem").map((li) => li.textContent);
    expect(lines.slice(0, 5)).toEqual([
      "Conflict: Title a conflicts with Title b",
      "Not installed, skipped: ghost",
      "Blocked: Title c needs lib",
      "Incompatible, skipped: old (core version)",
      "Still needed: Title b is needed by Title a",
    ]);
    expect(getByText("5 to check")).toBeTruthy();
    expect(getByText("1 disable")).toBeTruthy();
  });

  test("long groups collapse behind Show more", () => {
    const many = Array.from({ length: 11 }, (_, i) => `m${String(i)}`);
    const { getByRole, queryAllByText } = show(
      plan({
        enable: many,
        missing: [],
        blocked: [],
        incompatible: [],
        conflicts: [],
        dependents: [],
      }),
    );
    expect(queryAllByText("m10")).toHaveLength(0);
    fireEvent.click(getByRole("button", { name: "Show 3 more" }));
    expect(queryAllByText("m10")).toHaveLength(2);
  });
});
