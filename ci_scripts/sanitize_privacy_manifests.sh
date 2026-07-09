#!/bin/sh

set -e

PLIST_BUDDY="/usr/libexec/PlistBuddy"

sanitize_manifest() {
  manifest="$1"

  if [ ! -f "$manifest" ]; then
    return 0
  fi

  if ! "$PLIST_BUDDY" -c "Print :NSPrivacyTrackingDomains" "$manifest" >/dev/null 2>&1; then
    return 0
  fi

  if "$PLIST_BUDDY" -c "Print :NSPrivacyTrackingDomains:0" "$manifest" >/dev/null 2>&1; then
    tracking="$("$PLIST_BUDDY" -c "Print :NSPrivacyTracking" "$manifest" 2>/dev/null || true)"
    if [ "$tracking" != "true" ]; then
      "$PLIST_BUDDY" -c "Set :NSPrivacyTracking true" "$manifest" >/dev/null 2>&1 || \
        "$PLIST_BUDDY" -c "Add :NSPrivacyTracking bool true" "$manifest" >/dev/null
      echo "Set NSPrivacyTracking=true for non-empty tracking domains in $manifest"
    fi
  else
    "$PLIST_BUDDY" -c "Delete :NSPrivacyTrackingDomains" "$manifest" >/dev/null
    "$PLIST_BUDDY" -c "Set :NSPrivacyTracking false" "$manifest" >/dev/null 2>&1 || \
      "$PLIST_BUDDY" -c "Add :NSPrivacyTracking bool false" "$manifest" >/dev/null
    echo "Removed empty NSPrivacyTrackingDomains from $manifest"
  fi

  tracking="$("$PLIST_BUDDY" -c "Print :NSPrivacyTracking" "$manifest" 2>/dev/null || true)"
  if [ "$tracking" = "true" ] && ! "$PLIST_BUDDY" -c "Print :NSPrivacyTrackingDomains:0" "$manifest" >/dev/null 2>&1; then
    echo "error: $manifest has NSPrivacyTracking=true without at least one tracking domain" >&2
    exit 1
  fi

  plutil -lint "$manifest" >/dev/null
}

scan_path() {
  base="$1"

  if [ -f "$base" ]; then
    sanitize_manifest "$base"
    return 0
  fi

  if [ -d "$base" ]; then
    find "$base" -name PrivacyInfo.xcprivacy -type f -print | while IFS= read -r manifest; do
      sanitize_manifest "$manifest"
    done
  fi
}

if [ "$#" -gt 0 ]; then
  for path in "$@"; do
    scan_path "$path"
  done
else
  REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  scan_path "$REPO_ROOT/node_modules/expo-constants/ios/PrivacyInfo.xcprivacy"
  scan_path "$REPO_ROOT/node_modules/expo-file-system/ios/PrivacyInfo.xcprivacy"
  scan_path "$REPO_ROOT/ios/Pods"
fi
