import * as admin from "firebase-admin";

/**
 * Send Push Notification
 * Uses direct FCM (Firebase Cloud Messaging) as the primary method for Android,
 * with Expo Push API as a fallback. Direct FCM is more reliable for background delivery.
 */
export async function sendPush(uid: string, title: string, body: string, data?: any) {
    console.log(`[sendPush] Attempting to send push to user ${uid}: "${title}"`);
    try {
        const userDoc = await admin.firestore().collection("users").doc(uid).get();
        if (!userDoc.exists) {
            console.warn(`[sendPush] User ${uid} not found in Firestore. Cannot send push.`);
            return;
        }

        const userData = userDoc.data();

        // Stringify data values for FCM (FCM data must be string values)
        const stringData: Record<string, string> = {};
        if (data) {
            for (const [key, value] of Object.entries(data)) {
                if (value !== null && value !== undefined) {
                    stringData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
                }
            }
        }

        // --- Method 1: Direct FCM (most reliable for Android background) ---
        let fcmSent = false;
        const fcmTokens = userData?.fcmTokens || [];
        const validFcmTokens = (Array.isArray(fcmTokens) ? fcmTokens : [fcmTokens])
            .filter((t: any) => typeof t === 'string' && t.length > 20);

        if (validFcmTokens.length > 0) {
            console.log(`[sendPush] Trying direct FCM with ${validFcmTokens.length} token(s)...`);

            for (const fcmToken of validFcmTokens) {
                try {
                    await admin.messaging().send({
                        token: fcmToken,
                        notification: {
                            title,
                            body,
                        },
                        data: stringData,
                        android: {
                            priority: 'high',
                            notification: {
                                channelId: 'default',
                                priority: 'max',
                                defaultSound: true,
                                defaultVibrateTimings: true,
                                visibility: 'public',
                                icon: 'ic_launcher',
                                color: '#6200ee',
                            },
                        },
                        apns: {
                            payload: {
                                aps: {
                                    alert: { title, body },
                                    sound: 'default',
                                    badge: 1,
                                    contentAvailable: true,
                                    mutableContent: true,
                                    interruptionLevel: 'active',
                                },
                            },
                        },
                    });
                    console.log(`[sendPush] FCM direct send successful for token: ${fcmToken.substring(0, 20)}...`);
                    fcmSent = true;
                } catch (fcmError: any) {
                    console.error(`[sendPush] FCM direct send failed for token ${fcmToken.substring(0, 20)}...:`, fcmError.message);

                    // Remove invalid FCM tokens
                    if (fcmError.code === 'messaging/registration-token-not-registered' ||
                        fcmError.code === 'messaging/invalid-registration-token') {
                        console.log(`[sendPush] Removing invalid FCM token from user ${uid}`);
                        await admin.firestore().collection("users").doc(uid).update({
                            fcmTokens: admin.firestore.FieldValue.arrayRemove(fcmToken)
                        }).catch(e => console.error(`[sendPush] Failed to remove FCM token:`, e));
                    }
                }
            }
        }

        // --- Method 2: Expo Push API (fallback, or if no FCM tokens) ---
        let rawTokens = userData?.pushTokens || [];
        if (typeof rawTokens === 'object' && !Array.isArray(rawTokens)) {
            rawTokens = Object.values(rawTokens).flat();
        }

        const expoTokens = (Array.isArray(rawTokens) ? rawTokens : [rawTokens])
            .filter((t: any) => typeof t === 'string' && t.startsWith('ExponentPushToken'));

        if (expoTokens.length > 0) {
            // Always also send via Expo for iOS reliability and as Android fallback
            console.log(`[sendPush] Sending via Expo Push API to ${expoTokens.length} token(s)${fcmSent ? ' (as additional delivery path)' : ' (primary delivery)'}...`);

            for (const token of expoTokens) {
                try {
                    const message = {
                        to: token,
                        sound: "default",
                        title,
                        body,
                        data,
                        priority: 'high',
                        channelId: 'default',
                        mutableContent: true,
                        interruptionLevel: 'active',
                        badge: 1,
                        projectId: "3584d443-a654-4a9b-98bb-8344ba4c3110",
                    };

                    const response = await fetch("https://exp.host/--/api/v2/push/send", {
                        method: "POST",
                        headers: {
                            Accept: "application/json",
                            "Accept-encoding": "gzip, deflate",
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(message),
                    });

                    const responseData = await response.json() as any;

                    if (responseData.data && responseData.data.status === 'error') {
                        console.error(`[sendPush] Expo error for token ${token}: ${responseData.data.message}`);

                        const isPermanentFailure =
                            responseData.data.details?.error === 'DeviceNotRegistered' ||
                            responseData.data.message?.includes('not a valid');

                        if (isPermanentFailure) {
                            console.log(`[sendPush] Removing invalid Expo token from user ${uid}: ${token}`);
                            await admin.firestore().collection("users").doc(uid).update({
                                pushTokens: admin.firestore.FieldValue.arrayRemove(token)
                            }).catch(e => console.error(`[sendPush] Failed to remove token:`, e));
                        }
                    } else {
                        console.log(`[sendPush] Expo send successful for token: ${token.substring(0, 25)}...`);
                    }
                } catch (tokenError) {
                    console.error(`[sendPush] Expo send failed for token ${token}:`, tokenError);
                }
            }
        }

        if (!fcmSent && expoTokens.length === 0) {
            console.warn(`[sendPush] User ${uid} has no valid push tokens (FCM or Expo).`);
        }

    } catch (error) {
        console.error("[sendPush] Error in sendPush:", error);
    }
}
