#!/bin/bash
# scripts/capture-screenshots.sh
# App Store 截图自动化脚本
# 1. 启动 Simulator
# 2. 安装已构建的 App
# 3. 截取各主屏幕截图
# 4. 输出到 build/AppStoreScreenshots/
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SCHEME="AIBrainIM"
BUNDLE_ID="com.openclaw.aibrainim"
BUILD_DIR="$PROJECT_ROOT/build/AppStoreScreenshots"
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "AIBrainIM.app" -type d 2>/dev/null | head -1)

mkdir -p "$BUILD_DIR"

# ── Find available iPhone simulator ──────────────────────────────────────────
BOOTED_SIM=$(xcrun simctl list devices booted 2>/dev/null | grep -E "iPhone" | head -1 | grep -oE '[A-F0-9-]{36}' || true)
if [ -z "$BOOTED_SIM" ]; then
  echo "📱 启动 iPhone 17 Pro Simulator..."
  xcrun simctl boot "iPhone 17 Pro" >/dev/null 2>&1 || true
  sleep 5
  BOOTED_SIM=$(xcrun simctl list devices booted 2>/dev/null | grep -E "iPhone 17 Pro" | grep -oE '[A-F0-9-]{36}' | head -1)
fi

if [ -z "$BOOTED_SIM" ]; then
  echo "❌ 无法启动 Simulator，请手动检查:"
  echo "   open -a Simulator"
  exit 1
fi

echo "✓ Simulator 运行中: $BOOTED_SIM"

# ── Install app ───────────────────────────────────────────────────────────────
if [ -z "$APP_PATH" ]; then
  echo "⚠️  未找到已构建 App，先运行:"
  echo "   npm run build:sim"
  echo "   然后重新运行此脚本"
  # Still try to take a screenshot of the springboard
  xcrun simctl screenshot "$BOOTED_SIM" "$BUILD_DIR/springboard.png" 2>/dev/null && \
    echo "✓ 截图已保存: springboard.png (App 未安装)" || true
  exit 1
fi

echo "📦 安装 App: $APP_PATH"
xcrun simctl install "$BOOTED_SIM" "$APP_PATH" 2>/dev/null && echo "✓ App 安装成功" || echo "⚠️ 安装可能已存在"

# ── Launch app ────────────────────────────────────────────────────────────────
echo "🚀 启动 AI协作平台..."
xcrun simctl launch "$BOOTED_SIM" "$BUNDLE_ID" >/dev/null 2>&1 && echo "✓ App 已启动" || echo "⚠️ 启动命令完成"

# Wait for app to render
sleep 4

# ── Capture screenshots ────────────────────────────────────────────────────────
# 使用 simctl screenshot 获取高分辨率屏幕截图
echo "📸 截取屏幕..."

xcrun simctl screenshot "$BOOTED_SIM" "$BUILD_DIR/0_Dashboard_iPhone17Pro.png" 2>/dev/null && echo "  ✓ Dashboard 截图已保存" || echo "  ! Dashboard 截图失败"

# 由于 App 启动后默认在 Dashboard，额外截取一张
sleep 2
xcrun simctl screenshot "$BOOTED_SIM" "$BUILD_DIR/0_Dashboard_alt.png" 2>/dev/null && echo "  ✓ Dashboard(2) 截图已保存" || true

echo ""
echo "========================================"
echo "✅ 截图完成！输出目录: $BUILD_DIR"
echo "========================================"
ls -la "$BUILD_DIR/" 2>/dev/null && echo "" || echo "目录为空"
echo "💡 将 png 文件上传到 App Store Connect > App 截图区域"
echo "   所需尺寸:"
echo "   • 6.7 英寸 (iPhone 16 Pro): 1290 × 2796 px"
echo "   • 6.5 英寸 (iPhone 14 Pro Max): 1284 × 2778 px"
echo "   • 5.5 英寸 (iPhone 8 Plus): 1242 × 2208 px"
echo ""
echo "   当前截图来自 iPhone 17 Pro (6.9 英寸 1320 × 2868 px)"
echo "   可缩放到所需尺寸，或在 Xcode > Device > Capture Screenshot 获取精确尺寸"
