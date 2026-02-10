#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-9222}"
TARGET_URL="${TARGET_URL:-https://blog.miniasp.com/post/2026/02/08/How-to-install-and-set-up-Cloudflare-Tunnel-service-on-Windows}"
OUT_DIR="${OUT_DIR:-materials/alt-verify-$(TZ=Asia/Taipei date +%Y%m%d-%H%M%S)}"

mkdir -p "$OUT_DIR"

if ! curl -sf "http://localhost:${PORT}/json/version" > "$OUT_DIR/cdp-version.json"; then
  echo "❌ CDP 未啟動或不可達 (port ${PORT})" >&2
  exit 1
fi

START_TS="$(TZ=Asia/Taipei date +"%Y-%m-%d %H:%M:%S")"

osascript <<APPLESCRIPT
tell application "Google Chrome"
  if not (exists window 1) then make new window
  set URL of active tab of window 1 to "${TARGET_URL}"
  activate
end tell
APPLESCRIPT

echo "請完成登入與操作後按 Enter 產生快照"
read -r

END_TS="$(TZ=Asia/Taipei date +"%Y-%m-%d %H:%M:%S")"
printf "start=%s\nend=%s\nurl=%s\n" "$START_TS" "$END_TS" "$TARGET_URL" > "$OUT_DIR/recording.log"

osascript <<'APPLESCRIPT' > "$OUT_DIR/aria-snapshot.json"
tell application "Google Chrome"
  set js to "(() => { const items = []; document.querySelectorAll('*').forEach(el => { const attrs = {}; let has = false; for (const a of el.attributes) { if (a.name === 'role' || a.name.startsWith('aria-')) { attrs[a.name]=a.value; has = true; } } if (has) { items.push({ tag: el.tagName, text: (el.innerText || '').trim().slice(0,120), attrs }); } }); return JSON.stringify({ url: location.href, items }, null, 2); })()"
  return execute active tab of window 1 javascript js
end tell
APPLESCRIPT

osascript <<'APPLESCRIPT' > "$OUT_DIR/page.html"
tell application "Google Chrome"
  return execute active tab of window 1 javascript "document.documentElement.outerHTML"
end tell
APPLESCRIPT

screencapture -x "$OUT_DIR/screenshot.png"

echo "✅ 產出：$OUT_DIR/cdp-version.json, aria-snapshot.json, page.html, screenshot.png, recording.log"
