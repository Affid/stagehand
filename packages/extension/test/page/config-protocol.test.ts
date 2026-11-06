import { describe, expect, test } from "vitest";
import { parseConfigReply, parseConfigRequest } from "../../src/page-config.ts";

describe("CONFIG requests are checked (package 7)", () => {
  test("read; save known settings, maybe with a new password; check a password; certificates", () => {
    expect(parseConfigRequest({ requestId: "r1", op: "read" })).toEqual({
      requestId: "r1",
      op: "read",
      changes: {},
    });
    expect(
      parseConfigRequest({
        requestId: "r1",
        op: "save",
        changes: { port: 30001, sslCert: "c.pem" },
        password: "pw",
      }),
    ).toEqual({
      requestId: "r1",
      op: "save",
      changes: { port: 30001, sslCert: "c.pem" },
      password: "pw",
    });
    expect(
      parseConfigRequest({ requestId: "r1", op: "save", password: "pw" })?.op,
    ).toBe("save");
    expect(
      parseConfigRequest({
        requestId: "r1",
        op: "checkPassword",
        password: "pw",
      })?.password,
    ).toBe("pw");
    expect(
      parseConfigRequest({ requestId: "r1", op: "generateCertificate" })?.op,
    ).toBe("generateCertificate");
  });

  test("refuses fields Foundry's window doesn't edit, wrong types, empty saves and stray passwords", () => {
    for (const bad of [
      { requestId: "r1", op: "save", changes: { hostname: "x" } },
      { requestId: "r1", op: "save", changes: { proxySSL: true } },
      { requestId: "r1", op: "save", changes: { port: 0 } },
      { requestId: "r1", op: "save", changes: {} },
      { requestId: "r1", op: "save", changes: { adminPassword: "pw" } },
      { requestId: "r1", op: "read", password: "pw" },
      { requestId: "r1", op: "checkPassword" },
      { requestId: "r1", op: "checkPassword", password: "" },
      { requestId: "r1", op: "generateCertificate", changes: { port: 1 } },
      { requestId: "r1", op: "drop" },
    ])
      expect(parseConfigRequest(bad)).toBeUndefined();
  });
});

describe("CONFIG_DONE is checked", () => {
  test("only known settings and read-only facts; the small answers typed", () => {
    expect(
      parseConfigReply({
        requestId: "r1",
        passwordOk: true,
        method: "self-signed",
        reason: "no port 80",
      }),
    ).toEqual({
      requestId: "r1",
      passwordOk: true,
      method: "self-signed",
      reason: "no port 80",
    });
    expect(
      parseConfigReply({ requestId: "r1", passwordOk: "yes" }),
    ).toBeUndefined();
    expect(
      parseConfigReply({
        requestId: "r1",
        settings: { adminPassword: "hash" },
        choices: {},
      }),
    ).toBeUndefined();
  });
});
