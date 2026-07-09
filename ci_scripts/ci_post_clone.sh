#!/bin/sh

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export HOMEBREW_NO_INSTALL_CLEANUP=1

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found; installing Node.js with Homebrew..."
  brew install node
fi

if ! command -v pod >/dev/null 2>&1; then
  echo "CocoaPods not found; installing CocoaPods with Homebrew..."
  brew install cocoapods
fi

echo "Installing JavaScript dependencies..."
npm ci

echo "Sanitizing privacy manifests..."
./ci_scripts/sanitize_privacy_manifests.sh

echo "Installing iOS CocoaPods..."
cd ios
pod install

echo "Sanitizing CocoaPods privacy manifests..."
../ci_scripts/sanitize_privacy_manifests.sh ../ios/Pods
