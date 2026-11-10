# Changelog

All notable changes, per release. Each part has its own version and tag:
the companion module (`stagehand-v<version>`, its `module.json`), the
browser extension (`stagehand-extension-v<version>`, its `manifest.json`)
and the Android app (`stagehand-app-v<version>`, the extension's version).

## 2026-11-10: first public release

### Companion module 0.1.0

- Reports the world's modules to Stagehand's Setup page through the world's
  flags, for the full Gamemaster only.
- Applies the module changes queued on Setup after showing them in a
  dialog: what turns on, what turns off, what other modules need.
- Works on Foundry VTT 13 and 14.

### Extension 0.2.0

- A new Setup page over Foundry's own, on the servers you allow: the
  Library (folders, tags, notes, smart groups, presets, saved views, new
  modules to sort), each world's modules with queued changes reviewed before
  launch, launching, backups and snapshots, configuration, and Foundry's own
  updates with release notes.
- The library follows you across devices through a file on your Foundry
  server.
- Foundry VTT 13 and 14.

### Android app 0.2.0

- The same Setup page on phones and tablets, with a phone layout, your
  servers on a home screen, an administrator login that works with password
  managers, and a running-world page.
- Sideloaded APK; Android 8 and later with WebView 145 or newer.
