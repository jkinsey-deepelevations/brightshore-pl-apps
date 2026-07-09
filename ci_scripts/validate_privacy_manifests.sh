#!/bin/sh

set -e

PLIST_BUDDY="/usr/libexec/PlistBuddy"
TARGET="$1"
TMP_DIR=""

if [ -z "$TARGET" ]; then
  echo "usage: $0 path/to/App.xcarchive|App.app|App.ipa|directory" >&2
  exit 2
fi

cleanup() {
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

case "$TARGET" in
  *.ipa)
    TMP_DIR="$(mktemp -d)"
    unzip -q "$TARGET" -d "$TMP_DIR"
    TARGET="$TMP_DIR/Payload"
    ;;
  *.xcarchive)
    TARGET="$TARGET/Products/Applications"
    ;;
esac

if [ ! -e "$TARGET" ]; then
  echo "error: target not found: $TARGET" >&2
  exit 2
fi

manifest_list="$(mktemp)"
find "$TARGET" -name PrivacyInfo.xcprivacy -type f -print > "$manifest_list"

if [ ! -s "$manifest_list" ]; then
  echo "error: no PrivacyInfo.xcprivacy files found under $TARGET" >&2
  rm -f "$manifest_list"
  exit 1
fi

while IFS= read -r manifest; do
  plutil -lint "$manifest" >/dev/null

  tracking="$("$PLIST_BUDDY" -c "Print :NSPrivacyTracking" "$manifest" 2>/dev/null || true)"
  has_domains=0
  has_domain_items=0

  if "$PLIST_BUDDY" -c "Print :NSPrivacyTrackingDomains" "$manifest" >/dev/null 2>&1; then
    has_domains=1
    if "$PLIST_BUDDY" -c "Print :NSPrivacyTrackingDomains:0" "$manifest" >/dev/null 2>&1; then
      has_domain_items=1
    fi
  fi

  if [ "$tracking" = "true" ] && [ "$has_domain_items" -ne 1 ]; then
    echo "error: $manifest has NSPrivacyTracking=true without at least one tracking domain" >&2
    exit 1
  fi

  if [ "$has_domain_items" -eq 1 ] && [ "$tracking" != "true" ]; then
    echo "error: $manifest has tracking domains but NSPrivacyTracking is not true" >&2
    exit 1
  fi

  if [ "$has_domains" -eq 1 ] && [ "$has_domain_items" -ne 1 ]; then
    echo "error: $manifest has an empty NSPrivacyTrackingDomains array" >&2
    exit 1
  fi

  echo "ok: $manifest"
done < "$manifest_list"

rm -f "$manifest_list"
