import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { Text, TextInput, Button, useTheme, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { authService, UserInactiveError } from '../../src/services/firebase/authService';
import { userService } from '../../src/services/firebase/userService';
import { getFirebaseAuth, getFirebaseApp } from '../../src/services/firebase/config';
import { useProfileStore } from '../../src/store/profileStore';
import RecaptchaVerifierModal from '../../src/components/auth/RecaptchaVerifierModal';
import { CountryCodeSelector } from '../../src/components/auth/CountryCodeSelector';
import { COUNTRY_CALLING_CODES, CountryCallingCode } from '../../src/constants/countries';
import type { ConfirmationResult, AuthCredential } from 'firebase/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Keyboard } from 'react-native';
import { ThemeToggle } from '../../src/components/common/ThemeToggle';
import { useAppTheme } from '../../src/context/ThemeContext';

export default function SignUp() {
    const router = useRouter();
    const theme = useTheme();
    const { isDark } = useAppTheme();
    const { setUserProfile } = useProfileStore();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [socialLoading, setSocialLoading] = useState<string | null>(null);
    const [phoneCredential, setPhoneCredential] = useState<AuthCredential | null>(null);

    // Dual Verification Step State
    const [step, setStep] = useState<'details' | 'phone_verify' | 'email_verify'>('details');
    const [selectedCountry, setSelectedCountry] = useState<CountryCallingCode>(
        COUNTRY_CALLING_CODES.find(c => c.iso === 'US') || COUNTRY_CALLING_CODES[0]
    );
    const [verificationCode, setVerificationCode] = useState('');
    const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
    const [isPhoneVerified, setIsPhoneVerified] = useState(false);
    const recaptchaVerifier = useRef(null);

    // Anti-hang: Reset loading states whenever auth state changes to "signed out"
    useEffect(() => {
        let unsubscribe: any = null;
        const initAuth = async () => {
            const auth = await getFirebaseAuth();
            unsubscribe = auth.onAuthStateChanged((user: any) => {
                if (!user) {
                    setLoading(false);
                    setSocialLoading(null);
                }
            });
        };
        initAuth();
        return () => unsubscribe && unsubscribe();
    }, []);

    const handleSocialLogin = async (provider: 'google' | 'apple' | 'microsoft') => {
        setSocialLoading(provider);
        try {
            let profile;
            if (provider === 'google') profile = await authService.signInWithGoogle();
            else if (provider === 'apple') profile = await authService.signInWithApple();
            else if (provider === 'microsoft') profile = await authService.signInWithMicrosoft();
            
            if (profile) {
                setUserProfile(profile);
                router.replace('/(auth)/onboarding' as any);
            }
        } catch (error: any) {
            const isInactive = error instanceof UserInactiveError ||
                error.name === 'UserInactiveError' ||
                error.message?.includes('User Inactive');

            // Detect user-initiated cancellations (don't show errors for these)
            const isCancelled = 
                error.code === -1 ||
                error.code === 'auth/cancelled' ||
                error.code === 'ERR_CANCELED' ||
                error.message?.includes('cancelled') ||
                error.message?.includes('canceled') ||
                error.message?.includes('Apple login failed');

            if (isInactive) {
                Alert.alert("Account Inactive", "User Inactive: Please contact admin.");
            } else if (isCancelled) {
                // Silently ignore — user just dismissed the login dialog
                console.log(`[Auth] ${provider} login cancelled by user`);
            } else {
                console.error(`${provider} Login Error:`, error);
                Alert.alert("Sign Up Failed", error.message || `Could not sign up with ${provider}.`);
            }
        } finally {
            setSocialLoading(null);
        }
    };

    const handleSendOTP = async () => {
        if (!phoneNumber || phoneNumber.length < 7) {
            Alert.alert("Error", "Please enter a valid phone number.");
            return;
        }

        setLoading(true);
        try {
            const cleanNumber = phoneNumber.replace(/\D/g, '');
            const fullNumber = `${selectedCountry.code}${cleanNumber}`;

            // 1. Check Phone Duplicate
            const phoneExists = await userService.checkPhoneExists(fullNumber);
            if (phoneExists?.exists) {
                Alert.alert("Error", "This phone number is already registered to another account.");
                setLoading(false);
                return;
            }

            // 2. Check Email Duplicate
            const emailExists = await userService.checkEmailExists(email);
            if (emailExists?.exists) {
                Alert.alert("Error", "This email address is already registered. Please sign in instead.");
                setLoading(false);
                return;
            }

            const verifier = recaptchaVerifier.current as any;
            const confirmationResult = await authService.requestPhoneVerification(fullNumber, verifier);
            setConfirmation(confirmationResult);
            setStep('phone_verify');
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to send verification code.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!verificationCode || !confirmation) return;
        setLoading(true);
        try {
            const { PhoneAuthProvider } = await import('firebase/auth');
            const credential = PhoneAuthProvider.credential(confirmation.verificationId, verificationCode);
            setPhoneCredential(credential);

            setIsPhoneVerified(true);
            setStep('details');
            Alert.alert("Success", "Phone number verified!");
        } catch (error: any) {
            Alert.alert("Error", "Invalid verification code.");
        } finally {
            setLoading(false);
        }
    };

    const handleSignUpStep = async () => {
        if (!firstName || !lastName || !email || !password || !confirmPassword || !phoneNumber) {
            Alert.alert("Error", "Please fill in all fields.");
            return;
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            Alert.alert("Error", "Please enter a valid email address.");
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert("Error", "Passwords do not match.");
            return;
        }

        const passwordValidation = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[^A-Za-z0-9]/.test(password),
        };
        const isPasswordValid = Object.values(passwordValidation).every(Boolean);

        if (!isPasswordValid) {
            Alert.alert("Error", "Please ensure your password meets all security requirements.");
            return;
        }

        if (!isPhoneVerified) {
            handleSendOTP();
            return;
        }

        setLoading(true);
        try {
            const cleanNumber = phoneNumber.replace(/\D/g, '');
            const fullNumber = `${selectedCountry.code}${cleanNumber}`;

            // Create account with phone linkage
            const profile = await authService.registerWithEmail(
                email.trim(),
                password,
                firstName.trim(),
                lastName.trim(),
                fullNumber,
                isPhoneVerified,
                phoneCredential || undefined
            );
            if (profile) setUserProfile(profile);

            const auth = await getFirebaseAuth();
            if (auth.currentUser) {
                await authService.sendVerificationEmail();
                setStep('email_verify');
            }
        } catch (error: any) {
            console.error("Sign Up Error:", error);
            Alert.alert("Sign Up Failed", error.message || "Could not create account.");
        } finally {
            setLoading(false);
        }
    };

    const handleCheckEmailVerified = async () => {
        setLoading(true);
        try {
            const auth = await getFirebaseAuth();
            await auth.currentUser?.reload();
            if (auth.currentUser?.emailVerified) {
                await authService.updateVerificationStatus(auth.currentUser.uid, { emailVerified: true });
                const profile = await authService.refreshProfile();
                if (profile) setUserProfile(profile);
                router.replace('/(auth)/onboarding' as any);
            } else {
                Alert.alert("Not Verified", "Please verify your email address by clicking the link in your inbox.");
            }
        } catch (error: any) {
            Alert.alert("Error", "Failed to check email status.");
        } finally {
            setLoading(false);
        }
    };

    // State for Recaptcha config visibility
    const [firebaseOptions, setFirebaseOptions] = useState<any>(null);

    useEffect(() => {
        const loadConfig = async () => {
            const auth = await getFirebaseAuth();
            setFirebaseOptions(auth.app.options);
        }
        loadConfig();
    }, []);

    return (
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Theme toggle in top-right */}
            <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
                <ThemeToggle />
            </View>

            {firebaseOptions && (
                <RecaptchaVerifierModal
                    ref={recaptchaVerifier}
                    getApp={getFirebaseApp}
                />
            )}

            <View style={styles.header}>
                <Text variant="displaySmall" style={styles.title}>
                    {step === 'details' ? 'Create Account' : step === 'phone_verify' ? 'Verify Phone' : 'Verify Email'}
                </Text>
                <Text variant="bodyLarge" style={styles.subtitle}>
                    {step === 'details' ? 'Join us and optimize your career' : step === 'phone_verify' ? 'Enter the OTP sent to your phone' : 'Click the link in your email'}
                </Text>
            </View>

            <Card style={styles.card}>
                <Card.Content>
                    {step === 'details' && (
                        <>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                                <TextInput
                                    label="First Name"
                                    value={firstName}
                                    onChangeText={setFirstName}
                                    mode="outlined"
                                    autoCapitalize="words"
                                    style={{ flex: 1 }}
                                />
                                <TextInput
                                    label="Last Name"
                                    value={lastName}
                                    onChangeText={setLastName}
                                    mode="outlined"
                                    autoCapitalize="words"
                                    style={{ flex: 1 }}
                                />
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                                <CountryCodeSelector
                                    selectedCountry={selectedCountry}
                                    onSelect={setSelectedCountry}
                                />
                                <TextInput
                                    label="Phone"
                                    value={phoneNumber}
                                    onChangeText={setPhoneNumber}
                                    mode="outlined"
                                    keyboardType="phone-pad"
                                    style={{ flex: 1 }}
                                    right={isPhoneVerified ? <TextInput.Icon icon="check-circle" color={theme.colors.primary} /> : null}
                                />
                            </View>
                            <TextInput
                                label="Email"
                                value={email}
                                onChangeText={setEmail}
                                mode="outlined"
                                autoCapitalize="none"
                                keyboardType="email-address"
                                style={styles.input}
                            />
                            <TextInput
                                label="Password"
                                value={password}
                                onChangeText={setPassword}
                                mode="outlined"
                                secureTextEntry={!showPassword}
                                right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} onPress={() => setShowPassword(!showPassword)} />}
                                style={styles.input}
                            />
                            {password.length > 0 && (
                                <View style={styles.passwordRulesContainer}>
                                    <View style={styles.passwordRuleRow}>
                                        <MaterialCommunityIcons name={password.length >= 8 ? "check-circle" : "close-circle"} size={16} color={password.length >= 8 ? theme.colors.primary : theme.colors.error} />
                                        <Text style={[styles.passwordRuleText, { color: password.length >= 8 ? theme.colors.primary : theme.colors.error }]}>8+ characters</Text>
                                    </View>
                                    <View style={styles.passwordRuleRow}>
                                        <MaterialCommunityIcons name={/[A-Z]/.test(password) ? "check-circle" : "close-circle"} size={16} color={/[A-Z]/.test(password) ? theme.colors.primary : theme.colors.error} />
                                        <Text style={[styles.passwordRuleText, { color: /[A-Z]/.test(password) ? theme.colors.primary : theme.colors.error }]}>Uppercase letter</Text>
                                    </View>
                                    <View style={styles.passwordRuleRow}>
                                        <MaterialCommunityIcons name={/[a-z]/.test(password) ? "check-circle" : "close-circle"} size={16} color={/[a-z]/.test(password) ? theme.colors.primary : theme.colors.error} />
                                        <Text style={[styles.passwordRuleText, { color: /[a-z]/.test(password) ? theme.colors.primary : theme.colors.error }]}>Lowercase letter</Text>
                                    </View>
                                    <View style={styles.passwordRuleRow}>
                                        <MaterialCommunityIcons name={/[0-9]/.test(password) ? "check-circle" : "close-circle"} size={16} color={/[0-9]/.test(password) ? theme.colors.primary : theme.colors.error} />
                                        <Text style={[styles.passwordRuleText, { color: /[0-9]/.test(password) ? theme.colors.primary : theme.colors.error }]}>Number</Text>
                                    </View>
                                    <View style={styles.passwordRuleRow}>
                                        <MaterialCommunityIcons name={/[^A-Za-z0-9]/.test(password) ? "check-circle" : "close-circle"} size={16} color={/[^A-Za-z0-9]/.test(password) ? theme.colors.primary : theme.colors.error} />
                                        <Text style={[styles.passwordRuleText, { color: /[^A-Za-z0-9]/.test(password) ? theme.colors.primary : theme.colors.error }]}>Special character</Text>
                                    </View>
                                </View>
                            )}
                            <TextInput
                                label="Confirm Password"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                mode="outlined"
                                secureTextEntry={!showConfirmPassword}
                                right={<TextInput.Icon icon={showConfirmPassword ? "eye-off" : "eye"} onPress={() => setShowConfirmPassword(!showConfirmPassword)} />}
                                style={styles.input}
                            />
                            <Button
                                mode="contained"
                                onPress={handleSignUpStep}
                                loading={loading}
                                disabled={loading}
                                style={styles.button}
                            >
                                {isPhoneVerified ? 'Final Step: Create Account' : 'Step 1: Verify Phone & Proceed'}
                            </Button>
                        </>
                    )}

                    {step === 'phone_verify' && (
                        <>
                            <TextInput
                                label="Verification Code"
                                value={verificationCode}
                                onChangeText={setVerificationCode}
                                mode="outlined"
                                keyboardType="number-pad"
                                style={styles.input}
                            />
                            <Button
                                mode="contained"
                                onPress={handleVerifyOTP}
                                loading={loading}
                                disabled={loading || verificationCode.length < 6}
                                style={styles.button}
                            >
                                Verify OTP
                            </Button>
                            <Button
                                mode="text"
                                onPress={() => setStep('details')}
                                style={styles.button}
                            >
                                Back to Details
                            </Button>
                        </>
                    )}

                    {step === 'email_verify' && (
                        <>
                            <View style={{ alignItems: 'center', marginVertical: 20 }}>
                                <MaterialCommunityIcons name="email-check-outline" size={64} color={theme.colors.primary} />
                                <Text style={{ textAlign: 'center', marginTop: 16 }}>
                                    We've sent a verification email to {email}.
                                </Text>
                            </View>
                            <Button
                                mode="contained"
                                onPress={handleCheckEmailVerified}
                                loading={loading}
                                style={styles.button}
                            >
                                I have verified my email
                            </Button>
                            <Button
                                mode="text"
                                onPress={async () => {
                                    await authService.sendVerificationEmail();
                                    Alert.alert("Sent", "Verification email resent.");
                                }}
                                style={styles.button}
                            >
                                Resend Email
                            </Button>
                        </>
                    )}

                    {step === 'details' && (
                        <>
                            <Button
                                mode="text"
                                onPress={() => router.push('/(auth)/sign-in' as any)}
                                style={styles.button}
                            >
                                Already have an account? Sign In
                            </Button>

                            <View style={styles.dividerContainer}>
                                <View style={styles.divider} />
                                <Text style={styles.dividerText}>OR</Text>
                                <View style={styles.divider} />
                            </View>

                            <Button
                                icon="google"
                                mode="outlined"
                                onPress={() => handleSocialLogin('google')}
                                loading={socialLoading === 'google'}
                                disabled={loading || !!socialLoading}
                                style={styles.socialButton}
                            >
                                Sign up with Google
                            </Button>
                            <Button
                                icon="apple"
                                mode="outlined"
                                onPress={() => handleSocialLogin('apple')}
                                loading={socialLoading === 'apple'}
                                disabled={loading || !!socialLoading}
                                style={styles.socialButton}
                            >
                                Sign up with Apple
                            </Button>
                        </>
                    )}
                </Card.Content>
            </Card>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 20,
        justifyContent: 'center',
    },
    header: {
        marginBottom: 40,
        alignItems: 'center',
    },
    title: {
        fontWeight: 'bold',
        textAlign: 'center',
    },
    subtitle: {
        textAlign: 'center',
        opacity: 0.7,
        marginTop: 10,
    },
    card: {
        elevation: 4,
    },
    input: {
        marginBottom: 16,
    },
    passwordRulesContainer: {
        backgroundColor: 'rgba(0,0,0,0.02)',
        padding: 12,
        borderRadius: 8,
        gap: 8,
        marginTop: -8,
        marginBottom: 16,
    },
    passwordRuleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    passwordRuleText: {
        fontSize: 13,
    },
    button: {
        marginTop: 8,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: '#e0e0e0',
    },
    dividerText: {
        marginHorizontal: 16,
        color: '#666',
        fontWeight: 'bold',
    },
    socialButton: {
        marginBottom: 12,
        borderColor: '#ddd',
    },
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
});

