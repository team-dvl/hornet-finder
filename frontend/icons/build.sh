#!/usr/bin/env bash
#
# Regenerate the app icons: SVG sources from app-icon.py, then the PNG/ICO
# files of frontend/public, drawn by Chromium in the Playwright Docker image
# (same image and cache as ui-shots.sh). Commit the SVGs and the rendered files.
#
# Usage: frontend/icons/build.sh
#
set -euo pipefail

HERE="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$(dirname "$HERE")"
ROOT="$(dirname "$FRONTEND")"
PW_VERSION=1.63.0  # keep in step with ui-shots.sh

python3 "$HERE/app-icon.py"

mkdir -p "$ROOT/.cache/ui-shots"
docker run --rm --ipc=host --user "$(id -u):$(id -g)" -e HOME=/tmp \
    -v "$FRONTEND:/frontend" -v "$ROOT/.cache/ui-shots:/work" -w /work \
    "mcr.microsoft.com/playwright:v${PW_VERSION}-noble" \
    bash -c "test -d node_modules/playwright || npm install --no-save --silent playwright@${PW_VERSION} >/dev/null; NODE_PATH=/work/node_modules node /frontend/scripts/app-icons.cjs"
