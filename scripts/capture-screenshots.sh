#!/bin/bash
# scripts/capture-screenshots.sh
# App Store 截图自动化脚本
# iOS 26.4+: simctl screenshot via: simctl io <device> screenshot <path>
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SCHEME="AIBrainIM"
BUNDLE_ID="com.openclaw.aibrainim"
BUILD_DIR="$PROJECT_ROOT/build/AppStoreScreenshots"

mkdir -p "$BUILD_DIR"

# ── Find booted iPhone simulator ──────────────────────────────────────────────
BOOTED_SIM=$(xcrun simctl list devices booted 2>/dev/null | grep -E "iPhone" | head -1 | grep -oE '[A-F0-9-]{36}' || true)
if [ -z "$BOOTED_SIM" ]; then
  echo "📱 启动 iPhone 17 Pro Simulator..."
  xcrun simctl boot "iPhone 17 Pro" >/dev/null 2>&1 || true
  sleep 5
  BOOTED_SIM=$(xcrun simctl list devices booted 2>/dev/null | grep -E "iPhone 17 Pro" | grep -oE '[A-F0-9-]{36}' | head -1)
fi

if [ -z "$BOOTED_SIM" ]; then
  echo "❌ 无法找到或启动 Simulator，请手动检查:"
  echo "   open -a Simulator"
  exit 1
fi

echo "✓ Simulator 运行中: $BOOTED_SIM"

# ── Install app if needed ───────────────────────────────────────────────────────
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "AIBrainIM.app" -type d 2>/dev/null | head -1)
if [ -z "$APP_PATH" ]; then
  echo "⚠️  未找到已构建 App，先运行:"
  echo "   npm run build:sim"
  exit 1
fi

echo "📦 已安装 App: $APP_PATH"

# ── Launch app ───────────────────────────────────────────────────────────────
echo "🚀 启动 AI协作平台..."
xcrun simctl launch "$BOOTED_SIM" "$BUNDLE_ID" >/dev/null 2>&1 && echo "✓ App 已启动" || echo "⚠️ 启动命令完成"
sleep 5

# ── Capture screenshots using iOS 26.4 simctl io screenshot ──────────────────────
# Syntax: xcrun simctl io <device> screenshot [--type=png] [--display=<screenID>] <file>
echo "📸 截取 Dashboard..."
xcrun simctl io "$BOOTED_SIM" screenshot "$BUILD_DIR/0_Dashboard.png" 2>/dev/null && \
  echo "  ✓ Dashboard 截图已保存: 0_Dashboard.png" || \
  echo "  ! 截图失败"

# 等待 2 秒再截一张（导航到其他 Tab）
sleep 2
echo "📸 截取备用图..."
xcrun simctl io "$BOOTED_SIM" screenshot "$BUILD_DIR/0_Dashboard_alt.png" 2>/dev/null && \
  echo "  ✓ 备用截图已保存: 0_Dashboard_alt.png" || \
  echo "  ! 备用截图失败"

echo ""
echo "========================================"
echo "✅ 截图完成！输出目录: $BUILD_DIR"
echo "========================================"
ls -la "$BUILD_DIR/" 2>/dev/null || echo "目录为空"
echo ""
echo "💡 将 png 文件上传到 App Store Connect > App 截图区域"
echo "   所需尺寸:"
echo "   • 6.7 英寸 (iPhone 16 Pro): 1290 × 2796 px"
echo "   • 6.5 英寸 (iPhone 14 Pro Max): 1284 × 2778 px"
echo "   • 5.5 英寸 (iPhone 8 Plus): 1242 × 2208 px"
echo ""
echo "   iPhone 17 Pro 分辨率为 1320 × 2868 px，可缩放到上述尺寸"

# ── Resize to App Store required dimensions ──────────────────────────────────
echo "📐 缩放到 App Store 所需尺寸..."
sips -z 2796 1290 "$BUILD_DIR/0_Dashboard.png" --out "$BUILD_DIR/0_Dashboard_67.png" 2>/dev/null && echo "  ✓ 6.7\" (1290×2796)" || echo "  ! 6.7\" 缩放失败"
sips -z 2778 1284 "$BUILD_DIR/0_Dashboard.png" --out "$BUILD_DIR/0_Dashboard_65.png" 2>/dev/null && echo "  ✓ 6.5\" (1284×2778)" || echo "  ! 6.5\" 缩放失败"
sips -z 2208 1242 "$BUILD_DIR/0_Dashboard.png" --out "$BUILD_DIR/0_Dashboard_55.png" 2>/dev/null && echo "  ✓ 5.5\" (1242×2208)" || echo "  ! 5.5\" 缩放失败"
