// @vitest-environment happy-dom
import { describe, expect, test } from "vitest";
import { cleanForEditor } from "../../src/ui/common/clean-html.ts";

describe("a description cleaned before Foundry's editor opens it (security review)", () => {
  test("no scripts, handlers, styles or javascript: links", () => {
    const out = cleanForEditor(
      '<p onclick="x()">Hi <img src=x onerror="steal()"><script>bad()</script>' +
        '<a href="javascript:alert(1)">a</a><span style="background:url(x)">s</span></p>',
    );
    expect(out).not.toMatch(/onerror|onclick|script|javascript|style=/i);
    expect(out).toContain("Hi");
  });

  test("keeps formatting, http(s) links, and images with a safe source", () => {
    const out = cleanForEditor(
      "<h2>House rules</h2><ul><li><strong>No</strong> flanking</li></ul>" +
        '<a href="https://example.com/x">site</a><img src="worlds/w/map.webp" alt="Map">',
    );
    expect(out).toContain("<h2>House rules</h2>");
    expect(out).toContain("<strong>No</strong>");
    expect(out).toContain('href="https://example.com/x"');
    expect(out).toContain('src="worlds/w/map.webp"');
  });

  test("plain text keeps its paragraphs", () => {
    expect(cleanForEditor("One\n\nTwo")).toBe("<p>One</p><p>Two</p>");
  });
});
