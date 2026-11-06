#!/bin/bash
# Double-click this file in Finder (or run ./build-mac.command) to build the plainsearch Mac app.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then echo "Node.js is not installed – get it from https://nodejs.org first."; read -r -p "Press Return to close"; exit 1; fi
echo "Installing build tools (first time takes a few minutes)…"
npm install || { echo "npm install failed"; read -r -p "Press Return to close"; exit 1; }
echo "Building the app…"
npm run dist || { echo "Build failed"; read -r -p "Press Return to close"; exit 1; }
echo "Done. Opening the dist folder – drag plainsearch into Applications."
open dist
