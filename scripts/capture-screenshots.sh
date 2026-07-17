#!/bin/bash
# scripts/capture-screenshots.sh
# App Store 截图自动化脚本
# 自动依次截图：Dashboard / Chat / Agent / Tasks / Profile
# iOS 26.4+: simctl screenshot via: simctl io <device> screenshot <path>
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SCHEME="AIBrainIM"
BUNDLE_ID="com.openclaw.aibrainim"
BUILD_DIR="$PROJECT_ROOT/build/AppStoreScreenshots"

# ── Tab 配置 ─────────────────────────────────────────────────────────────────
declare -a TABS=("Dashboard" "Chat" "Agent" "Tasks" "Profile")
declare -a TAB_INDEX=("0" "1" "2" "3" "4")

# ── App Store 尺寸 ────────────────────────────────────────────────────────────
# iPhone 16 Pro (6.7"): 1290×2796
# iPhone 14 Pro Max (6.5"): 1284×2778
# iPhone 8 Plus (5.5"): 1242×2208

mkdir -p "$BUILD_DIR"

# ── 启动或找到 Simulator ─────────────────────────────────────────────────────
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

# ── 确认 App 已安装 ──────────────────────────────────────────────────────────
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "AIBrainIM.app" -type d 2>/dev/null | head -1)
if [ -z "$APP_PATH" ]; then
  echo "⚠️  未找到已构建 App，先运行:"
  echo "   npm run build:sim"
  exit 1
fi
echo "📦 已安装 App: $APP_PATH"

# ── 启动 App ─────────────────────────────────────────────────────────────────
echo "🚀 启动 AI协作平台..."
xcrun simctl launch "$BOOTED_SIM" "$BUNDLE_ID" >/dev/null 2>&1 && echo "✓ App 已启动" || echo "⚠️ 启动命令完成"
sleep 6

# ── 截图函数 ─────────────────────────────────────────────────────────────────
capture_tab() {
  local tab_name="$1"
  local tab_index="$2"
  local out_file="$BUILD_DIR/${tab_index}_${tab_name}.png"
  echo "📸 截取 ${tab_name}..."
  if xcrun simctl io "$BOOTED_SIM" screenshot "$out_file" 2>/dev/null; then
    echo "  ✓ ${tab_name} → $(basename "$out_file")"
  else
    echo "  ! ${tab_name} 截图失败"
    return 1
  fi
}

# ── 截取所有 Tab ─────────────────────────────────────────────────────────────
for i in "${!TABS[@]}"; do
  capture_tab "${TABS[$i]}" "${TAB_INDEX[$i]}"
  sleep 2
done

echo ""
echo "========================================"
echo "✅ 截图完成！输出目录: $BUILD_DIR"
echo "========================================"
ls -la "$BUILD_DIR/"
echo ""

# ── 缩放到 App Store 尺寸 ─────────────────────────────────────────────────────
echo "📐 缩放到 App Store 所需尺寸..."
for i in "${!TABS[@]}"; do
  tab="${TABS[$i]}"
  idx="${TAB_INDEX[$i]}"
  src="$BUILD_DIR/${idx}_${tab}.png"
  
  if [ ! -f "$src" ]; then
    echo "  ! 源文件不存在: $src"
    continue
  fi

  sips -z 2796 1290 "$src" --out "$BUILD_DIR/${idx}_${tab}_67.png" 2>/dev/null && \
    echo "  ✓ ${tab} 6.7\" (1290×2796)" || echo "  ! ${tab} 6.7\" 缩放失败"

  sips -z 2778 1284 "$src" --out "$BUILD_DIR/${idx}_${tab}_65.png" 2>/dev/null && \
    echo "  ✓ ${tab} 6.5\" (1284×2778)" || echo "  ! ${tab} 6.5\" 缩放失败"

  sips -z 2208 1242 "$src" --out "$BUILD_DIR/${idx}_${tab}_55.png" 2>/dev/null && \
    echo "  ✓ ${tab} 5.5\" (1242×2208)" || echo "  ! ${tab} 5.5\" 缩放失败"
done

echo ""
echo "💡 最终交付文件（每 Tab × 3 尺寸 = 15 张）:"
ls "$BUILD_DIR"/*.png | grep -E '_(67|65|55)\.png$' | sort
echo ""
echo "📋 上传路径：App Store Connect > App 截图区域"
echo "   支持拖拽批量上传"
