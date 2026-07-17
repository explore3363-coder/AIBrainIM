#!/bin/bash
# Fix: Inject main.jsbundle into IPA after exportArchive
set -euo pipefail

IPA_PATH="${1:-build/export/AIBrainIM.ipa}"
BUNDLE_PATH="${2:-build/AIBrainIM.xcarchive/Products/AIBrainIM.app/main.jsbundle}"

if [ ! -f "$IPA_PATH" ]; then echo "ERROR: IPA not found"; exit 1; fi
if [ ! -f "$BUNDLE_PATH" ]; then echo "ERROR: Bundle not found"; exit 1; fi

WORK_DIR=$(mktemp -d)
echo "Working dir: $WORK_DIR"
cp "$IPA_PATH" "$WORK_DIR/app.ipa"
cd "$WORK_DIR"
unzip -q app.ipa -d Payload

echo "Bundle in IPA: $([ -f Payload/AIBrainIM.app/main.jsbundle ] && wc -c < Payload/AIBrainIM.app/main.jsbundle || echo 'MISSING')"
echo "Source bundle: $(wc -c < "$BUNDLE_PATH") bytes"
cp "$BUNDLE_PATH" Payload/AIBrainIM.app/main.jsbundle
echo "Bundle injected."

# Repack
rm -f app.ipa
zip -q -r app.ipa Payload
cp app.ipa "$IPA_PATH"
echo "Fixed IPA: $(wc -c < "$IPA_PATH") bytes at $IPA_PATH"
rm -rf "$WORK_DIR"
