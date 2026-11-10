# Docs

Design notes, plans and findings, kept as they were written: each says its
date and status at the top. The code is the final word; these explain why it
is the way it is.

## Start here

- [PRD.md](PRD.md): what Stagehand is for, who it serves, and the
  requirements the code refers to by id (D-1, PR-4, C-6...).
- [COMPANION-WALKTHROUGH.md](COMPANION-WALKTHROUGH.md): the companion module
  file by file, for reviewers and before submitting it to Foundry.

## How it works now

- [COMPANION-WORLD-PROTOCOL.md](COMPANION-WORLD-PROTOCOL.md): how Setup and
  the companion talk, through the world's own flags.
- [LIBRARY-SYNC-PLAN.md](LIBRARY-SYNC-PLAN.md): the library kept on the
  server and merged across devices.
- [FOUNDRY-13-PLAN.md](FOUNDRY-13-PLAN.md): Foundry 13 support, kept in one
  folder so it can be dropped later.
- [SETUP-REDESIGN.md](SETUP-REDESIGN.md) and
  [SETUP-BUILD-PLAN.md](SETUP-BUILD-PLAN.md): the new Setup page's design
  and how it was built. The mockup it follows is in `../design/setup-page`.

## Android app

- [ANDROID-APP-PLAN.md](ANDROID-APP-PLAN.md): the app, phase by phase, with
  the owner's decisions.
- [ANDROID-SPIKE.md](ANDROID-SPIKE.md): the tools and the first throwaway
  app (`../spikes/android`).

## History

Dated findings from earlier stages, superseded by the documents above:

- [M0-FINDINGS.md](M0-FINDINGS.md): the first spike, end to end on Foundry 14.
- [M1-STATUS.md](M1-STATUS.md): the first milestone, as of 2026-11-05.
- [SETUP-SPIKE.md](SETUP-SPIKE.md): what Foundry's Setup page allows, found
  before building our own.
- [WORLDS-TAB.md](WORLDS-TAB.md): the first worlds panel inside Foundry's
  Setup, replaced by the new Setup page.

Some documents link mockups published on claude.ai; those links are private
to the author. The mockups themselves are in `../design`.
