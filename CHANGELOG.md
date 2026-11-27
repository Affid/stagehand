# Changelog

All notable changes, per release. Each part has its own version and tag:
the companion module (`stagehand-v<version>`, its `module.json`), the
browser extension (`stagehand-extension-v<version>`, its `manifest.json`)
and the Android app (`stagehand-app-v<version>`, the extension's version).

## 2026-11-27

### Extension 0.4.0

- The Library has an Updates tab. Stagehand checks every module and system
  itself and lists what has an update, what it couldn't check and what is
  up to date, before anything installs. Tick the updates you want and
  press Update. Opening the tab checks again when the last check is over
  an hour old, and Check again checks whenever you like. It replaces
  Foundry's Update All on the Modules and Systems tabs.
- Warnings before an update: one that needs a newer version of another
  package (with a button to tick that one too, which then updates first),
  one that doesn't fit your system, and a system update that modules
  using it may not work with. When a ticked update still has a warning,
  Stagehand asks before it starts. An update that needs a newer Foundry
  says so, with a link to Foundry's update.
- One package can be checked without installing it: the Update box in its
  side panel shows the new version, any warnings and its changelog, and
  installs only when you press Update. A card's update mark opens it.
- Progress you can see: the tab has one bar for the whole run, and each
  package's row, card and Update box say whether it is backing up,
  waiting, downloading (with a percentage) or installing. With Back up
  first on, as it is each time Setup opens, Foundry backs up each package
  before it updates, restorable from Backups.
- An update you can no longer download, for example after a Patreon
  membership ended, shows under "Not available to you" with Check again,
  instead of failing each time. On Foundry 13, which doesn't report a
  refused download, its row says the download didn't arrive.
- A failed update says why, on its row and in its Update box.
- Text in a side panel can be selected and copied, such as a package's
  name and id.
- A short Systems list no longer stretches its cards to the height of the
  pane.
- Typing a name right after New tag or New preset can no longer rename a
  different tag or preset.
- A world's "Copy from" buttons in its Add menu read the same to screen
  readers as they show.

### Android app 0.4.0

- The same changes, on the phone: the Updates tab is among the Library's
  tabs, and a package's sheet has its Update box.

## 2026-11-19

### Companion module 0.2.0

- Module Management shows the server's Stagehand library inside a world
  (issue #2): modules as cards in the library's folders, each module's
  details, Apply preset, and a review before saving that reloads the
  world once. For Gamemasters and Assistant GMs on a server whose admin
  organises a library with Stagehand; players keep Foundry's list. Each
  user can turn it off in Configure Settings: "Library view in Module
  Management".
- The window opens to fit the screen, can be resized, and gives its cards
  as many columns as its width allows.
- With BBMM's own module manager on, the first full Gamemaster is asked
  once which view Module Management opens.

### Extension 0.3.3

- Links are readable in Foundry's Fantasy and Sci-fi Setup themes, such as
  Delete tag in the Tags panel: they took a dark tint of the theme's colour
  meant for backgrounds, and showed dark on dark.

### Android app 0.3.3

- The same fix, in the phone's sheets.
- A server's card on the home screen reads its whole text to screen
  readers (its address, whether it is encrypted, when it was opened), not
  only "Open" and its name.

## 2026-11-13

### Extension 0.3.2

- A module's "Check update" button is now "Update if available", as
  Foundry's own is: it installs a newer version straight away, not only
  checks for one.
- A switch turned off no longer shows Foundry's checkbox square around
  its knob.
- A module or system name too long for its card ends in an ellipsis and
  shows in full on hover, instead of being cut off mid-letter.
- A "turns on" or "turns off" tag sits on the line of its module's name,
  and no longer breaks over two lines in the List view.

### Android app 0.3.2

- The same fixes, where the phone shows them.

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
