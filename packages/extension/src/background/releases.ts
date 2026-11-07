// Foundry's public release list and notes, for the Update page's Release
// history (package 7). Foundry's own update check only returns the newest
// release, so the history reads foundryvtt.com/releases and each release's
// page. Only with the optional permission for foundryvtt.com, which the
// options page asks for (it needs the user's click); only these two kinds of
// URL; never with cookies. The page's HTML is read in the Setup UI with
// DOMParser (a service worker has none) and drawn through its cleaner.

export const FOUNDRY_ORIGIN = "https://foundryvtt.com/*";
export const RELEASES_URL = "https://foundryvtt.com/releases/";
/** The release list is about 90 kB, a release's page about 40 kB. */
export const MAX_HTML = 2_000_000;
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Fetches a release page: no cookies, no redirect (another host the user
 * allowed must not be read this way; security review), and a size cap.
 */
export async function fetchRelease(url: string): Promise<string> {
  const response = await fetch(url, {
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
  if (!response.url.startsWith(RELEASES_URL))
    throw new Error("foundryvtt.com answered from elsewhere");
  const size = Number(response.headers.get("content-length") ?? 0);
  if (size > MAX_HTML) throw new Error("foundryvtt.com's page is too large");
  return (await response.text()).slice(0, MAX_HTML);
}

export interface ReleasesPlatform {
  /** Whether the optional permission for foundryvtt.com is granted. */
  readonly permitted: () => Promise<boolean>;
  /** A page of foundryvtt.com, never redirected elsewhere, at most MAX_HTML. */
  readonly fetchText: (url: string) => Promise<string>;
}

export type ReleasesAnswer =
  | { readonly permitted: false }
  | { readonly permitted: true; readonly html: string };

/** The list, or one release's page (the version is checked by the schema). */
export async function readReleases(
  p: ReleasesPlatform,
  version?: string,
): Promise<ReleasesAnswer> {
  if (!(await p.permitted())) return { permitted: false };
  const html = await p.fetchText(`${RELEASES_URL}${version ?? ""}`);
  return { permitted: true, html: html.slice(0, MAX_HTML) };
}
