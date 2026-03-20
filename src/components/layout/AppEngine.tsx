import React, { useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { authService, UserInactiveError } from '../../services/firebase/authService';
import { notificationService } from '../../services/firebase/notificationService';
import { useProfileStore } from '../../store/profileStore';
import { useResumeStore } from '../../store/resumeStore';
import { useShareIntentHandler } from '../../hooks/useShareIntentHandler';
import { iapService } from '../../services/iap/iapService';

/**
 * AppEngine isolates heavy root logic (Auth, Notifications, IAP, Share Intents)
 * to prevent these SDKs from being bundled into the initial Landing Page load.
 */
export const AppEngine = () => {
    const segments = useSegments();
    const router = useRouter();
    const { userProfile, setUserProfile, isInitialized, setInitialized } = useProfileStore();
    const { setPendingSharedUrl, setPendingSharedText, pendingSharedUrl } = useResumeStore();
    const { sharedUrl, sharedContent, clearSharedUrl } = useShareIntentHandler();
    const isMounted = useRef(false);

    // Auth subscription engine
    useEffect(() => {
        isMounted.current = true;
        let authUnsubscribe: (() => void) | null = null;
        let isCancelled = false;
        let isFirstCallback = true;
        let initTimer: ReturnType<typeof setTimeout> | null = null;

        const setupAuth = async () => {
            const unsub = await authService.subscribeToAuthChanges((profile, error) => {
                if (isMounted.current && !isCancelled) {
                    if (error) {
                        console.error("Auth error in engine:", error);
                        if (error instanceof UserInactiveError) {
                            Alert.alert("Account Inactive", error.message);
                        }
                    }

                    // On native: when auth fires with null on first callback (app start/reload),
                    // delay setInitialized to give AsyncStorage auth restoration time.
                    // On web: Firebase auth uses cookies/localStorage and resolves immediately, no delay needed.
                    if (isFirstCallback && !profile && !error && Platform.OS !== 'web') {
                        isFirstCallback = false;
                        initTimer = setTimeout(() => {
                            if (isMounted.current && !isCancelled) {
                                setUserProfile(null);
                                setInitialized(true);
                            }
                        }, 800);
                        return;
                    }

                    isFirstCallback = false;
                    // Cancel any pending delayed init — real auth data arrived
                    if (initTimer) {
                        clearTimeout(initTimer);
                        initTimer = null;
                    }
                    setUserProfile(profile);
                    setInitialized(true);
                }
            });
            
            if (isCancelled) {
                if (typeof unsub === 'function') unsub();
            } else {
                authUnsubscribe = unsub as any;
            }
        };

        setupAuth();

        return () => {
            isMounted.current = false;
            isCancelled = true;
            if (initTimer) clearTimeout(initTimer);
            if (typeof authUnsubscribe === 'function') {
                authUnsubscribe();
            }
        };
    }, []);

    // Notification engine
    useEffect(() => {
        notificationService.initHandler();
    }, []);

    // Heavy app services engine
    useEffect(() => {
        if (userProfile && isInitialized) {
            const cleanupListeners = notificationService.setupNotificationListeners();
            notificationService.registerForPushNotificationsAsync().catch(console.error);

            if (Platform.OS === 'ios') {
                iapService.initialize().catch(err => {
                    console.warn('[Engine] IAP initialization failed:', err);
                });
            }

            return () => {
                cleanupListeners();
            };
        }
    }, [userProfile, isInitialized]);

    // Share Intent engine — simple timestamp debounce to prevent duplicate alerts
    const lastAlertTimeRef = useRef<number>(0);

    const showAnalyzeAlert = () => {
        // Timestamp debounce: prevent duplicate alerts within 5 seconds
        const now = Date.now();
        if (now - lastAlertTimeRef.current < 5000) return;
        lastAlertTimeRef.current = now;

        const isAlreadyOnAnalyze = segments.some(s => s === 'analyze');
        if (isAlreadyOnAnalyze) return;

        Alert.alert(
            "Job URL Detected",
            "A shared job URL has been received. Tap below to start your analysis.",
            [
                { text: "Go to Analyze", isPreferred: true, onPress: () => router.replace('/(tabs)/analyze' as any) }
            ]
        );
    };

    useEffect(() => {
        if (sharedUrl && isMounted.current) {
            // Capture URL before clearing
            const capturedUrl = sharedUrl;
            console.log("[Engine] Share Intent detected:", capturedUrl);

            setPendingSharedUrl(capturedUrl);
            if (sharedContent) {
                setPendingSharedText(sharedContent);
            }
            clearSharedUrl();

            // For logged-in users: show alert immediately
            if (userProfile && isInitialized) {
                const hasNameInfo = !!((userProfile.firstName && userProfile.lastName) || userProfile.displayName);
                const isProfileComplete = !!(userProfile.profileCompleted || (hasNameInfo && userProfile.targetJobTitle && (userProfile.targetIndustry || userProfile.industry)));

                console.log("[Engine] Profile check:", { isProfileComplete, hasNameInfo });

                if (isProfileComplete) {
                    setTimeout(() => showAnalyzeAlert(), 300);
                } else {
                    // Profile not complete but user is logged in — show alert anyway
                    // They can complete profile later
                    setTimeout(() => showAnalyzeAlert(), 300);
                }
            }
        }
    }, [sharedUrl]);

    // Fallback: for users who share a URL before logging in (alert shows after login completes)
    useEffect(() => {
        if (!pendingSharedUrl || !userProfile || !isInitialized) return;

        showAnalyzeAlert();
    }, [pendingSharedUrl, userProfile, isInitialized]);

    return null; // Side-effect only component
};

export default AppEngine;
