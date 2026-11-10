# Privacy policy

Stagehand (the browser extension, the Android app and the companion
module) collects no personal data, has no analytics or telemetry, and
sends nothing to its author or to anyone else.

## What it stores, and where

- **In your browser or the app:** the Foundry servers you add, your module
  library (folders, tags, notes, saved views, presets), and copies of what
  your servers' Setup pages show. This stays on your device.
- **On your own Foundry server:** a copy of the library in
  `Data/stagehand/library.json`, so it follows you to your other devices,
  and, in each world's `world.json`, the module changes you queued and the
  companion's report of the world's modules. Like everything in Foundry's
  Data folder, these files can be read by anyone who knows their path.

## What it connects to

- The Foundry servers you add, and only after you allow each one.
- This repository on GitHub, once a day, to read the Setup page's
  configuration (selectors and switches, no code and no data about you).
- foundryvtt.com, to read Foundry's release notes, only if you grant that
  permission on the Update page.

## Permissions (browser extension)

- **storage:** keeps your servers and library in your browser.
- **scripting:** shows Stagehand's Setup page on the servers you allowed.
- **activeTab:** lets the toolbar button offer "Use Stagehand here" on the
  tab you're on.
- **Access to a site (optional):** asked for each Foundry server you add,
  and for foundryvtt.com if you want release notes.

## Contact

Questions or concerns: open an issue at
https://github.com/Affid/stagehand/issues (or, for anything sensitive, a
private report under Security).

Last updated: 2026-11-10.
