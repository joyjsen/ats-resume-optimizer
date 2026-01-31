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
    RecaptchaVerifier
} from 'firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as crypto from 'expo-crypto';
import * as AuthSession from 'expo-auth-session';
import { auth } from './config';
import { userService } from './userService';
import { AuthProvider, UserProfile } from '../../types/profile.types';

// Configure Google Sign-In
GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '776583109504-luid6drq2aglvse8h3njbt8udbfh2a11.apps.googleusercontent.com',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '776583109504-j4tdkj2e7oiore61l1q8m61b8v5po7nl.apps.googleusercontent.com',
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

    private checkAccountStatus(profile: UserProfile): void {
        if (profile.accountStatus === 'suspended' || profile.accountStatus === 'inactive') {
            signOut(auth).catch(() => { });
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

                    if (profile.accountStatus === 'suspended' || profile.accountStatus === 'inactive') {
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
        this.checkAccountStatus(profile);
        return profile;
    }

    async registerWithEmail(email: string, pass: string, fullName?: string, phoneNumber?: string): Promise<UserProfile> {
        const { user } = await createUserWithEmailAndPassword(auth, email, pass);
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
            additionalData.phoneNumber = phoneNumber;
        }

        return await userService.syncUserProfile(user, 'email', additionalData);
    }

    async signInWithGoogle(): Promise<UserProfile> {
        try {
            await GoogleSignin.hasPlayServices();
            const response = await GoogleSignin.signIn();
            const idToken = response.data?.idToken || (response as any).idToken;

            if (!idToken) {
                throw new Error('No ID token received from Google Sign-In');
            }

            const googleCredential = GoogleAuthProvider.credential(idToken);
            const { user } = await signInWithCredential(auth, googleCredential);
            const profile = await userService.syncUserProfile(user, 'google');
            this.checkAccountStatus(profile);
            return profile;
        } catch (error) {
            console.error('Google Sign-In Error:', error);
            throw error;
        }
    }

    async signInWithApple(): Promise<UserProfile> {
        try {
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
            this.checkAccountStatus(profile);
            return profile;
        } catch (error) {
            console.error('Apple Sign-In Error:', error);
            throw error;
        }
    }

    async signInWithMicrosoft(): Promise<UserProfile> {
        try {
            const clientId = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || '8bcf3186-2eea-47e5-a927-eef743e5e3a0';
            const redirectUri = AuthSession.makeRedirectUri({
                scheme: 'msauth.com.jsn22.atsresumeoptimizer',
                path: 'auth',
            });

            // DEBUG: Log the redirect URI - copy this exact value to Azure AD
            console.log('=== MICROSOFT AUTH REDIRECT URI ===');
            console.log(redirectUri);
            console.log('===================================');

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
                usePKCE: false, // Disable PKCE for implicit flow (id_token)
                extraParams: {
                    nonce: nonce,
                }
            });

            const result = await request.promptAsync(discovery);

            // DEBUG: Log the full result
            console.log('=== MICROSOFT AUTH RESULT ===');
            console.log('Type:', result.type);
            if (result.type === 'success') {
                console.log('Params:', JSON.stringify(result.params, null, 2));
            }
            console.log('Error:', (result as any).error);
            console.log('ErrorCode:', (result as any).errorCode);
            console.log('Full result:', JSON.stringify(result, null, 2));
            console.log('=============================');

            if (result.type === 'success' && result.params.id_token) {
                const provider = new OAuthProvider('microsoft.com');
                const credential = provider.credential({
                    idToken: result.params.id_token,
                    rawNonce: nonce, // Must match the nonce sent in the request
                });

                const { user } = await signInWithCredential(auth, credential);
                const profile = await userService.syncUserProfile(user, 'microsoft');
                this.checkAccountStatus(profile);
                return profile;
            } else {
                throw new Error('Microsoft Sign-In was cancelled or failed.');
            }
        } catch (error: any) {
            console.error('Microsoft Sign-In Error:', error);
            if (error.code === 'auth/invalid-credential-or-provider-id' || (error.message && error.message.includes('auth/invalid-credential-or-provider-id'))) {
                throw new Error(`Configuration Error: The Client ID in Firebase Console (Authentication > Sign-in method > Microsoft) does not match the app's Client ID.`);
            }
            throw error;
        }
    }

    // Phone Auth - Note: This requires a RecaptchaVerifier on web
    // On mobile, this is handled differently and may need additional setup
    async signInWithPhoneNumber(phoneNumber: string, recaptchaVerifier?: RecaptchaVerifier): Promise<void> {
        try {
            if (!recaptchaVerifier) {
                throw new Error('Phone authentication requires a RecaptchaVerifier on this platform');
            }
            const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
            this.confirmationResult = confirmation;
        } catch (error) {
            console.error('Phone Sign-In Error:', error);
            throw error;
        }
    }

    async confirmPhoneCode(code: string): Promise<UserProfile> {
        if (!this.confirmationResult) throw new Error("No verification code sent.");

        try {
            const { user } = await this.confirmationResult.confirm(code);
            const profile = await userService.syncUserProfile(user, 'phone');
            this.checkAccountStatus(profile);
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

    // Accessor for current user
    get currentUser() {
        return auth.currentUser;
    }
}

export const authService = new AuthService();
