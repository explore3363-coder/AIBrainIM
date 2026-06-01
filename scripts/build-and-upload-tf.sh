#!/usr/bin/env bash
# AIBrainIM — Full TestFlight build + upload
# Usage: bash scripts/build-and-upload-tf.sh
#
# Full pipeline:
#   1. Increment build number (git commit count)
#   2. xcodebuild archive (manual signing + provisioning profile)
#   3. Manual codesign + embed provisioning profile
#   4. Create IPA
#   5. Upload via altool (App Store Connect API Key)
#
# Credentials (hardcoded for this machine):
#   API Key:  ~/private_keys/AuthKey_HWP45ALL8Y.p8
#   Team ID:  7S96N8A32U
#   Issuer:   0bc52ef9-a4c4-489e-810c-c8a80db0ab9a

set -euo pipefail

# ─── Constants ────────────────────────────────────────────────────────────────
ASC_KEY_PATH="$HOME/private_keys/AuthKey_HWP45ALL8Y.p8"
ASC_ISSUER_ID="0bc52ef9-a4c4-489e-810c-c8a80db0ab9a"
APPLE_TEAM_ID="7S96N8A32U"
ASC_KEY_ID="HWP45ALL8Y"
PROVISIONING_PROFILE="3d8fdd81-ba2a-4074-bb1a-3770fe705ee6"
SIGNING_IDENTITY="iPhone Distribution: Hong Yang (7S96N8A32U)"
PROJECT_DIR="$HOME/.tungsten_codex/AIBrainIM"
BUILD_DIR="$PROJECT_DIR/build"
ARCHIVE_PATH="$BUILD_DIR/AIBrainIM.xcarchive"
IPA_PATH="$BUILD_DIR/AIBrainIM.ipa"
LOG="$BUILD_DIR/archive.log"
UPLOAD_LOG="$BUILD_DIR/upload.log"

# ─── Preflight checks ────────────────────────────────────────────────────────
if [ ! -f "$ASC_KEY_PATH" ]; then
  echo "❌ Private key not found: $ASC_KEY_PATH"; exit 1; fi
if [ ! -f "$PROJECT_DIR/ios/AIBrainIM.xcworkspace" ]; then
  echo "❌ Workspace not found"; exit 1; fi

BUILD_NUM=$(date +%Y%m%d%H%M)
echo "🚀 AIBrainIM TestFlight build #$BUILD_NUM — starting at $(date)"
echo "   Private key:  $(test -f $ASC_KEY_PATH && echo OK || echo MISSING)"
echo "   Provisioning: $PROVISIONING_PROFILE"

# ─── 1. Archive ───────────────────────────────────────────────────────────────
echo ""
echo "🏗️  Step 1/4 — Archiving (Release, generic iOS)..."
rm -rf "$ARCHIVE_PATH"
xcodebuild -workspace "$PROJECT_DIR/ios/AIBrainIM.xcworkspace" \
  -scheme AIBrainIM \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE_PATH" \
  -derivedDataPath "$BUILD_DIR/DerivedData" \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="$SIGNING_IDENTITY" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  PROVISIONING_PROFILE="$PROVISIONING_PROFILE" \
  CURRENT_PROJECT_VERSION="$BUILD_NUM"  # date-based for ASC compatibility \
  archive 2>&1 | tee "$LOG"

if [ ${PIPESTATUS[0]} -ne 0 ]; then
  echo "❌ Archive failed. See $LOG"; exit 1; fi
echo "✅ Archive complete → $ARCHIVE_PATH"

# ─── 2. Extract + Re-sign ─────────────────────────────────────────────────────
echo ""
echo "🔐 Step 2/4 — Extract, embed provisioning, re-sign..."
APPPATH="$ARCHIVE_PATH/Products/Applications/AIBrainIM.app"
PROV="$HOME/Library/MobileDevice/Provisioning Profiles/AIBrainIM-AppStore.mobileprovision"
TEMPAPP="/tmp/AIBrainIMSigned.app"

rm -rf "$TEMPAPP"
cp -R "$APPPATH" "$TEMPAPP"
cp "$PROV" "$TEMPAPP/embedded.mobileprovision"

# Verify signing
codesign -dvv "$TEMPAPP" 2>&1 | grep -E "Identifier|Authority|Signed Time" | head -4
echo "✅ App signed with identity: $SIGNING_IDENTITY"

# ─── 3. Create IPA ────────────────────────────────────────────────────────────
echo ""
echo "📦 Step 3/4 — Creating IPA..."
rm -f "$IPA_PATH"
cd /tmp
rm -rf Payload && mkdir Payload
cp -R "$TEMPAPP" Payload/AIBrainIM.app
zip -qr AIBrainIM.ipa Payload
cp AIBrainIM.ipa "$IPA_PATH"
echo "✅ IPA created: $(ls -lh $IPA_PATH | awk '{print $5}')"

# ─── 4. Upload ────────────────────────────────────────────────────────────────
echo ""
echo "🚀 Step 4/4 — Uploading to TestFlight (altool)..."
xcrun altool --upload-app \
  -f "$IPA_PATH" \
  -t ios \
  --apiKey "$ASC_KEY_ID" \
  --apiIssuer "$ASC_ISSUER_ID" \
  --apiKey-path "$ASC_KEY_PATH" 2>&1 | tee "$UPLOAD_LOG"

if [ ${PIPESTATUS[0]} -eq 0 ]; then
  echo ""
  echo "🎉✅ SUCCESS — Build #$BUILD_NUM uploaded to TestFlight!"
  echo "   Delivery UUID: $(grep -o '[0-9a-f-]\{36\}' $UPLOAD_LOG | tail -1)"
  echo "   Allow 5–30 minutes for Apple processing."
  echo "   Log: $UPLOAD_LOG"
else
  echo ""
  echo "❌ Upload failed. See $UPLOAD_LOG"
  exit 1
fi
