// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { RichText } from "../../src/ui/common/rich-text.tsx";

afterEach(cleanup);

const html = (source: string): string =>
  render(<RichText html={source} />).container.innerHTML;

describe("world descriptions, cleaned", () => {
  test("keeps paragraphs, emphasis, lists and headings", () => {
    const out = html(
      "<h2>Barovia</h2><p>A <strong>gothic</strong> <em>horror</em>.</p><ul><li>Fog</li></ul>",
    );
    expect(out).toContain("<h4>Barovia</h4>");
    expect(out).toContain("<strong>gothic</strong>");
    expect(out).toContain("<em>horror</em>");
    expect(out).toContain("<ul><li>Fog</li></ul>");
  });

  test("drops scripts, styles, frames and their content", () => {
    const out = html(
      "<p>ok</p><script>alert(1)</script><style>p{}</style><iframe src='x'></iframe><svg><text>s</text></svg>",
    );
    expect(out).toBe('<div class="ml-rich"><p>ok</p></div>');
  });

  test("drops every attribute except a safe link", () => {
    const out = html(
      '<p onclick="x()" style="color:red" class="c">t</p><a href="javascript:alert(1)">bad</a><a href="https://foundryvtt.com" onmouseover="x()">good</a>',
    );
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("style=");
    expect(out).not.toContain("javascript:");
    expect(out).toContain(
      '<a href="https://foundryvtt.com/" target="_blank" rel="noopener noreferrer">good</a>',
    );
    expect(out).toContain("bad");
  });

  test("leaves out images, so nothing loads from elsewhere", () => {
    expect(
      html('<p>a<img src="https://evil.example/x.png" onerror="x()">b</p>'),
    ).toBe('<div class="ml-rich"><p>ab</p></div>');
  });

  test("unknown elements keep their text", () => {
    expect(html("<section><span>kept</span></section>")).toContain("kept");
  });

  test("plain text keeps its line breaks as paragraphs", () => {
    const out = html("First line\nsame paragraph\n\nSecond paragraph");
    expect(out).toBe(
      '<div class="ml-rich"><p>First line<br>same paragraph</p><p>Second paragraph</p></div>',
    );
  });

  test("an empty description renders nothing", () => {
    expect(html("   ")).toBe("");
  });
});
