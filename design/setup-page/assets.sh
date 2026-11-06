#!/usr/bin/env bash
# Copy Foundry's own CSS, fonts and images into fvtt/ for the mockup. They are Foundry's
# (and Font Awesome Pro's) licensed files, so they stay out of git: see .gitignore.
# Usage: ./assets.sh [path to Foundry's install, default ~/foundry/vtt]
set -euo pipefail
FVTT="${1:-$HOME/foundry/vtt}/public"
DATA="${FOUNDRY_DATA:-$HOME/foundry/data/Data}"
OUT="$(dirname "$0")/fvtt"
[ -f "$FVTT/css/foundry2.css" ] || { echo "No Foundry install at $FVTT"; exit 1; }
mkdir -p "$OUT"/{css,icons/svg,ui/backgrounds,news,fonts}
cp "$FVTT/css/foundry2.css" "$OUT/css/"
cp -r "$FVTT/fonts/fontawesome" "$FVTT/fonts/amiri" "$FVTT/fonts/signika" "$FVTT/fonts/modesto-condensed" "$OUT/fonts/"
cp "$FVTT/icons/vtt-512.png" "$OUT/icons/"
cp "$FVTT"/icons/svg/d{4,6,8,10,12,20}-grey.svg "$OUT/icons/svg/"
cp "$FVTT/ui/backgrounds/setup.webp" "$OUT/ui/backgrounds/"
for f in anvil-bg.png denim075.png parchment.jpg resize-handle.webp; do cp "$FVTT/ui/$f" "$OUT/ui/"; done
# A system thumbnail for world cards: dnd5e's if installed, else Foundry's setup background.
THUMB=$(find "$DATA/systems/dnd5e" -maxdepth 3 -iname "*thumb*.webp" 2>/dev/null | head -1 || true)
cp "${THUMB:-$FVTT/ui/backgrounds/setup.webp}" "$OUT/ui/thumb-dnd5e.webp"
# News banners came from foundryvtt.com's news feed. Any wide (2.39:1) images named
# n1.webp, n2.webp, n3.webp, n4.png and n5.webp work; without them the news cards show empty.
ls "$OUT/news" | grep -q . || echo "Note: fvtt/news/ is empty; add banners n1.webp n2.webp n3.webp n4.png n5.webp."
echo "Copied Foundry's assets into $OUT"
