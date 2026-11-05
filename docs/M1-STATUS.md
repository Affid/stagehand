# M1 status

Date: 2026-11-05. Verified on Foundry V14 Stable build 369 (local, WSL2) with
Playwright's Chromium. Requirement ids are from [PRD.md](PRD.md).

## Verification

| Check                                                                        | Result                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------- |
| Unit tests (Vitest)                                                          | 236 passing; coverage 93.6% lines, 84.8% branches |
| End-to-end, Setup UI (`tests/foundry/setup-ui.spec.ts`)                      | 10 passing                                        |
| End-to-end, in-world apply (`tests/foundry/apply.spec.ts`)                   | 4 passing                                         |
| Lint (typed ESLint, strict; functions at most 50 lines), typecheck, Prettier | clean                                             |
| Firefox add-on linter (`web-ext lint`)                                       | 0 errors; 4 explained warnings (below)            |

Coverage excludes only thin browser glue (`packages/extension/src/entries`,
`src/platform`, `packages/module/src/index.ts`), which the end-to-end suites run.

## Reviews

A code review and a security review ran on the M1 tree (read-only agents).
Neither found a CRITICAL issue; the security review found nothing HIGH.
Everything below was fixed, with a test for each change in behaviour:

| Finding                                                                                                 | Fix                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HIGH: an open preset editor could overwrite a newer edit after a conflict, or recreate a deleted preset | The editor keeps the revision it opened with, closes after a conflict, and refuses to save a preset deleted elsewhere                                                                                                                                                                                                                 |
| A deleted preset turned a queued Replace into "disable everything"                                      | Such commands fail with a reason at the next launch; queueing unknown presets is refused                                                                                                                                                                                                                                              |
| The module ignored error replies to its acknowledgements                                                | Acks must be accepted, or nothing is written                                                                                                                                                                                                                                                                                          |
| A command cancelled on Setup while the GM's dialog was open was still applied                           | The extension reports whether an ack was accepted; the module stops otherwise                                                                                                                                                                                                                                                         |
| An import could make a stale editor's save look current                                                 | Imported folders, tags and presets get revisions newer than any copy in use                                                                                                                                                                                                                                                           |
| Admin verification never expired or got revoked                                                         | Expires after 7 days (PR-9); revoked when Setup reports no admin session                                                                                                                                                                                                                                                              |
| Page scripts could fill extension storage                                                               | Snapshots and acks are size-limited; at most 200 world snapshots per server                                                                                                                                                                                                                                                           |
| A remote config could hide `body`                                                                       | The list selectors must be plain ids; hiding is limited to core's list inside the Setup app                                                                                                                                                                                                                                           |
| Messages about other worlds                                                                             | The bridge pins the world of the first HELLO; acks must come from the command's world                                                                                                                                                                                                                                                 |
| Smaller ones                                                                                            | Handler lookup by `Map`; exact `/setup` and `/game` paths; `*` refused in server URLs; duplicate tag ids refused; stale tag renames report a conflict; mutual conflicts listed once; removing an uninstalled module isn't "missing"; a failed settings write is reported; existing core config entries are kept; long functions split |

Not changed, by design: the remote config may raise `maxBuild` (that is what
V-5 is for), and the config file is not signed (it holds data only; pinning it
to a release tag is noted for when the repository exists).

`web-ext lint` warnings that remain: Firefox ignores the `service_worker` key
(the manifest also has `scripts`); "Function constructor" is Zod's feature check,
which `jitless` mode skips; `innerHTML` is Preact's unused
`dangerouslySetInnerHTML` path.

## Requirements

Done means implemented and tested (unit, end-to-end, or both).

| Area                                      | Ids                     | State                                                                                                                                                                               |
| ----------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server registration                       | R-1, R-2, R-5           | Done. Per-origin optional host permission from the options page; content scripts registered at runtime; permissions are `storage` and `scripting` only.                             |
| Remote config                             | R-4, V-5                | Done in code: data-only JSON validated with Zod, cached for a day, bundled fallback. The file is not published yet (the URL points at `Affid/module-library`, which doesn't exist). |
| Folders                                   | S-1                     | Done: create, rename, colour, reorder, collapse (persisted), delete, drag modules onto folders, bulk move.                                                                          |
| Tags, search, notes, authors, core toggle | S-3, S-4, S-6, S-7, S-8 | Done.                                                                                                                                                                               |
| Smart groups                              | G-1 to G-5              | Done. G-7 (unused, P1) also done.                                                                                                                                                   |
| Worlds view                               | W-1, W-2                | Done: last snapshot, active count, age; statuses "companion not enabled", "stale", "companion outdated", "pending (n)". W-3 (P1) also done.                                         |
| Presets and modes                         | P-1 to P-6              | Done. Presets from a selection, the filtered list (a folder or tag filter), or a world snapshot. Preview uses the world's own core version (V-7). P-7 (P1) also done.               |
| Authors                                   | A-1                     | Partly: identity keys for the author filter. Merging authors (P1) not done.                                                                                                         |
| Portability                               | D-1, D-2                | Done. A stale save is rejected; the UI reloads the latest copy and explains. No side-by-side merge UI.                                                                              |
| Companion module                          | C-1 to C-6              | Done. Without the extension it stays idle with a one-time notice. PR-5 (published library) is P1, not done.                                                                         |
| Localisation                              | L-1, L-2                | Done: all strings in i18n files; language follows Foundry's, then the browser's. English only.                                                                                      |
| Versions                                  | V-1 to V-3, V-7         | Done: detection, adapter by range, closest older build flagged "untested", safe mode (read-only).                                                                                   |
| Versions                                  | V-6                     | Partly: one module codebase, `compatibility.minimum` 13, but not run on V13.                                                                                                        |
| Roles                                     | PR-1 to PR-4, PR-7      | Done.                                                                                                                                                                               |

## Open items

1. **V13 is not verified.** Only V14 is installed locally. V13 therefore runs
   in safe mode (read-only) until an adapter is confirmed. Needs the V13 Node
   build on a second port; then add a `v13` entry to the adapter config.
2. **Firefox is not tested.** Playwright's Firefox can't load extensions.
   Needs a manual run with `web-ext run` (see M0 findings).
3. **Remote config file** needs the public repository.
4. **Options page** only adds servers; there is no list or removal yet.
5. **Nested folders (S-2, P1)**: the model and operations allow depth 2; the UI
   creates top-level folders only.
6. **Saved views (S-5, P1)**: schema only.
7. **Module size**: 192 kB unminified (45 kB gzipped), mostly Zod. `zod/mini`
   or a hand-written check would shrink it.
8. Store accounts and the human-written listing text (PRD section 13) are the
   owner's tasks.
