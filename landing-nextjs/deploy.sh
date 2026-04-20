#!/bin/bash
# =============================================================
# deploy.sh — Build + Deploy Next.js Landing Page to IONOS
# =============================================================
# Usage:
#   ./landing-nextjs/deploy.sh           ← build only
#   ./landing-nextjs/deploy.sh --deploy  ← build + upload to IONOS
# =============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$SCRIPT_DIR/out"

HOST="access-5019864019.webspace-host.com"
REMOTE_USER="a2016978"

echo "🛠  Building Next.js landing page..."
cd "$SCRIPT_DIR"
npm run build

echo ""
echo "✅ Build complete!"
echo "   Output: $OUT_DIR"
echo "   Files:"
ls -lh "$OUT_DIR/index.html" "$OUT_DIR/sitemap.xml" "$OUT_DIR/robots.txt" 2>/dev/null

# Deploy if --deploy flag is passed
if [ "$1" = "--deploy" ]; then
    echo ""
    echo "🚀 Deploying to IONOS..."
    echo "   Target: $REMOTE_USER@$HOST"
    rsync -avz -e ssh "$OUT_DIR/" "$REMOTE_USER@$HOST:."

    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Deployment successful!"
        echo "🌍 Visit: https://www.riresume.com"
    else
        echo "❌ Deployment failed. Check connection or password."
    fi
else
    echo ""
    echo "💡 To deploy, run: ./landing-nextjs/deploy.sh --deploy"
fi
