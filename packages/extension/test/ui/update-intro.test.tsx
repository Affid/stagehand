// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { Intro } from "../../src/ui/shell/server/update/NotesView.tsx";

afterEach(cleanup);

const block = (html: string): Element => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const el = doc.body.firstElementChild;
  if (!el) throw new Error("no element");
  return el;
};

describe("the notes' overview blocks (Phase 6, axe dlitem)", () => {
  test("a highlights list stays a description list", () => {
    const { container } = render(
      <Intro
        blocks={[
          block("<p>Hello <b>there</b></p>"),
          block("<dl><dt>Passwords</dt><dd>Players set their own.</dd></dl>"),
        ]}
      />,
    );
    const dl = container.querySelector("dl");
    expect(dl?.querySelector(":scope > dt")?.textContent).toBe("Passwords");
    expect(dl?.querySelector(":scope > dd")?.textContent).toBe(
      "Players set their own.",
    );
    expect(container.querySelector("div.mlu-p")?.textContent).toBe(
      "Hello there",
    );
  });
});
