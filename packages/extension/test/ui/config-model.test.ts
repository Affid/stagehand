// What a Configuration save sends (package 7 review).
import { describe, expect, test } from "vitest";
import type { Settings } from "../../src/page-config.ts";
import {
  changesOf,
  problemsOf,
} from "../../src/ui/shell/server/config/model.ts";

const SAVED = {
  port: 30000,
  unixSocket: "/run/foundry.sock",
  dataPath: "/data",
  sslCert: null,
  sslKey: null,
} as unknown as Settings;

describe("a save", () => {
  test("a port that isn't one is left out, even when a socket makes it no problem", () => {
    const typed = { port: "30x", telemetry: true };
    expect(problemsOf(SAVED, typed).has("port")).toBe(false);
    expect(changesOf(SAVED, typed)).toEqual({ telemetry: true });
  });

  test("without a socket, a bad port is a problem that stops the save", () => {
    const saved = { ...SAVED, unixSocket: null } as Settings;
    expect(problemsOf(saved, { port: "70000" }).has("port")).toBe(true);
  });
});
