import { describe, expect, test } from "vitest";
import { browserApiCalls } from "../../src/app/bundle-check.ts";

describe("the app bundle check: no extension APIs in the app", () => {
  test("finds chrome.* and browser.* API use, with its line", () => {
    const code = [
      "const a = 1;",
      "await chrome.storage.local.get(key);",
      "browser.runtime.sendMessage(m);",
      "globalThis.chrome?.runtime;",
      "chrome . permissions.contains(x);",
    ].join("\n");
    expect(browserApiCalls(code)).toEqual([
      "2: chrome.storage",
      "3: browser.runtime",
      "4: globalThis.chrome?.runtime",
      "5: chrome . permissions",
    ]);
  });

  test("ignores words that only look alike", () => {
    const code = [
      "// opens in the browser. Then it reloads",
      'const label = "Chrome";',
      "const chromeless = x.chrome;",
      "myChrome.runtime();",
    ].join("\n");
    expect(browserApiCalls(code)).toEqual([]);
  });
});
