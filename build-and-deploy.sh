#!/bin/bash
# =============================================================
# build-and-deploy.sh — Build + SEO Injection + IONOS Deploy
# =============================================================
# Usage: ./build-and-deploy.sh [--deploy]
#   Without --deploy, only builds and injects SEO tags.
#   With --deploy, also uploads to IONOS via rsync.
# =============================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$PROJECT_DIR/dist"
SEO_TEMPLATE="$PROJECT_DIR/web/index.html"
PUBLIC_DIR="$PROJECT_DIR/public"

HOST="access-5019864019.webspace-host.com"
REMOTE_USER="a2016978"

echo "🛠  Building web app..."
cd "$PROJECT_DIR"
npx expo export --platform web

echo ""
echo "🔍 Injecting SEO template into dist/index.html..."

# Read the script tag from the generated dist/index.html
SCRIPT_TAG=$(grep '<script src="/_expo/static/js' "$DIST_DIR/index.html" || true)

if [ -z "$SCRIPT_TAG" ]; then
    echo "⚠️  Warning: Could not find the Expo JS bundle script tag in dist/index.html"
    echo "   Using fallback — the SEO template will be copied without the JS bundle reference."
    cp "$SEO_TEMPLATE" "$DIST_DIR/index.html"
else
    echo "   Found bundle: $SCRIPT_TAG"
    # Copy the SEO template and inject the script tag before </body>
    sed "s|</body>|$SCRIPT_TAG\n</body>|" "$SEO_TEMPLATE" > "$DIST_DIR/index.html"
fi

# Copy public assets (robots.txt, sitemap.xml, apple-touch-icon, .htaccess, og-image, etc.)
echo "📦 Copying public assets to dist..."
cp -r "$PUBLIC_DIR/." "$DIST_DIR/" 2>/dev/null || true

echo ""
echo "✅ Build complete! dist/index.html now includes full SEO tags."
echo "   Size: $(wc -c < "$DIST_DIR/index.html") bytes"

# Deploy if --deploy flag is passed
if [ "$1" = "--deploy" ]; then
    echo ""
    echo "🚀 Deploying to IONOS..."
    echo "   Target: $REMOTE_USER@$HOST"
    rsync -avz -e ssh "$DIST_DIR/" "$REMOTE_USER@$HOST:."
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Deployment successful!"
        echo "🌍 Visit: https://www.riresume.com"
    else
        echo "❌ Deployment failed. Check connection or password."
    fi
else
    echo ""
    echo "💡 To deploy, run: ./build-and-deploy.sh --deploy"
fi
