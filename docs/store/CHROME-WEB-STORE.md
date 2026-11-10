# Chrome Web Store submission

Everything the Chrome Web Store dashboard asks for, ready to paste.
Package: `stagehand-extension-<version>.zip` from the GitHub release
(`stagehand-extension-v<version>`), built with `pnpm --filter
@stagehand/extension build:release` and zipped without source maps.

## Store listing

- **Name:** Stagehand for Foundry VTT (from the manifest)
- **Summary (132 characters max):** Organise Foundry VTT modules on the
  Setup screen. (from the manifest)
- **Category:** Productivity (Workflow & planning)
- **Language:** English
- **Description:**

> Stagehand replaces Foundry VTT's Setup screen with a calmer one built
> around your modules.
>
> - A module library: folders, tags, notes, smart groups and saved views,
>   and new modules to sort when you install them.
> - Presets you can apply to any world, adding, replacing or removing
>   modules, with a preview of every change.
> - Each world's modules at a glance. Queue changes on Setup, review them
>   before launch, and the companion module applies them inside the world.
> - The rest of Setup too: launching worlds, backups and snapshots,
>   configuration, and Foundry's own updates with release notes.
> - Your library follows you to your other devices through a file on your
>   own Foundry server.
>
> Works with Foundry VTT 13 and 14. Install the free companion module in
> Foundry (manifest URL:
> https://raw.githubusercontent.com/Affid/stagehand/manifests/stagehand/module.json).
> Stagehand only runs on the Foundry servers you allow, collects no data and
> has no telemetry.
>
> Stagehand is open source (MIT): https://github.com/Affid/stagehand.
> Not affiliated with or endorsed by Foundry Gaming LLC.

- **Icon:** 128 x 128, `packages/extension/static/icons/icon-128.png`.
- **Screenshots:** 1280 x 800 (up to five). Still to make: they need a demo
  server with realistic modules and set-up worlds, not the test fixtures,
  and no third-party artwork in world backgrounds.
- **Homepage URL:** https://github.com/Affid/stagehand
- **Support URL:** https://github.com/Affid/stagehand/issues

## Privacy practices

- **Single purpose:** Replaces Foundry VTT's Setup screen, on the Foundry
  servers the user allows, with a page for organising and managing modules
  and worlds.
- **storage:** Saves the user's Foundry servers and module library in the
  browser.
- **scripting:** Shows Stagehand's Setup page on the Foundry servers the
  user allowed, by registering scripts for those servers only.
- **activeTab:** Lets the toolbar button offer "Use Stagehand here" for the
  Foundry server in the current tab.
- **Host permissions (optional, http and https):** Asked for each Foundry
  server the user adds; Foundry servers run at any address, so the
  extension can't list them in advance. Also asked for foundryvtt.com when
  the user wants Foundry's release notes.
- **Remote code:** No. The extension runs only its packaged code; the
  configuration it reads from GitHub is JSON data (selectors and switches),
  validated before use.
- **Data usage:** Collects none of the listed data types. Certify: not
  sold, not used or transferred for purposes unrelated to the single
  purpose, not used for creditworthiness or lending.
- **Privacy policy URL:** https://github.com/Affid/stagehand/blob/main/PRIVACY.md

## Distribution

- **Visibility:** Public.
- **Regions:** All.
- **Price:** Free.

## Before each submission

1. Bump `version` in `packages/extension/static/manifest.json`, add an
   "Extension <version>" section to CHANGELOG.md.
2. Build for release, zip without source maps, attach to a GitHub release
   tagged `stagehand-extension-v<version>`.
3. Upload the zip in the dashboard (Package, Upload new package) and submit
   for review.
