import { Platform } from 'react-native';
import { ENV } from '../../config/env';
// No top-level imports to ensure zero Firebase in initial bundle


const firebaseConfig = {
    apiKey: ENV.FIREBASE_API_KEY,
    authDomain: ENV.FIREBASE_AUTH_DOMAIN,
    projectId: ENV.FIREBASE_PROJECT_ID,
    storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
    appId: Platform.select({
        ios: ENV.FIREBASE_APP_ID_IOS,
        android: ENV.FIREBASE_APP_ID_ANDROID,
        default: ENV.FIREBASE_APP_ID_WEB || ENV.FIREBASE_APP_ID_IOS,
    }),
};

let appInstance: any = null;
let authInstance: any = null;
let dbInstance: any = null;
let functionsInstance: any = null;

export const getFirebaseApp = async (): Promise<any> => {

    if (!appInstance) {
        const { initializeApp, getApps, getApp } = await import('firebase/app');
        if (getApps().length === 0) {
            appInstance = initializeApp(firebaseConfig);
        } else {
            appInstance = getApp();
        }
    }
    return appInstance;
};

export const getFirebaseAuth = async (): Promise<any> => {

    if (!authInstance) {
        const app = await getFirebaseApp();
        const { getAuth, initializeAuth, browserLocalPersistence, browserPopupRedirectResolver } = await import('firebase/auth');

        if (Platform.OS === 'web') {
            try {
                authInstance = getAuth(app);
            } catch (e) {
                authInstance = initializeAuth(app, {
                    persistence: browserLocalPersistence,
                    popupRedirectResolver: browserPopupRedirectResolver
                });
            }
        } else {
            // React Native: MUST use initializeAuth with AsyncStorage for persistence.
            // getAuth() returns in-memory-only auth (no persistence), so we try initializeAuth FIRST.
            try {
                const firebaseAuthMod = await import('firebase/auth');
                const getReactNativePersistence = (firebaseAuthMod as any).getReactNativePersistence;
                const rnInitializeAuth = (firebaseAuthMod as any).initializeAuth;
                const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                authInstance = rnInitializeAuth(app, {
                    persistence: getReactNativePersistence(AsyncStorage)
                });
            } catch (e) {
                // initializeAuth throws if auth is already initialized — fall back to getAuth
                authInstance = getAuth(app);
            }
        }
    }
    return authInstance;
};

export const getFirestoreDb = async (): Promise<any> => {

    if (!dbInstance) {
        const app = await getFirebaseApp();
        const { getFirestore } = await import('firebase/firestore');
        dbInstance = getFirestore(app);
    }
    return dbInstance;
};

export const getFirebaseFunctions = async (): Promise<any> => {

    if (!functionsInstance) {
        const app = await getFirebaseApp();
        const { getFunctions } = await import('firebase/functions');
        functionsInstance = getFunctions(app, 'us-central1');
    }
    return functionsInstance;
};

export default firebaseConfig;
