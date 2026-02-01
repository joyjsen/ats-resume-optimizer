"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhookSecret = exports.stripeSecretKey = void 0;
const params_1 = require("firebase-functions/params");
exports.stripeSecretKey = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
exports.stripeWebhookSecret = (0, params_1.defineSecret)("STRIPE_WEBHOOK_SECRET");
//# sourceMappingURL=secrets.js.map