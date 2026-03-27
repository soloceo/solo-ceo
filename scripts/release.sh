#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────
#  SOLO CEO — One-Command Release Script
#  Usage: ./scripts/release.sh [version]
#  Example: ./scripts/release.sh 1.1.0
# ─────────────────────────────────────────────────────────

GH="/opt/homebrew/bin/gh"
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export JAVA_HOME
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

STEP=0
TOTAL_STEPS=10
START_TIME=$(date +%s)

log()  { STEP=$((STEP + 1)); echo -e "\n${CYAN}[${STEP}/${TOTAL_STEPS}]${NC} ${BOLD}$1${NC}"; }
ok()   { echo -e "${GREEN}  ✔${NC} $1"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $1"; }
fail() { echo -e "${RED}  ✗ $1${NC}"; exit 1; }
elapsed() { echo "$(( $(date +%s) - START_TIME ))s"; }

# Cleanup on failure
trap 'echo -e "\n${RED}  ✗ Release failed at step ${STEP}/${TOTAL_STEPS} ($(elapsed))${NC}"; exit 1' ERR

# ── 1. Version argument ──────────────────────────────────
log "Version setup"
VERSION="$1"
if [ -z "$VERSION" ]; then
  CURRENT=$(node -p "require('./package.json').version")
  echo ""
  echo -e "  Current version: ${CYAN}${CURRENT}${NC}"
  echo ""
  read -p "  Enter new version (e.g. 1.1.0): " VERSION
fi
[ -z "$VERSION" ] && fail "Version required"

# Validate version format
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  fail "Invalid version format: '$VERSION'. Use MAJOR.MINOR.PATCH (e.g. 1.1.0)"
fi

# Calculate versionCode from version string (1.0.9 → 10009, 1.1.0 → 10100)
IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"
VERSION_CODE=$((MAJOR * 10000 + MINOR * 100 + PATCH))

echo -e "  ${BOLD}Releasing v${VERSION}${NC} (versionCode=${VERSION_CODE})"

# ── 2. Pre-flight checks ─────────────────────────────────
log "Pre-flight checks"
command -v node >/dev/null || fail "Node.js not found"
command -v npx  >/dev/null || fail "npx not found"
"$JAVA_HOME/bin/java" -version >/dev/null 2>&1 || fail "Java not found at $JAVA_HOME"
ok "Node.js $(node -v) + Java ready"

# Check git state
if [ -n "$(git status --porcelain)" ]; then
  warn "Working directory has uncommitted changes (will be included in release commit)"
fi

GH_OK=false
if [ -f "$GH" ] && "$GH" auth status >/dev/null 2>&1; then
  GH_OK=true
  ok "GitHub CLI authenticated"
else
  warn "GitHub CLI not authenticated — will skip GitHub release"
fi

# ── 3. Update version in all configs ─────────────────────
log "Updating version numbers"

# package.json
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
  pkg.version = '${VERSION}';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
ok "package.json → ${VERSION}"

# Android build.gradle
if [ -f "android/app/build.gradle" ]; then
  sed -i '' "s/versionCode [0-9]*/versionCode ${VERSION_CODE}/" android/app/build.gradle
  sed -i '' "s/versionName \"[^\"]*\"/versionName \"${VERSION}\"/" android/app/build.gradle
  ok "Android build.gradle → ${VERSION} (code ${VERSION_CODE})"
else
  warn "Android build.gradle not found"
fi

# iOS (update Xcode project MARKETING_VERSION if pbxproj exists)
PBXPROJ="ios/App/App.xcodeproj/project.pbxproj"
if [ -f "$PBXPROJ" ]; then
  sed -i '' "s/MARKETING_VERSION = [^;]*/MARKETING_VERSION = ${VERSION}/" "$PBXPROJ"
  ok "iOS project → ${VERSION}"
else
  warn "iOS pbxproj not found — update manually in Xcode"
fi

# ── 4. Build web ─────────────────────────────────────────
log "Building web (Vite)"
STEP_START=$(date +%s)
npx vite build >/dev/null 2>&1
ok "Web build complete ($(( $(date +%s) - STEP_START ))s)"

# ── 5. Build macOS DMG ───────────────────────────────────
log "Building macOS DMG"
STEP_START=$(date +%s)
mkdir -p electron-dist && cp electron/main.cjs electron-dist/main.cjs
npx electron-builder --mac --arm64 2>&1 | tail -5
ok "DMG built ($(( $(date +%s) - STEP_START ))s)"

# Verify DMG exists
DMG_FILE="release/solo-ceo-${VERSION}-arm64.dmg"
[ -f "$DMG_FILE" ] && ok "DMG: $DMG_FILE ($(du -h "$DMG_FILE" | cut -f1))" || warn "DMG file not found at expected path"

# ── 6. Build Android APK ────────────────────────────────
log "Building Android APK"
STEP_START=$(date +%s)
npx cap sync android >/dev/null 2>&1
cd android && ./gradlew assembleDebug 2>&1 | tail -3
cd ..
APK_SRC="android/app/build/outputs/apk/debug/app-debug.apk"
APK_DST="release/solo-ceo-${VERSION}.apk"
if [ -f "$APK_SRC" ]; then
  cp "$APK_SRC" "$APK_DST"
  ok "APK built ($(( $(date +%s) - STEP_START ))s): $APK_DST ($(du -h "$APK_DST" | cut -f1))"
else
  warn "APK not found at $APK_SRC"
fi

# ── 7. Sync iOS ──────────────────────────────────────────
log "Syncing iOS (Capacitor)"
npx cap sync ios >/dev/null 2>&1
ok "iOS synced — open Xcode to archive"

# ── 8. Clean old release files ───────────────────────────
log "Cleaning old release artifacts"
find release -name "*.dmg" -not -name "*${VERSION}*" -delete 2>/dev/null || true
find release -name "*.zip" -not -name "*${VERSION}*" -delete 2>/dev/null || true
find release -name "*.apk" -not -name "*${VERSION}*" -delete 2>/dev/null || true
find release -name "*.blockmap" -delete 2>/dev/null || true
find release -name "*.yml" -delete 2>/dev/null || true
ok "Old artifacts removed"

# ── 9. Git commit + tag ──────────────────────────────────
log "Git commit & tag"

# Generate changelog from recent commits
PREV_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$PREV_TAG" ]; then
  CHANGELOG=$(git log "${PREV_TAG}..HEAD" --oneline --no-decorate 2>/dev/null | head -20)
else
  CHANGELOG=$(git log --oneline --no-decorate -20 2>/dev/null)
fi

git add -A
git commit -m "$(cat <<EOF
v${VERSION}: Release build

Changes:
$(echo "$CHANGELOG" | sed 's/^/- /')

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
git tag "v${VERSION}"
git push && git push --tags
ok "Pushed v${VERSION} to GitHub"

# ── 10. GitHub Release with bilingual notes ──────────────
log "GitHub Release"
if [ "$GH_OK" = true ]; then
  # Build changelog for release notes
  CHANGE_LIST=""
  if [ -n "$CHANGELOG" ]; then
    EN_CHANGES=$(echo "$CHANGELOG" | sed 's/^/- /')
    CHANGE_LIST="$EN_CHANGES"
  fi

  RELEASE_NOTES=$(cat <<NOTES_EOF
## What's New / 更新内容

### Changes
${CHANGE_LIST:-"- See commit history for detailed changes"}

### Downloads / 下载
| Platform | File | Notes |
|----------|------|-------|
| 🍎 macOS | \`solo-ceo-${VERSION}-arm64.dmg\` | Apple Silicon (M1/M2/M3/M4) |
| 🤖 Android | \`solo-ceo-${VERSION}.apk\` | Android 7.0+ |
| 📱 iOS | Via Xcode / TestFlight | Build from source |

### 中文说明
- macOS 用户下载 DMG 文件（Apple Silicon）
- Android 用户下载 APK 文件
- iOS 用户请通过 Xcode 或 TestFlight 安装

> 🤖 Generated with [Claude Code](https://claude.com/claude-code)
NOTES_EOF
)

  # Collect available release files
  RELEASE_FILES=""
  [ -f "release/solo-ceo-${VERSION}-arm64.dmg" ] && RELEASE_FILES="$RELEASE_FILES release/solo-ceo-${VERSION}-arm64.dmg"
  [ -f "release/solo-ceo-${VERSION}-arm64.zip" ] && RELEASE_FILES="$RELEASE_FILES release/solo-ceo-${VERSION}-arm64.zip"
  [ -f "release/solo-ceo-${VERSION}.apk" ] && RELEASE_FILES="$RELEASE_FILES release/solo-ceo-${VERSION}.apk"

  if [ -n "$RELEASE_FILES" ]; then
    # shellcheck disable=SC2086
    "$GH" release create "v${VERSION}" \
      $RELEASE_FILES \
      --title "v${VERSION}" \
      --notes "$RELEASE_NOTES"
    ok "GitHub Release created with $(echo $RELEASE_FILES | wc -w | tr -d ' ') files"
  else
    "$GH" release create "v${VERSION}" \
      --title "v${VERSION}" \
      --notes "$RELEASE_NOTES"
    warn "GitHub Release created (no binary files found)"
  fi
else
  warn "Skipped GitHub Release (gh not authenticated)"
fi

# ── Done ─────────────────────────────────────────────────
TOTAL_TIME=$(( $(date +%s) - START_TIME ))
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ v${VERSION} released successfully! (${TOTAL_TIME}s)${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
[ -f "release/solo-ceo-${VERSION}-arm64.dmg" ] && echo "  📦 macOS:   release/solo-ceo-${VERSION}-arm64.dmg ($(du -h "release/solo-ceo-${VERSION}-arm64.dmg" | cut -f1))"
[ -f "release/solo-ceo-${VERSION}.apk" ] && echo "  📦 Android: release/solo-ceo-${VERSION}.apk ($(du -h "release/solo-ceo-${VERSION}.apk" | cut -f1))"
echo "  📦 iOS:     Open Xcode → Archive → Upload to TestFlight"
echo ""
