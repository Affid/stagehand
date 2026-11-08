// The app's bundles must not reach the extension's APIs (Android plan,
// "A platform layer, chosen at build time"): build.ts runs this over every
// file in dist-app/ and fails the build on a hit. It guards against
// importing extension code by mistake, not against code written to hide
// (an alias such as `const c = chrome` passes); in WebView such a call
// would throw, as `chrome` has no APIs there.

/** The extension APIs our code uses or could use by mistake. */
const API =
  "(?:runtime|storage|scripting|permissions|tabs|action|i18n|windows|downloads|alarms|identity|webRequest|declarativeNetRequest|cookies|contextMenus|notifications|commands|sidePanel|offscreen|webNavigation|history|bookmarks|management)";
const CALL = new RegExp(
  String.raw`(?<![\w$.])(?:(?:globalThis|window|self)\s*\??\.\s*)?(?:chrome|browser)\s*\??\.\s*${API}\b`,
  "g",
);

/** Each use of a chrome.* or browser.* API, as "line: text". */
export function browserApiCalls(code: string): string[] {
  return code
    .split("\n")
    .flatMap((line, i) =>
      [...line.matchAll(CALL)].map((m) => `${String(i + 1)}: ${m[0]}`),
    );
}
