#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="$ROOT/macos/CloudCinemaMac"
OUTPUT="$ROOT/macos/dist"
APP="$OUTPUT/CloudCinema.app"
IINA_FRAMEWORKS="/Applications/IINA.app/Contents/Frameworks"
SDK="/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk"
SWIFT_SCRATCH="/tmp/cloudcinema-swift-build"

if [[ ! -f "$IINA_FRAMEWORKS/libmpv.2.dylib" ]]; then
  echo "IINA is required at /Applications/IINA.app to bundle libmpv." >&2
  exit 1
fi

rm -rf "$OUTPUT"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$APP/Contents/Frameworks"

cd "$PROJECT"
CLANG_MODULE_CACHE_PATH="/tmp/cloudcinema-module-cache" \
  SDKROOT="$SDK" \
  swift build -c release --scratch-path "$SWIFT_SCRATCH"
cp "$SWIFT_SCRATCH/arm64-apple-macosx/release/CloudCinema" "$APP/Contents/MacOS/CloudCinema"
cp "$ROOT/public/app_icon.png" "$APP/Contents/Resources/AppIcon.png"
cp "$IINA_FRAMEWORKS"/*.dylib "$APP/Contents/Frameworks/"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>CloudCinema</string>
<key>CFBundleIdentifier</key><string>com.cloudcinema.mac</string>
<key>CFBundleName</key><string>CloudCinema</string>
<key>CFBundleDisplayName</key><string>CloudCinema</string>
<key>CFBundleVersion</key><string>2</string>
<key>CFBundleShortVersionString</key><string>1.1</string>
<key>LSMinimumSystemVersion</key><string>15.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSPrincipalClass</key><string>NSApplication</string>
<key>CFBundleIconFile</key><string>AppIcon.png</string>
<key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoads</key><false/></dict>
</dict></plist>
PLIST

install_name_tool -add_rpath "@executable_path/../Frameworks" "$APP/Contents/MacOS/CloudCinema" 2>/dev/null || true
codesign --force --deep --sign - "$APP"

hdiutil create -volname "CloudCinema" -srcfolder "$APP" -ov -format UDZO "$OUTPUT/CloudCinema-macOS-v1.1.dmg"
echo "$APP"
echo "$OUTPUT/CloudCinema-macOS-v1.1.dmg"
