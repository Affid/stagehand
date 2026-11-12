# Changelog

All notable changes, per release. Each part has its own version and tag:
the companion module (`stagehand-v<version>`, its `module.json`), the
browser extension (`stagehand-extension-v<version>`, its `manifest.json`)
and the Android app (`stagehand-app-v<version>`, the extension's version).

## 2026-11-12

### Extension 0.3.1

- A world no longer shows a warning after a session longer than ten
  minutes. Foundry marks a world as played when it closes as well as when
  it launches, and Stagehand took that for a world played without it.
- The warning beside a world in the list now shows why on hover. It
  showed nothing before, and for a failed change it named the wrong
  reason.
- A long module list on a world's page no longer runs over Recent changes.
- On the Update page, a world with modules to check no longer reads as
  compatible: an unverified module makes it Unverified, and an
  incompatible one a Compatibility risk.

### Android app 0.3.1

- The same fixes, where the phone shows them.

## 2026-11-11

### Extension 0.3.0

- On a server without the companion module, the Library says so and
  installs it with Foundry's own installer; a world's setup steps start
  with the install. An out-of-date companion is offered the update the
  same way.
- Foundry's backups tour could still appear over the Setup page on a first
  open, when Foundry had started it before Stagehand came up. It is now
  taken away once Foundry has drawn it.

### Android app 0.3.0

- The same: the companion's install offer, and the backups tour kept off
  the app's pages.

### Extension 0.2.1

- Foundry's backups tour no longer starts by itself over the new Setup
  page on the first open.

### Android app 0.2.1

- A server out of reach shows the app's own screen with Try again, in place
  of the browser's "Web page not available"; coming back to the app tries
  once by itself.
- Foundry's "lost connection" and "re-established" notices no longer show
  on returning to the app; a small Reconnecting sign shows while a loss
  lasts.
- Foundry's backups tour and its old-Chromium notice stay off the app's
  pages.

### Companion module 0.1.2

- The description links to the extension's Chrome Web Store listing.

### Companion module 0.1.1

- The manifest's readme link opens the companion's own README, which says
  what it does, who it runs for and what it touches.

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
