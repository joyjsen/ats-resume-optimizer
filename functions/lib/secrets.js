"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blotatoApiKey = exports.openRouterApiKey = exports.appleSharedSecret = exports.stripeWebhookSecret = exports.stripeSecretKey = void 0;
const params_1 = require("firebase-functions/params");
exports.stripeSecretKey = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
exports.stripeWebhookSecret = (0, params_1.defineSecret)("STRIPE_WEBHOOK_SECRET");
exports.appleSharedSecret = (0, params_1.defineSecret)("APPLE_SHARED_SECRET");
exports.openRouterApiKey = (0, params_1.defineSecret)("OPENROUTER_API_KEY");
exports.blotatoApiKey = (0, params_1.defineSecret)("BLOTATO_API_KEY");
//# sourceMappingURL=secrets.js.map