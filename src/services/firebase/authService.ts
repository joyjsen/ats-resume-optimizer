import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithCredential,
    signOut,
    sendPasswordResetEmail,
    updatePassword,
    fetchSignInMethodsForEmail,
    sendEmailVerification,
    onAuthStateChanged,
    GoogleAuthProvider,
    OAuthProvider,
    User,
    ConfirmationResult,
    signInWithPhoneNumber,
    RecaptchaVerifier,
    signInWithPopup,
    getAuth,
    verifyBeforeUpdateEmail,
    updatePhoneNumber,
    PhoneAuthProvider,
    PhoneAuthCredential,
    linkWithCredential,
    AuthCredential
} from 'firebase/auth';
import { Platform } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as crypto from 'expo-crypto';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { auth } from './config';
import { userService } from './userService';
import { AuthProvider, UserProfile } from '../../types/profile.types';
import { ENV } from '../../config/env';

// Configure Google Sign-In
if (!ENV.GOOGLE_WEB_CLIENT_ID || !ENV.GOOGLE_IOS_CLIENT_ID) {
    console.warn('[AuthService] Google Sign-In: Missing GOOGLE_WEB_CLIENT_ID or GOOGLE_IOS_CLIENT_ID env vars. Google login will fail.');
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
    // Store phone confirmation result temporarily
    private confirmationResult: ConfirmationResult | null = null;

    private async checkAccountStatus(profile: UserProfile): Promise<void> {
        if (profile.accountStatus === 'suspended' || profile.accountStatus === 'inactive' || profile.accountStatus === 'deleted') {
            signOut(auth).catch(() => { }); // Fire and forget to avoid potential hangs in the call chain
            throw new UserInactiveError();
        }
    }

    subscribeToAuthChanges(callback: (user: UserProfile | null, error?: Error) => void) {
        return onAuthStateChanged(auth, async (user) => {
            try {
                if (user) {
                    const providerId = user.providerData[0]?.providerId;
                    let provider: AuthProvider = 'email';

                    if (providerId?.includes('google')) provider = 'google';
                    else if (providerId?.includes('apple')) provider = 'apple';
                    else if (providerId?.includes('facebook')) provider = 'facebook';
                    else if (providerId?.includes('microsoft')) provider = 'microsoft';
                    else if (providerId?.includes('phone')) provider = 'phone';

                    const profile = await userService.syncUserProfile(user, provider);

                    if (profile.accountStatus === 'suspended' || profile.accountStatus === 'inactive' || profile.accountStatus === 'deleted') {
                        await signOut(auth);
                        callback(null, new UserInactiveError());
                        return;
                    }

                    callback(profile);
                } else {
                    callback(null);
                }
            } catch (error) {
                console.error("Auth sync error:", error);
                callback(null, error as Error);
            }
        });
    }

    async loginWithEmail(email: string, pass: string): Promise<UserProfile> {
        const { user } = await signInWithEmailAndPassword(auth, email, pass);
        const profile = await userService.syncUserProfile(user, 'email');
        await this.checkAccountStatus(profile);
        return profile;
    }

    async registerWithEmail(
        email: string,
        pass: string,
        fullName?: string,
        phoneNumber?: string,
        phoneVerified?: boolean,
        phoneCredential?: AuthCredential
    ): Promise<UserProfile> {
        // First check if email already exists in the database safely via Cloud Function
        try {
            const functions = getFunctions();
            const checkUserProvider = httpsCallable(functions, 'checkUserProvider');
            const result = await checkUserProvider({ email });
            const emailCheck = result.data as any;

            if (emailCheck?.exists) {
                const status = emailCheck.status;
                const name = emailCheck.displayName || 'User';

                if (status === 'deleted') {
                    throw new Error(`This email is associated with a deleted account (${name}). Please contact support for account restoration.`);
                } else if (status === 'inactive' || status === 'suspended') {
                    throw new Error(`This email is associated with an inactive account (${name}). Please contact support to reactivate your account.`);
                } else {
                    // Active account - shouldn't sign up, should sign in instead
                    throw new Error(`An account with this email already exists. Please sign in instead.`);
                }
            }
        } catch (error: any) {
            // If it's our explicit error, rethrow it
            if (error.message && (error.message.includes('exists') || error.message.includes('account'))) {
                throw error;
            }
            // Otherwise log and proceed (e.g. if function not deployed, let Firebase Auth handle duplication check)
            console.error("AuthService.registerWithEmail: Pre-check failed, proceeding to registration:", error);
        }

        const { user } = await createUserWithEmailAndPassword(auth, email, pass);

        // Link phone if credential provided
        if (phoneCredential) {
            try {
                await linkWithCredential(user, phoneCredential);
            } catch (linkError: any) {
                console.error("AuthService.registerWithEmail: Failed to link phone credential:", linkError);
                // Throw a clear error so we can see it in the UI
                throw new Error(`Account created, but failed to link phone number: ${linkError.message}`);
            }
        }

        let firstName = '';
        let lastName = '';
        let displayName = user.displayName || fullName || 'User';

        if (fullName) {
            const parts = fullName.split(' ');
            firstName = parts[0];
            lastName = parts.slice(1).join(' ');
        }

        const additionalData: Partial<UserProfile> = {
            displayName,
            firstName,
            lastName,
        };

        if (phoneNumber) {
            // Primary safeguard: check if phone already exists in the system
            const phoneCheck = await userService.checkPhoneExists(phoneNumber);
            if (phoneCheck?.exists) {
                throw new Error(`An account with this phone number (${phoneNumber}) already exists. Please sign in or use a different number.`);
            }

            additionalData.phoneNumber = phoneNumber;
            if (phoneVerified) additionalData.phoneVerified = true;
        }

        return await userService.syncUserProfile(user, 'email', additionalData);
    }


    async signInWithGoogle(): Promise<UserProfile> {
        try {
            if (Platform.OS === 'web') {
                const authInstance = getAuth();
                const provider = new GoogleAuthProvider();
                const { user } = await signInWithPopup(authInstance, provider);
                const profile = await userService.syncUserProfile(user, 'google');
                await this.checkAccountStatus(profile);
                return profile;
            } else {
                await GoogleSignin.hasPlayServices();
                const response = await GoogleSignin.signIn();
                const idToken = response.data?.idToken || (response as any).idToken;

                if (!idToken) {
                    throw new Error('No ID token received from Google Sign-In');
                }

                const googleCredential = GoogleAuthProvider.credential(idToken);
                const { user } = await signInWithCredential(auth, googleCredential);
                const profile = await userService.syncUserProfile(user, 'google');
                await this.checkAccountStatus(profile);
                return profile;
            }
        } catch (error) {
            console.error('Google Sign-In Error:', error);
            throw error;
        }
    }

    async signInWithApple(): Promise<UserProfile> {
        try {
            if (Platform.OS === 'web') {
                const authInstance = getAuth();
                const provider = new OAuthProvider('apple.com');
                const { user } = await signInWithPopup(authInstance, provider);
                const profile = await userService.syncUserProfile(user, 'apple');
                await this.checkAccountStatus(profile);
                return profile;
            } else if (Platform.OS === 'android') {
                const clientId = 'com.jsn22.atsresumeoptimizer.auth';
                // For Android Apple login, we use a dedicated relay page in Firebase Hosting
                // Return URL to add to Apple Developer Portal: https://ats-resume-optimizer-8652d.web.app/apple-auth
                const redirectUri = 'https://ats-resume-optimizer-8652d.web.app/apple-auth';

                const rawNonce = Math.random().toString(36).substring(2, 15);
                const hashedNonce = await crypto.digestStringAsync(
                    crypto.CryptoDigestAlgorithm.SHA256,
                    rawNonce
                );
                const authUrl = `https://appleid.apple.com/auth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code%20id_token&scope=name%20email&response_mode=form_post&nonce=${hashedNonce}`;

                // This will open the browser and wait for a redirect back to the app's scheme
                const result = await WebBrowser.openAuthSessionAsync(authUrl, 'riresume://');

                console.log('[Apple Auth] WebBrowser result type:', result.type);
                console.log('[Apple Auth] WebBrowser result:', JSON.stringify(result));

                if (result.type === 'success' && result.url) {
                    console.log('[Apple Auth] Received URL:', result.url);
                    // Parse the URL - token could be in query params or fragment
                    const resultUrl = result.url;
                    let idToken: string | null = null;

                    // Try query params first (from Cloud Function redirect)
                    try {
                        const url = new URL(resultUrl);
                        idToken = url.searchParams.get('id_token');
                    } catch (e) {
                        // URL might have a fragment instead
                    }

                    // Try fragment if no query param found
                    if (!idToken && resultUrl.includes('#')) {
                        const fragmentUrl = new URL(resultUrl.replace('#', '?'));
                        idToken = fragmentUrl.searchParams.get('id_token');
                    }

                    if (idToken) {
                        const provider = new OAuthProvider('apple.com');
                        const credential = provider.credential({
                            idToken: idToken,
                            rawNonce: rawNonce,
                        });

                        const { user } = await signInWithCredential(auth, credential);
                        const profile = await userService.syncUserProfile(user, 'apple');
                        await this.checkAccountStatus(profile);
                        return profile;
                    }
                    throw new Error('No identity token received from Apple Sign-In relay. URL: ' + resultUrl);
                } else if (result.type === 'cancel' || result.type === 'dismiss') {
                    throw new Error('Apple Sign-In was cancelled.');
                } else {
                    throw new Error(`Apple Sign-In failed to return to the app. Result type: ${result.type}. Please ensure you completed login and the relay is deployed.`);
                }
            } else {
                const csrf = Math.random().toString(36).substring(2, 15);
                const nonce = await crypto.digestStringAsync(
                    crypto.CryptoDigestAlgorithm.SHA256,
                    csrf
                );

                const appleCredential = await AppleAuthentication.signInAsync({
                    requestedScopes: [
                        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                        AppleAuthentication.AppleAuthenticationScope.EMAIL,
                    ],
                    nonce,
                });

                const { identityToken } = appleCredential;

                if (!identityToken) {
                    throw new Error('No identity token received from Apple Sign-In');
                }

                const provider = new OAuthProvider('apple.com');
                const credential = provider.credential({
                    idToken: identityToken,
                    rawNonce: csrf,
                });

                const { user } = await signInWithCredential(auth, credential);
                const profile = await userService.syncUserProfile(user, 'apple');
                await this.checkAccountStatus(profile);
                return profile;
            }
        } catch (error) {
            console.error('Apple Sign-In Error:', error);
            throw error;
        }
    }

    async signInWithMicrosoft(): Promise<UserProfile> {
        try {
            if (Platform.OS === 'web') {
                const authInstance = getAuth();
                const provider = new OAuthProvider('microsoft.com');
                const { user } = await signInWithPopup(authInstance, provider);
                const profile = await userService.syncUserProfile(user, 'microsoft');
                await this.checkAccountStatus(profile);
                return profile;
            } else {
                const clientId = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID;
                if (!clientId) {
                    throw new Error('Microsoft Sign-In is not configured. Missing EXPO_PUBLIC_MICROSOFT_CLIENT_ID env var.');
                }
                const redirectUri = AuthSession.makeRedirectUri({
                    scheme: 'msauth.com.jsn22.atsresumeoptimizer',
                    path: 'auth',
                });

                const discovery = {
                    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
                    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
                };

                const nonce = Math.random().toString(36).substring(7);
                const request = new AuthSession.AuthRequest({
                    clientId,
                    redirectUri,
                    scopes: ['openid', 'profile', 'email'],
                    responseType: AuthSession.ResponseType.IdToken,
                    usePKCE: false,
                    extraParams: {
                        nonce: nonce,
                    }
                });

                const result = await request.promptAsync(discovery);

                if (result.type === 'success' && result.params.id_token) {
                    const provider = new OAuthProvider('microsoft.com');
                    const credential = provider.credential({
                        idToken: result.params.id_token,
                        rawNonce: nonce,
                    });

                    const { user } = await signInWithCredential(auth, credential);
                    const profile = await userService.syncUserProfile(user, 'microsoft');
                    await this.checkAccountStatus(profile);
                    return profile;
                } else {
                    throw new Error('Microsoft Sign-In was cancelled or failed.');
                }
            }
        } catch (error: any) {
            console.error('Microsoft Sign-In Error:', error);
            throw error;
        }
    }

    async signInWithPhoneNumber(phoneNumber: string, recaptchaVerifier?: any): Promise<void> {
        try {
            const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
            this.confirmationResult = confirmation;
        } catch (error: any) {
            console.error('[AuthService] Phone Sign-In Error:', error);
            throw error;
        }
    }

    /**
     * Request a phone verification code without signing in immediately.
     * Returns the confirmation result for later verification.
     */
    async requestPhoneVerification(phoneNumber: string, recaptchaVerifier?: any): Promise<ConfirmationResult> {
        try {
            return await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
        } catch (error: any) {
            console.error('[AuthService] Request Phone Verification Error:', error);
            throw error;
        }
    }

    async confirmPhoneCode(code: string): Promise<UserProfile> {
        if (!this.confirmationResult) throw new Error("No verification code sent.");
        try {
            const { user } = await this.confirmationResult.confirm(code);
            const profile = await userService.syncUserProfile(user, 'phone');
            return profile;
        } catch (error) {
            console.error('Confirm Phone Code Error:', error);
            throw error;
        }
    }

    async logout() {
        try {
            await signOut(auth);
            try {
                await GoogleSignin.signOut();
            } catch (e) { }
        } catch (error) {
            console.error('Logout Error:', error);
            throw error;
        }
    }

    async deleteUser() {
        try {
            const user = auth.currentUser;
            if (user) {
                await user.delete();
            }
        } catch (error) {
            console.error('Delete User Error:', error);
            throw error;
        }
    }

    async resetPassword(email: string) {
        await sendPasswordResetEmail(auth, email);
    }

    async updateUserPassword(newPass: string) {
        const user = auth.currentUser;
        if (user) {
            await updatePassword(user, newPass);
        } else {
            throw new Error("No user logged in");
        }
    }

    async fetchSignInMethods(email: string): Promise<string[]> {
        try {
            return await fetchSignInMethodsForEmail(auth, email);
        } catch (error) {
            console.error("Fetch Sign In Methods Error:", error);
            return [];
        }
    }

    async sendVerificationEmail(user?: User) {
        try {
            const currentUser = user || auth.currentUser;
            if (currentUser) {
                await sendEmailVerification(currentUser);
            } else {
                throw new Error("No user to send verification email to");
            }
        } catch (error) {
            console.error("Send Verification Email Error:", error);
            throw error;
        }
    }

    async reloadUser() {
        try {
            const user = auth.currentUser;
            if (user) {
                await user.reload();
                return auth.currentUser;
            }
        } catch (error) {
            console.error("Reload User Error:", error);
            throw error;
        }
    }

    async verifyNewEmail(newEmail: string) {
        const user = auth.currentUser;
        if (!user) throw new Error("No user logged in");
        try {
            await verifyBeforeUpdateEmail(user, newEmail);
        } catch (error: any) {
            console.error("verifyBeforeUpdateEmail Error:", error);
            throw error;
        }
    }

    async updateNewPhoneNumber(credential: PhoneAuthCredential) {
        const user = auth.currentUser;
        if (!user) throw new Error("No user logged in");
        try {
            await updatePhoneNumber(user, credential);
        } catch (error: any) {
            console.error("updatePhoneNumber Error:", error);
            throw error;
        }
    }

    async refreshProfile(): Promise<UserProfile | null> {
        if (!auth.currentUser) return null;
        try {
            return await userService.syncUserProfile(auth.currentUser, 'email');
        } catch (error) {
            console.error("Error refreshing profile:", error);
            return null;
        }
    }

    async updateVerificationStatus(uid: string, data: { emailVerified?: boolean; phoneVerified?: boolean }): Promise<void> {
        try {
            await userService.updateProfile(uid, data);
        } catch (error) {
            console.error("Error updating verification status:", error);
            throw error;
        }
    }

    get currentUser() {
        return auth.currentUser;
    }
}

export const authService = new AuthService();
