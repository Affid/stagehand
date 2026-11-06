// Foundry's release pages from foundryvtt.com (package 7, security review):
// no cookies, no redirect, only foundryvtt.com/releases, a size cap.
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  fetchRelease,
  MAX_HTML,
  RELEASES_URL,
} from "../../src/background/releases.ts";

const reply = (over: Partial<Response> & { length?: number } = {}) =>
  ({
    ok: true,
    status: 200,
    url: `${RELEASES_URL}14.370`,
    headers: new Headers(
      over.length === undefined
        ? {}
        : { "content-length": String(over.length) },
    ),
    text: () => Promise.resolve("<article>notes</article>"),
    ...over,
  }) as unknown as Response;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchRelease", () => {
  test("without cookies, refusing redirects", async () => {
    const fetch = vi.fn(() => Promise.resolve(reply()));
    vi.stubGlobal("fetch", fetch);
    expect(await fetchRelease(`${RELEASES_URL}14.370`)).toBe(
      "<article>notes</article>",
    );
    expect(fetch).toHaveBeenCalledWith(
      `${RELEASES_URL}14.370`,
      expect.objectContaining({ credentials: "omit", redirect: "error" }),
    );
  });

  test("an answer from elsewhere, an error status, or too large a page is refused", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(reply({ url: "http://localhost:30000/setup" })),
    );
    await expect(fetchRelease(RELEASES_URL)).rejects.toThrow(/elsewhere/);
    vi.stubGlobal("fetch", () =>
      Promise.resolve(reply({ ok: false, status: 404 })),
    );
    await expect(fetchRelease(RELEASES_URL)).rejects.toThrow("HTTP 404");
    vi.stubGlobal("fetch", () =>
      Promise.resolve(reply({ length: MAX_HTML + 1 })),
    );
    await expect(fetchRelease(RELEASES_URL)).rejects.toThrow(/too large/);
  });
});
