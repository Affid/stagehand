#!/usr/bin/env bash
# Copy the few Foundry files the mockup needs into fvtt/: Foundry's stylesheet,
# its window textures, its body and heading fonts and three Font Awesome faces
# (Foundry draws checkboxes with Duotone). They are Foundry's (and Font Awesome
# Pro's) licensed files, so they stay out of git: see .gitignore.
# Usage: ./assets.sh [path to Foundry's install, default ~/foundry/vtt]
set -euo pipefail
FVTT="${1:-$HOME/foundry/vtt}/public"
OUT="$(dirname "$0")/fvtt"
[ -f "$FVTT/css/foundry2.css" ] || { echo "No Foundry install at $FVTT"; exit 1; }
mkdir -p "$OUT"/{css,ui,fonts/signika,fonts/modesto-condensed,fonts/fontawesome/css,fonts/fontawesome/webfonts}
cp "$FVTT/css/foundry2.css" "$OUT/css/"
cp "$FVTT"/fonts/signika/signika-{regular,bold}.woff2 "$OUT/fonts/signika/"
cp "$FVTT"/fonts/modesto-condensed/modesto-condensed{,-bold}.woff2 "$OUT/fonts/modesto-condensed/"
# The light interface draws windows on parchment; the dark one on denim.
cp "$FVTT"/ui/{parchment.jpg,denim075.png} "$OUT/ui/"
cp "$FVTT/fonts/fontawesome/css/all.min.css" "$OUT/fonts/fontawesome/css/"
cp "$FVTT"/fonts/fontawesome/webfonts/fa-{solid-900,regular-400,duotone-900}.woff2 "$OUT/fonts/fontawesome/webfonts/"
echo "Copied Foundry's assets into $OUT"
