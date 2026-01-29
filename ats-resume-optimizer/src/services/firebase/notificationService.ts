import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from './config';
import { router } from 'expo-router';

// Notification data types for deep-linking
export interface NotificationData {
    route?: string;
    params?: Record<string, string>;
}

/**
 * Resilient Notification Service
 * Uses a failsafe approach to load native modules.
 * Now includes local notification scheduling for background task completion.
 */
export class NotificationService {
    private _Device: any = null;
    private _Notifications: any = null;
    private _deviceFailed = false;
    private _notificationsFailed = false;
    private _responseListenerSubscription: any = null;

    private getDevice() {
        if (this._deviceFailed) return null;
        if (this._Device) return this._Device;
        if (Platform.OS === 'web') return null;

        try {
            // Check if the native module likely exists before requiring
            // This is a heuristic but often prevents the 'Cannot find native module' error 
            // from being non-catchable in some environments.
            this._Device = require('expo-device');
            if (!this._Device) {
                this._deviceFailed = true;
                return null;
            }
            return this._Device;
        } catch (e) {
            console.log("Notification Service: expo-device not available.");
            this._deviceFailed = true;
            return null;
        }
    }

    private getNotifications() {
        if (this._notificationsFailed) return null;
        if (this._Notifications) return this._Notifications;
        if (Platform.OS === 'web') return null;

        try {
            this._Notifications = require('expo-notifications');
            if (!this._Notifications || !this._Notifications.getPermissionsAsync) {
                this._notificationsFailed = true;
                return null;
            }
            return this._Notifications;
        } catch (e) {
            console.log("Notification Service: expo-notifications not available.");
            this._notificationsFailed = true;
            return null;
        }
    }

    /**
     * Set the notification handler safely
     */
    initHandler() {
        const Notifications = this.getNotifications();
        if (Notifications) {
            try {
                Notifications.setNotificationHandler({
                    handleNotification: async () => ({
                        shouldShowAlert: true,
                        shouldPlaySound: true,
                        shouldSetBadge: false,
                        shouldShowBanner: true,
                        shouldShowList: true
                    }),
                });
            } catch (e) {
                console.warn("Notification Service: Failed to set notification handler", e);
            }
        }
    }

    /**
     * Register for Push Notifications
     * Returns the token if successful, null otherwise
     */
    async registerForPushNotificationsAsync(): Promise<string | undefined> {
        let token;
        const Device = this.getDevice();
        const Notifications = this.getNotifications();

        if (!Device || !Notifications) {
            // No warning here to keep the console clean in dev environments
            return;
        }

        try {
            // Double check native availability inside try block
            let isDevice = false;
            try {
                isDevice = Device.isDevice;
            } catch (e) {
                this._deviceFailed = true;
                return;
            }

            if (isDevice) {
                if (Platform.OS === 'android') {
                    await Notifications.setNotificationChannelAsync('default', {
                        name: 'default',
                        importance: Notifications.AndroidImportance.MAX,
                        vibrationPattern: [0, 250, 250, 250],
                        lightColor: '#FF231F7C',
                    });
                }

                const { status: existingStatus } = await Notifications.getPermissionsAsync();
                let finalStatus = existingStatus;

                if (existingStatus !== 'granted') {
                    const { status } = await Notifications.requestPermissionsAsync();
                    finalStatus = status;
                }

                if (finalStatus !== 'granted') {
                    console.log('Failed to get push token for push notification!');
                    return;
                }

                const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

                try {
                    token = (await Notifications.getExpoPushTokenAsync({
                        projectId,
                    })).data;
                    console.log("Expo Push Token:", token);

                    await this.saveTokenToUserProfile(token);

                } catch (e) {
                    console.error("Error fetching push token:", e);
                }
            } else {
                console.log('Must use physical device for Push Notifications');
            }
        } catch (error) {
            console.warn("Notification Service Error:", error);
        }

        return token;
    }

    /**
     * Save the token to the user's profile
     */
    async saveTokenToUserProfile(token: string) {
        const user = auth.currentUser;
        if (user) {
            const userRef = doc(db, 'users', user.uid);
            try {
                await updateDoc(userRef, {
                    pushTokens: arrayUnion(token)
                });
            } catch (error) {
                console.error("Error saving push token to profile:", error);
            }
        }
    }

    /**
     * Setup listeners with deep-linking support
     */
    setupNotificationListeners() {
        const Notifications = this.getNotifications();
        if (!Notifications) return () => { };

        try {
            const notificationListener = Notifications.addNotificationReceivedListener((notification: any) => {
                console.log("Notification Received:", notification);
            });

            const responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
                console.log("Notification Clicked:", response);
                this.handleNotificationResponse(response);
            });

            // Store subscription for potential cleanup
            this._responseListenerSubscription = responseListener;

