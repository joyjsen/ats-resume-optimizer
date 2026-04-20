import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as crypto from 'expo-crypto';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { getFirebaseAuth, getFirebaseFunctions } from './config';
import { userService } from './userService';
import { AuthProvider, UserProfile } from '../../types/profile.types';
import { ENV } from '../../config/env';

// Configure Google Sign-In
if (!ENV.GOOGLE_WEB_CLIENT_ID || !ENV.GOOGLE_IOS_CLIENT_ID) {
    console.warn('[AuthService] Google Sign-In: Missing client IDs.');
}
GoogleSignin.configure({
    webClientId: ENV.GOOGLE_WEB_CLIENT_ID,
    iosClientId: ENV.GOOGLE_IOS_CLIENT_ID,
    offlineAccess: true,
});

export class UserInactiveError extends Error {
    constructor() {
        super('User Inactive: Please contact admin.');
        this.name = 'UserInactiveError';
    }
}

export class AuthService {
    private confirmationResult: any = null;

    private async checkAccountStatus(profile: UserProfile): Promise<void> {
        if (['suspended', 'inactive', 'deleted'].includes(profile.accountStatus)) {
            const { signOut } = await import('firebase/auth');
            const auth = await getFirebaseAuth();
            signOut(auth).catch(() => { });
            throw new UserInactiveError();
        }
    }

    async subscribeToAuthChanges(callback: (user: UserProfile | null, error?: Error) => void) {
        const { onAuthStateChanged, signOut } = await import('firebase/auth');
        const auth = await getFirebaseAuth();
        return onAuthStateChanged(auth, async (user) => {
            try {
                if (user) {
                    const providerId = user.providerData[0]?.providerId;
                    let provider: AuthProvider = 'email';
                    if (providerId?.includes('google')) provider = 'google';
                    else if (providerId?.includes('apple')) provider = 'apple';
                    else if (providerId?.includes('phone')) provider = 'phone';

                    const profile = await userService.syncUserProfile(user, provider);
                    if (['suspended', 'inactive', 'deleted'].includes(profile.accountStatus)) {
                        await signOut(auth);
                        callback(null, new UserInactiveError());
                        return;
                    }
                    callback(profile);
                } else {
                    callback(null);
                }
            } catch (error) {
                callback(null, error as Error);
            }
        });
    }

    async loginWithEmail(email: string, pass: string): Promise<UserProfile> {
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        const auth = await getFirebaseAuth();
        const { user } = await signInWithEmailAndPassword(auth, email, pass);
        const profile = await userService.syncUserProfile(user, 'email');
        await this.checkAccountStatus(profile);
        return profile;
    }

    async registerWithEmail(email: string, pass: string, firstName?: string, lastName?: string, phoneNumber?: string, phoneVerified?: boolean, phoneCredential?: any): Promise<UserProfile> {
        try {
            const { httpsCallable } = await import('firebase/functions');
            const functions = await getFirebaseFunctions();
            const res = await httpsCallable(functions, 'checkUserProvider')({ email });
            const data = res.data as any;
            if (data?.exists) throw new Error(`Account already exists: ${data.status}`);
        } catch (e: any) {
            if (e.message?.includes('Account')) throw e;
        }

        const { createUserWithEmailAndPassword, linkWithCredential } = await import('firebase/auth');
        const auth = await getFirebaseAuth();
        const { user } = await createUserWithEmailAndPassword(auth, email, pass);

        if (phoneCredential) await linkWithCredential(user, phoneCredential);

        const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'User';

        const additionalData: Partial<UserProfile> = {
            displayName,
            firstName: firstName || '',
            lastName: lastName || ''
        };
        
        if (phoneNumber) {
            additionalData.phoneNumber = phoneNumber;
            if (phoneVerified) additionalData.phoneVerified = true;
        }

        return await userService.syncUserProfile(user, 'email', additionalData);
    }

    async signInWithGoogle(): Promise<UserProfile> {
        const { GoogleAuthProvider, signInWithPopup, signInWithCredential } = await import('firebase/auth');
        const auth = await getFirebaseAuth();
        if (Platform.OS === 'web') {
            const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
            const profile = await userService.syncUserProfile(user, 'google');
            await this.checkAccountStatus(profile);
            return profile;
        } else {
            await GoogleSignin.hasPlayServices();
            const { data } = await GoogleSignin.signIn();
            if (!data) {
                const cancelErr = new Error('Login cancelled: the user cancelled the authorization attempt.');
                (cancelErr as any).code = 'auth/cancelled';
                throw cancelErr;
            }
            const idToken = data?.idToken || (data as any).idToken;
            if (!idToken) throw new Error('No ID token');
            const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
            const profile = await userService.syncUserProfile(user, 'google');
            await this.checkAccountStatus(profile);
            return profile;
        }
    }

