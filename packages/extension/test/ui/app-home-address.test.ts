// The home screen's address field: the protocol from a toggle, a pasted
// whole address picking it, and what counts as a server address.
import { describe, expect, test } from "vitest";
import {
  hostOf,
  letterOf,
  readTyped,
  serverOf,
  typedOf,
} from "../../src/ui/app-home/address.ts";
import { createBackStack } from "../../src/ui/app-home/back.ts";

describe("readTyped", () => {
  test("text without a protocol keeps the toggle", () => {
    expect(readTyped("192.168.1.20:30000", "https")).toEqual({
      scheme: "https",
      rest: "192.168.1.20:30000",
    });
  });

  test("a pasted http:// or https:// address sets the toggle", () => {
    expect(readTyped("HTTPS://vtt.example.com", "http")).toEqual({
      scheme: "https",
      rest: "vtt.example.com",
    });
    expect(readTyped(" http://10.0.2.2:30000/", "https")).toEqual({
      scheme: "http",
      rest: "10.0.2.2:30000/",
    });
  });
});

describe("serverOf", () => {
  test("names a server id: no trailing slash, the route prefix kept", () => {
    expect(serverOf({ scheme: "http", rest: " 192.168.1.20:30000/ " })).toBe(
      "http://192.168.1.20:30000",
    );
    expect(serverOf({ scheme: "https", rest: "vtt.example.com/foundry" })).toBe(
      "https://vtt.example.com/foundry",
    );
  });

  test("names none while empty, with another protocol, or not an address", () => {
    expect(serverOf({ scheme: "http", rest: "" })).toBeUndefined();
    expect(serverOf({ scheme: "http", rest: "ftp://x" })).toBeUndefined();
    expect(serverOf({ scheme: "http", rest: "a b" })).toBeUndefined();
    expect(serverOf({ scheme: "http", rest: "h/*" })).toBeUndefined();
  });
});

describe("labels", () => {
  test("a saved server back in the field, its host and letter", () => {
    expect(typedOf("https://vtt.example.com/foundry")).toEqual({
      scheme: "https",
      rest: "vtt.example.com/foundry",
    });
    expect(hostOf("http://localhost:30000")).toBe("localhost:30000");
    expect(letterOf(" friday")).toBe("F");
    expect(letterOf("")).toBe("?");
  });
});

describe("the Back stack", () => {
  test("closes the latest sheet first; a taken-off closer is skipped", () => {
    const stack = createBackStack();
    const closed: string[] = [];
    stack.push(() => closed.push("a"));
    const off = stack.push(() => closed.push("b"));
    off();
    expect(stack.press()).toBe(true);
    expect(closed).toEqual(["a"]);
  });
});
