import { defineSecret } from "firebase-functions/params";

export const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
export const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
export const appleSharedSecret = defineSecret("APPLE_SHARED_SECRET");
