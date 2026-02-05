import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, ScrollView, Image } from 'react-native';
import { Text, TextInput, Button, useTheme, Card } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { authService, UserInactiveError } from '../../src/services/firebase/authService';
import { auth } from '../../src/services/firebase/config';
import RecaptchaVerifierModal from '../../src/components/auth/RecaptchaVerifierModal';
import { LinearGradient } from 'expo-linear-gradient';

export default function SignIn() {
    const router = useRouter();
    const theme = useTheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [socialLoading, setSocialLoading] = useState<string | null>(null);
    const [showPhoneLogin, setShowPhoneLogin] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [confirming, setConfirming] = useState(false);
    const params = useLocalSearchParams();

    // Ref for reCAPTCHA
    const recaptchaVerifier = useRef(null);

    // Anti-hang: Reset loading states whenever auth state changes to "signed out"
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (!user) {
                setLoading(false);
                setSocialLoading(null);
            }
        });
        return unsubscribe;
    }, []);

    // Handle deep link to phone login
    useEffect(() => {
        if (params.phone === 'true') {
            setShowPhoneLogin(true);
        }
    }, [params.phone]);

    const handleSocialLogin = async (provider: 'google' | 'apple' | 'microsoft') => {
        setSocialLoading(provider);
        try {
            if (provider === 'google') await authService.signInWithGoogle();
            else if (provider === 'apple') await authService.signInWithApple();
            else if (provider === 'microsoft') await authService.signInWithMicrosoft();
        } catch (error: any) {
            console.error(`${provider} Login Error:`, error);
            const isInactive = error instanceof UserInactiveError ||
                error.name === 'UserInactiveError' ||
                error.message?.includes('User Inactive');

            if (isInactive) {
                Alert.alert("Account Inactive", "User Inactive: Please contact admin.");
            } else if (error.code !== -1 && error.code !== 'auth/cancelled') {
                let message = error.message;
                if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    message = "Invalid email or password. If you recently restored your account or used social login before, please try 'Forgot Password' or your social login method.";
                }
                Alert.alert("Login Failed", message || `Could not sign in with ${provider}.`);
            }
        } finally {
            setSocialLoading(null);
        }
    };

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("Error", "Please fill in all fields.");
            return;
        }

        setLoading(true);
        try {
            await authService.loginWithEmail(email, password);
        } catch (error: any) {
            console.error("Login Error:", error);
            const isInactive = error instanceof UserInactiveError ||
                error.name === 'UserInactiveError' ||
                error.message?.includes('User Inactive');

            if (isInactive) {
                Alert.alert("Account Inactive", "User Inactive: Please contact admin.");
            } else {
                let message = error.message;
                if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    message = "Invalid email or password. Please try again or use 'Forgot Password'. if you previously used Google/Apple login, please use that instead.";
                }
                Alert.alert("Login Failed", message || "Invalid credentials.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSendVerification = async () => {
        if (!phoneNumber) {
            Alert.alert("Error", "Please enter a valid phone number (e.g. +1...)");
            return;
        }
        setLoading(true);
        try {
            // Updated to pass the verifier
            await authService.signInWithPhoneNumber(phoneNumber, recaptchaVerifier.current || undefined);
            setConfirming(true);
            Alert.alert("Success", "Verification code sent!");
        } catch (error: any) {
            console.error("Phone Auth Error", error);
            Alert.alert("Error", error.message || "Failed to send code.");
            setConfirming(false);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmVerification = async () => {
        if (!verificationCode) {
            Alert.alert("Error", "Please enter the code.");
            return;
        }
        setLoading(true);
        try {
            await authService.confirmPhoneCode(verificationCode);
            // Navigation handled by auth listener in RootLayout actually, 
            // but usually we might want to explicity redirect or wait.
            // But RootLayout will see the user change and redirect.
        } catch (error: any) {
            Alert.alert("Error", error.message || "Invalid code.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={[theme.colors.elevation.level3, theme.colors.background]}
            style={{ flex: 1 }}
        >
            <ScrollView contentContainerStyle={styles.container}>
                <RecaptchaVerifierModal
                    ref={recaptchaVerifier}
                    firebaseConfig={auth.app.options}
                    title="Verify you are human"
                    cancelLabel="Close"
                />
                <View style={styles.header}>
                    <Image
                        source={require('../../assets/logo.png')}
                        style={{ width: 100, height: 100, marginBottom: 16 }}
                        resizeMode="contain"
                    />
                    <Text variant="headlineMedium" style={styles.title}>Welcome to RiResume</Text>
                    <Text variant="titleMedium" style={[styles.title, { marginTop: 4, marginBottom: 8 }]}>Your Personalized ATS Resume Optimizer</Text>
                    <Text variant="bodyLarge" style={styles.subtitle}>Sign in to optimize your career</Text>
                </View>

                <Card style={styles.card}>
                    <Card.Content>
                        {!showPhoneLogin ? (
                            <>
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
                                    secureTextEntry
                                    style={styles.input}
                                />
                                <Button
                                    mode="contained"
                                    onPress={handleLogin}
                                    loading={loading}
                                    disabled={loading}
                                    style={styles.button}
                                >
                                    Sign In
                                </Button>
                                <Button
                                    mode="text"
                                    compact
                                    onPress={() => router.push('/(auth)/forgot-password' as any)}
                                    style={{ alignSelf: 'flex-end', marginTop: 4 }}
                                    labelStyle={{ fontSize: 12 }}
                                >
                                    Forgot Password?
                                </Button>
                                <Button
                                    mode="text"
                                    onPress={() => router.push('/(auth)/sign-up' as any)}
                                    style={styles.button}
                                >
                                    Don't have an account? Sign Up
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
                                    Continue with Google
                                </Button>
                                <Button
                                    icon="apple"
                                    mode="outlined"
                                    onPress={() => handleSocialLogin('apple')}
                                    loading={socialLoading === 'apple'}
                                    disabled={loading || !!socialLoading}
                                    style={styles.socialButton}
                                >
                                    Continue with Apple
                                </Button>

                                <Button
                                    icon="cellphone"
                                    mode="outlined"
                                    onPress={() => setShowPhoneLogin(true)}
                                    style={styles.socialButton}
                                >
                                    Continue with Phone
                                </Button>


                            </>
                        ) : (
                            <>
                                {/* PHONE LOGIN UI */}
                                <Text variant="titleMedium" style={{ marginBottom: 16, textAlign: 'center' }}>
                                    {confirming ? "Enter Verification Code" : "Phone Log In"}
                                </Text>

                                {!confirming ? (
                                    <>
                                        <TextInput
                                            label="Phone Number (e.g. +1...)"
                                            value={phoneNumber}
                                            onChangeText={setPhoneNumber}
                                            mode="outlined"
                                            keyboardType="phone-pad"
                                            autoComplete="tel"
                                            style={styles.input}
                                        />
                                        <Button
                                            mode="contained"
                                            onPress={handleSendVerification}
                                            loading={loading}
                                            disabled={loading}
                                            style={styles.button}
                                        >
                                            Send Code
                                        </Button>
                                    </>
                                ) : (
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
                                            onPress={handleConfirmVerification}
                                            loading={loading}
                                            disabled={loading}
                                            style={styles.button}
                                        >
                                            Verify & Sign In
                                        </Button>
                                    </>
                                )}

                                <Button
                                    mode="text"
                                    onPress={() => { setShowPhoneLogin(false); setConfirming(false); setVerificationCode(''); }}
                                    style={[styles.button, { marginTop: 16 }]}
                                >
                                    Back to Email Login
                                </Button>
                            </>
                        )}
                    </Card.Content>
                </Card>
            </ScrollView>
        </LinearGradient>
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