            return () => {
                notificationListener.remove();
                responseListener.remove();
            };
        } catch (e) {
            console.warn("Notification Service: Failed to setup listeners", e);
            return () => { };
        }
    }

    /**
     * Handle notification tap and navigate to the appropriate screen
     */
    private handleNotificationResponse(response: any) {
        try {
            const data = response?.notification?.request?.content?.data as NotificationData;
            if (data?.route) {
                console.log("Navigating to route:", data.route, "with params:", data.params);
                // Small delay to ensure app is ready
                setTimeout(() => {
                    if (data.params) {
                        router.push({ pathname: data.route as any, params: data.params });
                    } else {
                        router.push(data.route as any);
                    }
                }, 100);
            }
        } catch (e) {
            console.warn("Notification Service: Failed to handle notification response", e);
        }
    }

    /**
     * Schedule a local push notification
     * Returns the notification identifier if successful
     */
    async scheduleLocalNotification(
        title: string,
        body: string,
        data?: NotificationData
    ): Promise<string | undefined> {
        const Notifications = this.getNotifications();
        if (!Notifications) {
            console.log("Notification Service: Cannot schedule - notifications not available");
            return undefined;
        }

        try {
            const identifier = await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: data || {},
                    sound: true,
                    color: '#2196F3',
                    channelId: 'default',
                    priority: 'max',
                },
                trigger: null, // Immediate delivery
            });
            console.log("Local notification scheduled:", identifier);
            return identifier;
        } catch (e) {
            console.warn("Notification Service: Failed to schedule local notification", e);
            return undefined;
        }
    }

    // ==========================================
    // Predefined Notification Templates
    // ==========================================

    /**
     * Notify when resume analysis is complete
     */
    async notifyAnalysisComplete(
        jobTitle: string,
        company: string,
        score: number,
        analysisId: string
    ): Promise<void> {
        await this.scheduleLocalNotification(
            "Analysis Complete",
            `Your resume for ${jobTitle} at ${company} scored ${score}%`,
            {
                route: '/analysis-result',
                params: { id: analysisId }
            }
        );
    }

    /**
     * Notify when resume optimization is complete
     */
    async notifyOptimizationComplete(
        jobTitle: string,
        company: string,
        analysisId: string,
        score?: number
    ): Promise<void> {
        const body = score
            ? `Your resume for ${jobTitle} at ${company} scored ${score}% after optimization`
            : `Your resume for ${jobTitle} at ${company} has been optimized`;

        await this.scheduleLocalNotification(
            "Resume Optimized",
            body,
            {
                route: '/analysis-result',
                params: { id: analysisId }
            }
        );
    }

    /**
     * Notify when skill addition is complete
     */
    async notifySkillAdditionComplete(
        jobTitle: string,
        company: string,
        analysisId: string
    ): Promise<void> {
        await this.scheduleLocalNotification(
            "Optimization Complete",
            "Your resume has been rewriten and optimized",
            {
                route: '/analysis-result',
                params: { id: analysisId }
            }
        );
    }

    /**
     * Notify when resume validation/save is complete
     */
    async notifyValidationComplete(
        jobTitle: string,
        analysisId: string
    ): Promise<void> {
        await this.scheduleLocalNotification(
            "Resume Saved",
            `Your optimized resume for ${jobTitle} has been validated and saved`,
            {
                route: '/analysis-result',
                params: { id: analysisId }
            }
        );
    }

    /**
     * Notify when prep guide generation is complete
     */
    async notifyPrepGuideComplete(
        jobTitle: string,
        company: string,
        applicationId: string
    ): Promise<void> {
        await this.scheduleLocalNotification(
            "Prep Guide Ready",
            `Your interview prep guide for ${jobTitle} at ${company} is ready`,
            {
                route: '/(tabs)/applications',
                params: { appId: applicationId, action: 'viewPrep' }
            }
        );
    }

    /**
     * Notify when cover letter generation is complete
     */
    async notifyCoverLetterComplete(
        jobTitle: string,
        company: string,
        applicationId: string
    ): Promise<void> {
        await this.scheduleLocalNotification(
            "Cover Letter Ready",
            `Your cover letter for ${jobTitle} at ${company} is ready`,
            {
                route: '/(tabs)/applications',
                params: { appId: applicationId, action: 'viewCoverLetter' }
            }
        );
    }

    /**
     * Notify when learning module is complete
     */
    async notifyLearningComplete(skillName: string): Promise<void> {
        await this.scheduleLocalNotification(
            "Training Complete",
            `You've completed the ${skillName} training module`,
            {
                route: '/(tabs)/learning'
            }
        );
    }
    /**
     * Notify when app is backgrounded during active task
     */
    async notifyBackgroundWarning(): Promise<void> {
        await this.scheduleLocalNotification(
            "Analysis Paused",
            "Please return to the app to continue the analysis.",
            {
                route: '/(tabs)/analyze'
            }
        );
    }
}


export const notificationService = new NotificationService();
notificationService.initHandler();