    async signInWithApple(): Promise<UserProfile> {
        const { OAuthProvider, signInWithPopup, signInWithCredential } = await import('firebase/auth');
        const auth = await getFirebaseAuth();
        if (Platform.OS === 'web') {
            const { user } = await signInWithPopup(auth, new OAuthProvider('apple.com'));
            const profile = await userService.syncUserProfile(user, 'apple');
            await this.checkAccountStatus(profile);
            return profile;
        } else if (Platform.OS === 'android') {
            const redirectUri = 'https://ats-resume-optimizer-8652d.web.app/apple-auth';
            const rawNonce = Math.random().toString(36).substring(2, 15);
            const hashedNonce = await crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
            const authUrl = `https://appleid.apple.com/auth/authorize?client_id=com.jsn22.atsresumeoptimizer.auth&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code%20id_token&scope=name%20email&response_mode=form_post&nonce=${hashedNonce}`;
            const result = await WebBrowser.openAuthSessionAsync(authUrl, 'riresume://');

            if (result.type === 'success' && result.url) {
                const url = new URL(result.url.replace('#', '?'));
                const idToken = url.searchParams.get('id_token');
                if (idToken) {
                    const credential = new OAuthProvider('apple.com').credential({ idToken, rawNonce });
                    const { user } = await signInWithCredential(auth, credential);
                    
                    const appleData: Partial<UserProfile> = {};
                    const appleUserString = url.searchParams.get('user');
                    if (appleUserString) {
                        try {
                            const parsed = JSON.parse(appleUserString);
                            if (parsed.name?.firstName) appleData.firstName = parsed.name.firstName;
                            if (parsed.name?.lastName) appleData.lastName = parsed.name.lastName;
                            if (parsed.name?.firstName || parsed.name?.lastName) {
                                appleData.displayName = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(' ');
                            }
                        } catch (e) {
                            console.warn('[AuthService] Failed to parse Android Apple user payload:', e);
                        }
                    }

                    const profile = await userService.syncUserProfile(user, 'apple', appleData);
                    await this.checkAccountStatus(profile);
                    return profile;
                }
            }
            throw new Error('Apple login failed');
        } else {
            const csrf = Math.random().toString(36).substring(2, 15);
            const nonce = await crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256, csrf);
            const appleCred = await AppleAuthentication.signInAsync({
                requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
                nonce
            });
            if (!appleCred.identityToken) throw new Error('No identity token');
            const credential = new OAuthProvider('apple.com').credential({ idToken: appleCred.identityToken, rawNonce: csrf });
            const { user } = await signInWithCredential(auth, credential);

            // Capture name & email Apple provides (only sent on first sign-in)
            console.log('[AuthService] Apple credential received:', {
                givenName: appleCred.fullName?.givenName,
                familyName: appleCred.fullName?.familyName,
                email: appleCred.email,
                hasIdentityToken: !!appleCred.identityToken,
            });
            const appleData: Partial<UserProfile> = {};
            const givenName = appleCred.fullName?.givenName;
            const familyName = appleCred.fullName?.familyName;
            if (givenName) appleData.firstName = givenName;
            if (familyName) appleData.lastName = familyName;
            if (givenName || familyName) {
                appleData.displayName = [givenName, familyName].filter(Boolean).join(' ');
            }
            if (appleCred.email) appleData.email = appleCred.email;

            const profile = await userService.syncUserProfile(user, 'apple', appleData);
            await this.checkAccountStatus(profile);
            return profile;
        }
    }

    async signInWithMicrosoft(): Promise<UserProfile> {
        const { OAuthProvider, signInWithPopup } = await import('firebase/auth');
        const auth = await getFirebaseAuth();
        if (Platform.OS === 'web') {
            const { user } = await signInWithPopup(auth, new OAuthProvider('microsoft.com'));
            const profile = await userService.syncUserProfile(user, 'microsoft');
            await this.checkAccountStatus(profile);
            return profile;
        } else {
            // Microsoft on native usually requires a proxy or webview, for now throw not supported
            throw new Error('Microsoft login only supported on web currently');
        }
    }

    async signInWithPhoneNumber(phoneNumber: string, recaptchaVerifier?: any): Promise<void> {
        const { signInWithPhoneNumber } = await import('firebase/auth');
        const auth = await getFirebaseAuth();
        this.confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    }

    async requestPhoneVerification(phoneNumber: string, recaptchaVerifier?: any): Promise<any> {
        const { signInWithPhoneNumber, linkWithPhoneNumber } = await import('firebase/auth');
        const auth = await getFirebaseAuth();
        
        // If user is already signed in (e.g. via Apple/Google in onboarding),
        // we must LINK the phone credential to avoid creating a new bare user session.
        if (auth.currentUser) {
            const hasPhoneProvider = auth.currentUser.providerData.some((p: any) => p.providerId === 'phone');
            if (!hasPhoneProvider) {
                try {
                    return await linkWithPhoneNumber(auth.currentUser, phoneNumber, recaptchaVerifier);
                } catch (error: any) {
                    // Try to fall back to signInWithPhoneNumber if linking fails due to internal states
                    if (error.code !== 'auth/provider-already-linked') {
                        console.warn('[AuthService] linkWithPhoneNumber failed or threw:', error);
                        throw error;
                    }
                }
            }
        }
        
        // Fallback for pure phone sign-in flow OR when updating an already-linked phone number
        return await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    }

    async confirmPhoneCode(code: string): Promise<UserProfile> {
        if (!this.confirmationResult) throw new Error("No verification code.");
        const { user } = await this.confirmationResult.confirm(code);
        return await userService.syncUserProfile(user, 'phone');
    }

    async logout() {
        const { signOut } = await import('firebase/auth');
        const auth = await getFirebaseAuth();
        await signOut(auth);
        try { await GoogleSignin.signOut(); } catch (e) { }
        try {
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            await AsyncStorage.removeItem('hasSeenAnalyzeTutorial');
        } catch (e) { }
    }

    async deleteUser() {
        const auth = await getFirebaseAuth();
        if (auth.currentUser) await auth.currentUser.delete();
    }

    async resetPassword(email: string) {
        const { sendPasswordResetEmail } = await import('firebase/auth');
        const auth = await getFirebaseAuth();
        await sendPasswordResetEmail(auth, email);
    }

    async updateUserPassword(newPass: string) {
        const { updatePassword } = await import('firebase/auth');
        const auth = await getFirebaseAuth();
        if (auth.currentUser) await updatePassword(auth.currentUser, newPass);
    }

    async sendVerificationEmail() {
        const { sendEmailVerification } = await import('firebase/auth');
        const auth = await getFirebaseAuth();
        if (auth.currentUser) await sendEmailVerification(auth.currentUser);
    }

    async reloadUser() {
        const auth = await getFirebaseAuth();
        if (auth.currentUser) {
            await auth.currentUser.reload();
            return auth.currentUser;
        }
    }

    async verifyNewEmail(newEmail: string) {
        const { verifyBeforeUpdateEmail } = await import('firebase/auth');
        const auth = await getFirebaseAuth();
        if (auth.currentUser) await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
    }

    async updateNewPhoneNumber(credential: any) {
        const { updatePhoneNumber } = await import('firebase/auth');
        const auth = await getFirebaseAuth();
        if (auth.currentUser) await updatePhoneNumber(auth.currentUser, credential);
    }

    async refreshProfile(): Promise<UserProfile | null> {
        const auth = await getFirebaseAuth();
        if (!auth.currentUser) return null;
        return await userService.syncUserProfile(auth.currentUser, 'email');
    }

    async fetchSignInMethods(email: string): Promise<string[]> {
        const { fetchSignInMethodsForEmail } = await import('firebase/auth');
        const auth = await getFirebaseAuth();
        return await fetchSignInMethodsForEmail(auth, email);
    }

    async getCurrentUser() {
        const auth = await getFirebaseAuth();
        return auth.currentUser;
    }
    async updateVerificationStatus(uid: string, status: { emailVerified?: boolean; phoneVerified?: boolean }) {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { getFirestoreDb } = await import('./config');
        const db = await getFirestoreDb();
        await updateDoc(doc(db, 'users', uid), status);
    }
}

export const authService = new AuthService();
