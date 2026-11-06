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
const MAX_HTML = 2_000_000;

export interface ReleasesPlatform {
  /** Whether the optional permission for foundryvtt.com is granted. */
  readonly permitted: () => Promise<boolean>;
  readonly fetchText: (url: string) => Promise<string>;
  /** Opens the options page at its foundryvtt.com section. */
  readonly openOptions: () => Promise<void>;
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
