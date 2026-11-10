# Security

Stagehand works with your Foundry server's administrator session, so
security reports are welcome and handled first.

## Reporting a vulnerability

Please report privately, not in a public issue: use **Report a
vulnerability** on this repository's Security tab (GitHub's private
vulnerability reporting). Include what an attacker could do, the part
affected (browser extension, Android app or companion module), the versions
of Stagehand and Foundry VTT, and steps to reproduce.

I aim to answer within a week. Fixes go out in a new release, and the
report is credited unless you'd rather it wasn't.

## Supported versions

The latest release of each part. Stagehand is not released yet; until then,
the `main` branch.

## Scope

In scope: anything that lets a page, a player, another Gamemaster or
another site act with the administrator's rights, read what they shouldn't,
or change a world without the Gamemaster's confirmation.

Known and accepted: the library file (`Data/stagehand/library.json`) and
each world's `world.json` are readable by anyone who knows their path, as
everything in Foundry's Data folder is. See the README's "Your data".
