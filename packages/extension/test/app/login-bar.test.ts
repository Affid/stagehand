// @vitest-environment happy-dom
// The bar over Foundry's admin login (owner, 2026-11-09): back to the app's
// servers without the password.
import { afterEach, describe, expect, test } from "vitest";
import { addLoginBar } from "../../src/app/login-bar.ts";

const HOME = "https://appassets.androidplatform.net/home.html";

afterEach(() => {
  document.body.replaceChildren();
  document.getElementById("ml-login-style")?.remove();
});

describe("addLoginBar", () => {
  test("a link to the servers and which server this is", () => {
    addLoginBar(document, "http://192.168.178.25:30000", HOME);
    const bar = document.getElementById("ml-login-bar");
    const link = bar?.querySelector("a");
    expect(link?.getAttribute("href")).toBe(HOME);
    expect(link?.textContent).toContain("Servers");
    expect(bar?.textContent).toContain("192.168.178.25:30000");
    expect(bar?.querySelector(".ml-plain")).not.toBeNull();
    expect(document.getElementById("ml-login-style")).not.toBeNull();
  });

  test("https servers have no plain-http mark; it comes once", () => {
    addLoginBar(document, "https://vtt.example.com/foundry", HOME);
    addLoginBar(document, "https://vtt.example.com/foundry", HOME);
    expect(document.querySelectorAll("#ml-login-bar")).toHaveLength(1);
    expect(document.querySelector("#ml-login-bar .ml-plain")).toBeNull();
    expect(document.getElementById("ml-login-bar")?.textContent).toContain(
      "vtt.example.com/foundry",
    );
  });
});
