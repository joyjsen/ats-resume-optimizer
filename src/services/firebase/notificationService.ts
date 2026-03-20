import { Platform } from 'react-native';
import { getFirestoreDb, getFirebaseAuth } from './config';
import { router } from 'expo-router';

export class NotificationService {
    private _Device: any = null;
    private _Notifications: any = null;
    private _deviceFailed = false;
    private _notificationsFailed = false;
    private _handledNotificationIds = new Set<string>();

    private async getDevice() {
        if (this._deviceFailed || Platform.OS === 'web') return null;
        if (this._Device) return this._Device;
        try {
            this._Device = await import('expo-device');
            return this._Device;
        } catch (e) {
            this._deviceFailed = true;
            return null;
        }
    }

    private async getNotifications() {
        if (this._notificationsFailed || Platform.OS === 'web') return null;
        if (this._Notifications) return this._Notifications;
        try {
            this._Notifications = await import('expo-notifications');
            return this._Notifications;
        } catch (e) {
            this._notificationsFailed = true;
            return null;
        }
    }

    async initHandler() {
        const Notifications = await this.getNotifications();
        if (!Notifications) return;
        try {
            Notifications.setNotificationHandler({
                handleNotification: async (notification: any) => {
                    const data = notification.request.content.data;
                    if (data?.uid) {
                        const { userService } = await import('./userService');
                        const settings = await userService.getUserProfile(data.uid);
                        if (settings && !settings.notificationsEnabled) {
                            return { shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: false };
                        }
                    }
                    return { shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true };
                },
            });

            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }
        } catch (e) { }
    }

    async registerForPushNotificationsAsync(): Promise<string | undefined> {
        const Device = await this.getDevice();
        const Notifications = await this.getNotifications();
        console.log(`[NotificationService] Registering. Device: ${!!Device}, Notifications: ${!!Notifications}, IsDevice: ${Device?.isDevice}`);
        if (!Device || !Notifications || !Device.isDevice) return;

        try {
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                });
            }

            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            console.log(`[NotificationService] Existing status: ${existingStatus}`);
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            console.log(`[NotificationService] Final status: ${finalStatus}`);
            if (finalStatus !== 'granted') return;

            const { default: Constants } = await import('expo-constants');
            const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

            const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            console.log(`[NotificationService] Generated Expo Token: ${token.substring(0, 20)}...`);
            await this.saveTokenToUserProfile(token);

            if (Platform.OS === 'android') {
                const deviceToken = await Notifications.getDevicePushTokenAsync();
                if (deviceToken?.data) await this.saveFcmTokenToUserProfile(deviceToken.data);
            }
            return token;
        } catch (error) { }
    }

    async saveTokenToUserProfile(token: string) {
        const auth = await getFirebaseAuth();
        if (auth.currentUser) {
            const { doc, updateDoc, arrayUnion } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            await updateDoc(doc(db, 'users', auth.currentUser.uid), { pushTokens: arrayUnion(token) });
        }
    }

    async saveFcmTokenToUserProfile(token: string) {
        const auth = await getFirebaseAuth();
        if (auth.currentUser) {
            const { doc, updateDoc, arrayUnion } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            await updateDoc(doc(db, 'users', auth.currentUser.uid), { fcmTokens: arrayUnion(token) });
        }
    }

    setupNotificationListeners() {
        const init = async () => {
            const Notifications = await this.getNotifications();
            if (!Notifications) return () => { };

            const navigateWhenReady = (route: string, params?: any) => {

                // On Android cold starts, the app may not be ready for navigation immediately.
                // We poll until the profile store is initialized before navigating.
                const maxWaitMs = 5000;
                const pollIntervalMs = 200;
                let waited = 0;

                const attemptNavigation = () => {
                    try {
                        // Import profileStore to check if app is initialized
                        const { useProfileStore } = require('../../store/profileStore');
                        const state = useProfileStore.getState();

                        if (state.isInitialized && state.userProfile) {
                            console.log(`[NotificationService] App ready. Navigating to ${route}`);
                            if (params) {
                                router.push({ pathname: route as any, params });
                            } else {
                                router.push(route as any);
                            }
                            return;
                        }
                    } catch (e) {
                        // Store not available yet, keep polling
                    }

                    waited += pollIntervalMs;
                    if (waited < maxWaitMs) {
                        setTimeout(attemptNavigation, pollIntervalMs);
                    } else {
                        // Fallback: navigate anyway after max wait
                        console.warn(`[NotificationService] Max wait reached. Navigating to ${route} anyway.`);
                        if (params) {
                            router.push({ pathname: route as any, params });
                        } else {
                            router.push(route as any);
                        }
                    }
                };

                // Start with a small initial delay to let React render cycle settle
                const initialDelay = Platform.OS === 'android' ? 300 : 100;
                setTimeout(attemptNavigation, initialDelay);
            };

            const nSub = Notifications.addNotificationReceivedListener((n: any) => console.log(n));
            const rSub = Notifications.addNotificationResponseReceivedListener((r: any) => {
                const data = r?.notification?.request?.content?.data;
                const notifId = r?.notification?.request?.identifier;
                if (data?.route) {
                    // Skip if already handled (e.g. from cold start handler)
                    if (notifId && this._handledNotificationIds.has(notifId)) {
                        console.log(`[NotificationService] Response listener: notification ${notifId} already handled, skipping.`);
                        return;
                    }
                    if (notifId) this._handledNotificationIds.add(notifId);
                    console.log(`[NotificationService] Notification tapped. Route: ${data.route}, Params:`, data.params);
                    navigateWhenReady(data.route, data.params);
                }
            });

            // Handle cold start: check if app was opened via a notification tap
            try {
                const lastResponse = await Notifications.getLastNotificationResponseAsync();
                if (lastResponse) {
                    const notifId = lastResponse?.notification?.request?.identifier;
                    const data = lastResponse?.notification?.request?.content?.data;
                    if (data?.route && notifId && !this._handledNotificationIds.has(notifId)) {
                        console.log(`[NotificationService] Cold start notification detected. Route: ${data.route}, ID: ${notifId}`);
                        this._handledNotificationIds.add(notifId);
                        navigateWhenReady(data.route, data.params);
                    } else if (notifId) {
                        console.log(`[NotificationService] Cold start notification already handled: ${notifId}`);
                    }
                }
            } catch (e) {
                console.warn('[NotificationService] Could not check last notification response:', e);
            }

            return () => { nSub.remove(); rSub.remove(); };
        };
        const promise = init();
        return () => { promise.then(unsub => unsub?.()); };
    }

    async scheduleLocalNotification(title: string, body: string, data?: any): Promise<string | undefined> {
        const Notifications = await this.getNotifications();
        if (!Notifications) return;
        try {
            if (data?.uid) {
                const { doc, updateDoc, arrayUnion } = await import('firebase/firestore');
                const db = await getFirestoreDb();
                await updateDoc(doc(db, 'users', data.uid), {
                    notifications: arrayUnion({ id: Math.random().toString(36).substr(2, 9), title, body, timestamp: new Date().toISOString(), read: false, data })
                });
            }
            return await Notifications.scheduleNotificationAsync({
                content: { title, body, data: data || {}, sound: true, priority: 'max' },
                trigger: null,
            });
        } catch (e) { return undefined; }
    }

    // Templates
    async notifyAnalysisComplete(jobTitle: string, company: string, score: number, analysisId: string) {
        await this.scheduleLocalNotification("Analysis Complete", `Your resume for ${jobTitle} at ${company} scored ${score}%`, { route: '/analysis-result', params: { id: analysisId } });
    }

    async notifyParsingFailed() {
        await this.scheduleLocalNotification("Parsing Failed", "We could not extract text from your document. Please try a different file format (PDF, DOCX).");
    }

    async notifyParsingComplete() {
        await this.scheduleLocalNotification("Parsing Complete", "Your resume has been successfully parsed and structured. Tap to verify the extracted data.");
    }

    async notifyBackgroundWarning() {
        await this.scheduleLocalNotification("Parsing Paused", "Resume parsing might be paused because the app was minimized. Return to the app to continue.");
    }
}

export const notificationService = new NotificationService();
notificationService.initHandler();
