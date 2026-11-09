// @vitest-environment happy-dom
// The running page's apply flow as a hook (phase 7): it starts once as the
// page opens, asks for the password on a tap and again at once when wrong,
// and Not now leaves the changes queued.
import { cleanup, fireEvent, render, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, test, vi } from "vitest";
import { writeLaunchNote } from "../../src/app/launch-note.ts";
import type { ApplyFlowDeps } from "../../src/app/running/apply-flow.ts";
import type { JoinResult } from "../../src/app/running/server.ts";
import { useApply } from "../../src/app/running/useApply.ts";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

const game = { users: new Map([["g", { id: "g", name: "GM", role: 4 }]]) };

function flowWith(join: ApplyFlowDeps["join"]): ApplyFlowDeps {
  return {
    store: sessionStorage,
    world: { id: "w", title: "Strahd" },
    game: () => game,
    join,
    allowed: vi.fn(() => Promise.resolve(true)),
    start: vi.fn(() => Promise.resolve()),
    go: vi.fn(),
  };
}

function Probe(props: {
  readonly flow: ApplyFlowDeps;
  readonly ask: (q: { wrong: boolean }) => Promise<string | undefined>;
}) {
  const a = useApply(props.flow, props.ask, 0);
  return (
    <div>
      <output>{JSON.stringify(a.view ?? null)}</output>
      <button type="button" onClick={a.password}>
        password
      </button>
      <button type="button" onClick={a.notNow}>
        not now
      </button>
    </div>
  );
}

const shown = (c: Element): unknown =>
  JSON.parse(c.querySelector("output")?.textContent ?? "null");

describe("useApply", () => {
  test("starts once; a wrong password asks again at once; the right one hands over", async () => {
    writeLaunchNote(sessionStorage, "w", 2);
    const join = vi
      .fn<(u: string, p: string) => Promise<JoinResult>>()
      .mockResolvedValueOnce({ kind: "password" })
      .mockResolvedValueOnce({ kind: "password" })
      .mockResolvedValueOnce({ kind: "joined", redirect: "/game" });
    const flow = flowWith(join);
    const ask = vi
      .fn<(q: { wrong: boolean }) => Promise<string | undefined>>()
      .mockResolvedValueOnce("nope")
      .mockResolvedValueOnce("right");
    const r = render(<Probe flow={flow} ask={ask} />);
    await waitFor(() => {
      expect(shown(r.container)).toMatchObject({ kind: "password" });
    });
    fireEvent.click(r.getByRole("button", { name: "password" }));
    await waitFor(() => {
      expect(flow.go).toHaveBeenCalledWith("/game");
    });
    expect(ask.mock.calls.map((c) => c[0].wrong)).toEqual([false, true]);
    expect(join.mock.calls.map((c) => c[1])).toEqual(["", "nope", "right"]);
  });

  test("Not now leaves them queued, said", async () => {
    writeLaunchNote(sessionStorage, "w", 2);
    const flow = flowWith(
      vi.fn(() => Promise.resolve<JoinResult>({ kind: "password" })),
    );
    const r = render(<Probe flow={flow} ask={vi.fn()} />);
    await waitFor(() => {
      expect(shown(r.container)).toMatchObject({ kind: "password" });
    });
    fireEvent.click(r.getByRole("button", { name: "not now" }));
    expect(shown(r.container)).toMatchObject({
      kind: "failed",
      reason: expect.stringContaining("stay queued") as unknown,
    });
  });
});
