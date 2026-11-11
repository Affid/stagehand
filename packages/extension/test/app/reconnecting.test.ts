// @vitest-environment happy-dom
// The app's small "Reconnecting…" sign while Foundry has lost its
// connection and is trying again (owner, 2026-11-11).
import { afterEach, describe, expect, test } from "vitest";
import { showReconnecting } from "../../src/app/reconnecting.ts";

const LOST =
  "You have lost connection to the server, attempting to re-establish.";
const BACK = "Foundry VTT | Server connection re-established.";
const GONE = "Foundry VTT | Server connection lost.";
const WAIT_MS = 30;

let nextId = 1;
function raise(text: string): void {
  const li = document.createElement("li");
  li.className = "notification error";
  li.dataset.id = String(nextId++);
  li.textContent = text;
  document.getElementById("notifications")?.append(li);
}

function start(): () => void {
  const ol = document.createElement("ol");
  ol.id = "notifications";
  document.body.append(ol);
  const notifications = {
    remove(id: number): void {
      ol.querySelector(`[data-id="${String(id)}"]`)?.remove();
    },
  };
  return showReconnecting({
    page: { ui: { notifications } },
    doc: document,
    win: window,
    label: "Reconnecting…",
    showAfterMs: WAIT_MS,
  });
}

const sign = (): HTMLElement | null =>
  document.getElementById("st-reconnecting");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(() => {
  document.body.replaceChildren();
});

describe("showReconnecting", () => {
  test("a lost connection shows the sign after a moment, said to screen readers", async () => {
    const stop = start();
    raise(LOST);
    await sleep(WAIT_MS / 3);
    expect(sign()).toBeNull();
    await sleep(WAIT_MS * 2);
    expect(sign()?.textContent).toBe("Reconnecting…");
    expect(sign()?.getAttribute("role")).toBe("status");
    expect(document.querySelectorAll("#notifications li")).toHaveLength(0);
    stop();
  });

  test("a connection back within the moment never shows it", async () => {
    const stop = start();
    raise(LOST);
    await sleep(WAIT_MS / 3);
    raise(BACK);
    await sleep(WAIT_MS * 2);
    expect(sign()).toBeNull();
    stop();
  });

  test("the sign goes when the connection is back, and comes again on the next loss", async () => {
    const stop = start();
    raise(LOST);
    await sleep(WAIT_MS * 2);
    expect(sign()).not.toBeNull();
    raise(BACK);
    await sleep(WAIT_MS / 3);
    expect(sign()).toBeNull();
    raise(LOST);
    await sleep(WAIT_MS * 2);
    expect(document.querySelectorAll("#st-reconnecting")).toHaveLength(1);
    stop();
  });

  test("it goes when Foundry gives up: native's screen says the rest", async () => {
    const stop = start();
    raise(LOST);
    await sleep(WAIT_MS * 2);
    raise(GONE);
    await sleep(WAIT_MS / 3);
    expect(sign()).toBeNull();
    stop();
  });

  test("stopping takes the sign away and a pending one never comes", async () => {
    const stop = start();
    raise(LOST);
    await sleep(WAIT_MS / 3);
    stop();
    await sleep(WAIT_MS * 2);
    expect(sign()).toBeNull();
  });
});
