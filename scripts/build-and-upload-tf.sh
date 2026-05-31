#!/usr/bin/env bash
# AIBrainIM — Full TestFlight build + upload (no manual steps required)
# Usage: bash scripts/build-and-upload-tf.sh

set -euo pipefail

# ─── Credentials (from GitHub Variables/Secrets) ────────────────────────────
export APPLE_API_KEY_ID="HWP45ALL8Y"
export ASC_ISSUER_ID="0bc52ef9-a4c4-489e-810c-c8a80db0ab9a"
export APPLE_TEAM_ID="7S96N8A32U"
export ASC_KEY_PATH="$HOME/private_keys/AuthKey_${APPLE_API_KEY_ID}.p8"

# ─── Derived paths ───────────────────────────────────────────────────────────
PROJECT_DIR="$HOME/.tungsten_codex/AIBrainIM"
BUILD_DIR="$PROJECT_DIR/build"
ARCHIVE_PATH="$BUILD_DIR/AIBrainIM.xcarchive"
IPA_PATH="$BUILD_DIR/AIBrainIM.ipa"
EXPORT_PLIST="$PROJECT_DIR/ios/ExportOptions.plist"
LOG="$BUILD_DIR/archive.log"
UPLOAD_LOG="$BUILD_DIR/upload.log"

# ─── Preflight checks ────────────────────────────────────────────────────────
if [ ! -f "$ASC_KEY_PATH" ]; then
  echo "❌ Private key not found: $ASC_KEY_PATH"
  exit 1
fi

if [ ! -f "$EXPORT_PLIST" ]; then
  echo "❌ ExportOptions.plist not found: $EXPORT_PLIST"
  exit 1
fi

# Verify altool works (auth check only)
echo "🔑 Verifying App Store Connect credentials..."
xcrun altool --upload-app -f "$IPA_PATH" -t ios \
  --apiKey-path "$ASC_KEY_PATH" \
  --apiIssuer "$ASC_ISSUER_ID" 2>&1 | head -3 || true

echo "📦 Current version info:"
cd "$PROJECT_DIR"
BUILD_NUM=$(git rev-list --count HEAD)
echo "   Git commit count (build number): $BUILD_NUM"
SHORT_VER=$(grep -A1 "CFBundleShortVersionString" "$PROJECT_DIR/ios/AIBrainIM/Info.plist" | grep string | head -1 | sed 's/<[^>]*>//g' | tr -d ' ')
echo "   App version: $SHORT_VER (build $BUILD_NUM)"

# ─── 1. Archive ──────────────────────────────────────────────────────────────
echo ""
echo "🏗️  Step 1/3 — Archiving (Release, generic iOS device)..."
xcodebuild -workspace "$PROJECT_DIR/ios/AIBrainIM.xcworkspace" \
  -scheme AIBrainIM \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE_PATH" \
  -derivedDataPath "$BUILD_DIR/DerivedData" \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGN_IDENTITY="iPhone Distribution: Hong Yang (7S96N8A32U)" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  CURRENT_PROJECT_VERSION="$BUILD_NUM" \
  archive 2>&1 | tee "$LOG"

if [ $? -ne 0 ]; then
  echo "❌ Archive failed. See $LOG"
  exit 1
fi
echo "✅ Archive complete → $ARCHIVE_PATH"

# ─── 2. Export IPA ────────────────────────────────────────────────────────────
echo ""
echo "📦 Step 2/3 — Exporting IPA..."
xcodebuild -exportArchive \
  -archivepath "$ARCHIVE_PATH" \
  -exportPath "$BUILD_DIR" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGN_IDENTITY="iPhone Distribution: Hong Yang (7S96N8A32U)" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" 2>&1 | tee -a "$LOG"

if [ $? -ne 0 ]; then
  echo "❌ Export failed. See $LOG"
  exit 1
fi

# Find the actual IPA (xcodebuild sometimes puts it in a subdirectory)
IPA_ACTUAL=$(find "$BUILD_DIR" -maxdepth 2 -name "*.ipa" -newer "$ARCHIVE_PATH" 2>/dev/null | head -1)
if [ -n "$IPA_ACTUAL" ] && [ -f "$IPA_ACTUAL" ]; then
  echo "✅ IPA exported → $IPA_ACTUAL"
else
  echo "❌ IPA not found after export"
  exit 1
fi

# ─── 3. Upload to TestFlight ─────────────────────────────────────────────────
echo ""
echo "🚀 Step 3/3 — Uploading to TestFlight..."
xcrun altool --upload-app \
  -f "$IPA_ACTUAL" \
  -t ios \
  --apiKey-path "$ASC_KEY_PATH" \
  --apiIssuer "$ASC_ISSUER_ID" 2>&1 | tee "$UPLOAD_LOG"

if [ $? -eq 0 ]; then
  echo ""
  echo "🎉✅ SUCCESS — Build #$BUILD_NUM uploaded to TestFlight!"
  echo "   Allow 5–30 minutes for Apple processing on App Store Connect."
  echo "   Log: $UPLOAD_LOG"
else
  echo ""
  echo "❌ Upload failed. See $UPLOAD_LOG"
  exit 1
fi
