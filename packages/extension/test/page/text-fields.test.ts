// @vitest-environment happy-dom
// Text fields on Foundry's pages in the app (owner, 2026-11-09): the long
// press menu (Paste) that Foundry's document-wide contextmenu block hid,
// and the hints password managers fill by.
import { afterEach, describe, expect, test, vi } from "vitest";
import { allowTextMenus, hintPasswords } from "../../src/page/text-fields.ts";

afterEach(() => {
  document.body.replaceChildren();
});

/** Foundry's game.mjs: document.addEventListener("contextmenu", e => e.preventDefault()). */
function foundryBlocksMenus(): () => void {
  const block = (e: Event): void => {
    e.preventDefault();
  };
  document.addEventListener("contextmenu", block);
  return () => {
    document.removeEventListener("contextmenu", block);
  };
}

const menuOn = (el: Element): boolean =>
  el.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
  );

describe("allowTextMenus", () => {
  test("a text field's long-press menu comes back; elsewhere Foundry's block stays", () => {
    const unblock = foundryBlocksMenus();
    const stop = allowTextMenus(window);
    try {
      document.body.innerHTML = `
        <input id="pw" type="password">
        <textarea id="t"></textarea>
        <div id="ce" contenteditable="true"><span id="in">x</span></div>
        <canvas id="board"></canvas>`;
      expect(menuOn(document.getElementById("pw")!)).toBe(true);
      expect(menuOn(document.getElementById("t")!)).toBe(true);
      expect(menuOn(document.getElementById("in")!)).toBe(true);
      expect(menuOn(document.getElementById("board")!)).toBe(false);
    } finally {
      stop();
      unblock();
    }
  });

  test("an event on the document itself is left to Foundry", () => {
    const unblock = foundryBlocksMenus();
    const stop = allowTextMenus(window);
    try {
      expect(
        document.dispatchEvent(
          new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
        ),
      ).toBe(false);
    } finally {
      stop();
      unblock();
    }
  });

  test("buttons and checkboxes aren't text fields", () => {
    const unblock = foundryBlocksMenus();
    const stop = allowTextMenus(window);
    try {
      document.body.innerHTML = `<input id="c" type="checkbox"><button id="b">B</button>`;
      expect(menuOn(document.getElementById("c")!)).toBe(false);
      expect(menuOn(document.getElementById("b")!)).toBe(false);
    } finally {
      stop();
      unblock();
    }
  });
});

describe("hintPasswords", () => {
  test("Foundry's admin and join passwords say what they are", () => {
    document.body.innerHTML = `
      <form><input type="password" name="adminPassword"></form>
      <form id="join-game-form"><select name="userId"></select><input type="password" name="password"></form>
      <input type="password" name="other">`;
    hintPasswords(document);
    const auto = (sel: string) =>
      document.querySelector(sel)?.getAttribute("autocomplete");
    expect(auto('input[name="adminPassword"]')).toBe("current-password");
    expect(auto('#join-game-form input[name="password"]')).toBe(
      "current-password",
    );
    expect(auto('input[name="other"]')).toBeNull();
  });

  test("fields that come later get it too", async () => {
    const stop = hintPasswords(document);
    const input = document.createElement("input");
    input.type = "password";
    input.name = "adminPassword";
    document.body.append(input);
    await vi.waitFor(() => {
      expect(input.getAttribute("autocomplete")).toBe("current-password");
    });
    stop();
  });
});
