"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appleAuthRelay = void 0;
const functionsV1 = require("firebase-functions/v1");
/**
 * Apple Auth Relay for Android.
 *
 * Apple's Sign In uses `form_post` response_mode, which POSTs the id_token
 * to the redirect URI. This Cloud Function receives that POST, extracts
 * the id_token, and returns an HTML page that redirects the browser back
 * to the native app using the riresume:// custom URL scheme.
 *
 * We use an HTML page with JavaScript + intent:// fallback instead of a
 * 302 redirect because Chrome Custom Tabs on Android don't reliably
 * follow 302 redirects to custom URL schemes.
 */
exports.appleAuthRelay = functionsV1
    .region("us-central1")
    .https.onRequest((req, res) => {
    // Apple POSTs the data as application/x-www-form-urlencoded
    const idToken = req.body?.id_token;
    const code = req.body?.code;
    const error = req.body?.error;
    console.log("[Apple Auth Relay] Method:", req.method);
    console.log("[Apple Auth Relay] Has id_token:", !!idToken);
    console.log("[Apple Auth Relay] Has code:", !!code);
    console.log("[Apple Auth Relay] Body keys:", Object.keys(req.body || {}));
    if (error) {
        console.error("[Apple Auth Relay] Error from Apple:", error);
        res.status(400).send(`
                <html><body>
                <p>Apple Sign-In failed: ${error}</p>
                <p>Please close this window and try again.</p>
                </body></html>
            `);
        return;
    }
    let appUrl = "";
    if (idToken) {
        appUrl = `riresume://apple-auth?id_token=${encodeURIComponent(idToken)}`;
    }
    else if (code) {
        appUrl = `riresume://apple-auth?code=${encodeURIComponent(code)}`;
    }
    if (appUrl) {
        console.log("[Apple Auth Relay] Sending redirect page");
        // Build an Android intent:// URL as fallback
        const intentUrl = appUrl
            .replace("riresume://", "intent://")
            .concat("#Intent;scheme=riresume;package=com.jsn22.riresume;end");
        res.status(200).send(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Completing Sign In...</title>
</head>
<body>
    <p>Completing Apple Sign-In, please wait...</p>
    <script>
        // Try custom scheme first
        window.location.href = "${appUrl}";
        // Fallback: try Android intent after a short delay
        setTimeout(function() {
            window.location.href = "${intentUrl}";
        }, 500);
    </script>
</body>
</html>`);
        return;
    }
    // Fallback - no token received
    console.log("[Apple Auth Relay] No token or code in request body");
    res.status(400).send(`
            <html><body>
            <p>Unable to complete Apple Sign-In. No token received.</p>
            <p>Please close this window and try again.</p>
            </body></html>
        `);
});
//# sourceMappingURL=appleAuthRelay.js.map