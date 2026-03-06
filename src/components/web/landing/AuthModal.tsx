import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, ScrollView, Image, Platform, Modal, Pressable } from 'react-native';
import { Text, TextInput, Button, useTheme, Card, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { authService, UserInactiveError } from '../../../services/firebase/authService';
import { auth } from '../../../services/firebase/config';
import RecaptchaVerifierModal from '../../auth/RecaptchaVerifierModal';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from './LandingData';

interface AuthModalProps {
    visible: boolean;
    onClose: () => void;
    initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, initialMode = 'signin' }) => {
    const router = useRouter();
    const theme = useTheme();
    const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);

    // Auth States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');

    // UI States
    const [loading, setLoading] = useState(false);
    const [socialLoading, setSocialLoading] = useState<string | null>(null);
    const [showPhoneLogin, setShowPhoneLogin] = useState(false);
    const [confirming, setConfirming] = useState(false);

    const recaptchaVerifier = useRef(null);

    // Reset state when visible/mode changes
    useEffect(() => {
        if (visible) {
            setMode(initialMode);
            // Reset errors/loading
            setLoading(false);
            setSocialLoading(null);
        }
    }, [visible, initialMode]);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("Error", "Please fill in all fields.");
            return;
        }
        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            Alert.alert("Error", "Please enter a valid email address.");
            return;
        }
        setLoading(true);
        try {
            await authService.loginWithEmail(email, password);
            onClose();
            router.replace('/(tabs)/home' as any);
        } catch (error: any) {
            console.error("Login Error:", error);
            handleAuthError(error, "Login Failed");
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async () => {
        if (!email || !password || !confirmPassword) {
            Alert.alert("Error", "Please fill in all fields.");
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert("Error", "Passwords do not match.");
            return;
        }
        if (password.length < 6) {
            Alert.alert("Error", "Password should be at least 6 characters.");
            return;
        }
        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            Alert.alert("Error", "Please enter a valid email address.");
            return;
        }

        setLoading(true);
        try {
            await authService.registerWithEmail(email, password, fullName);

            if (auth.currentUser) {
                await authService.sendVerificationEmail(auth.currentUser);
            }

            Alert.alert("Success", "Account created! Please check your email to verify your account.");
            onClose();
            // Layout guard handles redirection
        } catch (error: any) {
            console.error("Sign Up Error:", error);
            handleAuthError(error, "Sign Up Failed");
        } finally {
            setLoading(false);
        }
    };

    const handleSocialLogin = async (provider: 'google' | 'apple' | 'microsoft') => {
        if (provider === 'apple' && Platform.OS === 'web') {
            const msg = "Apple Sign-In is not available directly on the web. Please use the RiResume mobile app, or sign in with Google or email instead.";
            if (typeof window !== 'undefined') {
                window.alert(msg);
            } else {
                Alert.alert("Apple Login", msg);
            }
            return;
        }

        setSocialLoading(provider);
        try {
            if (provider === 'google') await authService.signInWithGoogle();
            else if (provider === 'apple') await authService.signInWithApple(); // This will only hit on native if we kept the button
            else if (provider === 'microsoft') await authService.signInWithMicrosoft();

            onClose();
            router.replace('/(tabs)/home' as any);
        } catch (error: any) {
            console.error(`${provider} Login Error:`, error);
            handleAuthError(error, "Social Auth Failed");
        } finally {
            setSocialLoading(null);
        }
    };

    const handleSendVerification = async () => {
        if (!phoneNumber) {
            Alert.alert("Error", "Please enter a valid phone number.");
            return;
        }

        let formattedNumber = phoneNumber.replace(/\s+/g, '').replace(/-/g, '').replace(/\(|\)/g, '');
        if (!formattedNumber.startsWith('+')) {
            if (formattedNumber.length === 10) formattedNumber = '+1' + formattedNumber;
            else if (formattedNumber.startsWith('1') && formattedNumber.length === 11) formattedNumber = '+' + formattedNumber;
            else {
                Alert.alert("Invalid Format", "Please include your country code (e.g. +1 for USA).");
                return;
            }
        }

        setLoading(true);
        try {
            const verifier = Platform.OS === 'web' ? undefined : recaptchaVerifier.current;
            await authService.signInWithPhoneNumber(formattedNumber, verifier || undefined);
            setConfirming(true);
            Alert.alert("Success", "Verification code sent!");
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to send code.");
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
            onClose();
            router.replace('/(tabs)/home' as any);
        } catch (error: any) {
            Alert.alert("Error", error.message || "Invalid code.");
        } finally {
            setLoading(false);
        }
    };

    const handleAuthError = (error: any, title: string) => {
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
            Alert.alert(title, message || "An unexpected error occurred.");
        }
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={styles.modalContent}>
                    <IconButton
                        icon="close"
                        size={24}
                        onPress={onClose}
                        style={styles.closeBtn}
                    />

                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        <RecaptchaVerifierModal
                            ref={recaptchaVerifier}
                            firebaseConfig={auth.app.options}
                            title="Verify you are human"
                            cancelLabel="Close"
                        />

                        <View style={styles.header}>
                            <Image
                                source={require('../../../../assets/logo.png')}
                                style={styles.logo}
                                resizeMode="contain"
                            />
                            <Text variant="headlineSmall" style={styles.title}>
                                {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
                            </Text>
                            <Text variant="bodyMedium" style={styles.subtitle}>
                                {mode === 'signin' ? 'Sign in to optimize your career' : 'Join us and optimize your career'}
                            </Text>
                        </View>

                        {!showPhoneLogin ? (
                            <View style={styles.form}>
                                {mode === 'signup' && (
                                    <TextInput
                                        label="Full Name"
                                        value={fullName}
                                        onChangeText={setFullName}
                                        mode="outlined"
                                        autoCapitalize="words"
                                        style={styles.input}
                                    />
                                )}
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
                                {mode === 'signup' && (
                                    <TextInput
                                        label="Confirm Password"
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        mode="outlined"
                                        secureTextEntry
                                        style={styles.input}
                                    />
                                )}

                                <Button
                                    mode="contained"
                                    onPress={mode === 'signin' ? handleLogin : handleSignUp}
                                    loading={loading}
                                    disabled={loading}
                                    style={styles.mainBtn}
                                    buttonColor={C.primary}
                                >
                                    {mode === 'signin' ? 'Sign In' : 'Create Account'}
                                </Button>

                                {mode === 'signin' && (
                                    <Button
                                        mode="text"
                                        compact
                                        onPress={() => {
                                            onClose();
                                            router.push('/(auth)/forgot-password' as any);
                                        }}
                                        style={styles.forgotBtn}
                                        labelStyle={{ fontSize: 13, color: C.textMuted }}
                                    >
                                        Forgot Password?
                                    </Button>
                                )}

                                <Button
                                    mode="text"
                                    onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                                    style={styles.toggleBtn}
                                    labelStyle={{ color: C.primary }}
                                >
                                    {mode === 'signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                                </Button>

                                <View style={styles.dividerRow}>
                                    <View style={styles.divider} />
                                    <Text style={styles.dividerText}>OR</Text>
                                    <View style={styles.divider} />
                                </View>

                                <View style={styles.socialRow}>
                                    <Button
                                        icon="google"
                                        mode="outlined"
                                        onPress={() => handleSocialLogin('google')}
                                        loading={socialLoading === 'google'}
                                        disabled={loading || !!socialLoading}
                                        style={styles.socialBtn}
                                    >
                                        Google
                                    </Button>
                                    <Button
                                        icon="apple"
                                        mode="outlined"
                                        onPress={() => handleSocialLogin('apple')}
                                        loading={socialLoading === 'apple'}
                                        disabled={loading || !!socialLoading}
                                        style={styles.socialBtn}
                                    >
                                        Apple
                                    </Button>
                                </View>

                                <Button
                                    icon="cellphone"
                                    mode="text"
                                    onPress={() => setShowPhoneLogin(true)}
                                    style={styles.phoneToggle}
                                    labelStyle={{ color: C.textSecondary }}
                                >
                                    Continue with Phone
                                </Button>
                            </View>
                        ) : (
                            <View style={styles.form}>
                                <Text variant="titleMedium" style={styles.phoneTitle}>
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
                                            style={styles.input}
                                        />
                                        <Button
                                            mode="contained"
                                            onPress={handleSendVerification}
                                            loading={loading}
                                            disabled={loading}
                                            style={styles.mainBtn}
                                            buttonColor={C.primary}
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
                                            style={styles.mainBtn}
                                            buttonColor={C.primary}
                                        >
                                            Verify & Sign In
                                        </Button>
                                    </>
                                )}

                                <Button
                                    mode="text"
                                    onPress={() => { setShowPhoneLogin(false); setConfirming(false); }}
                                    style={styles.toggleBtn}
                                >
                                    Back to Email Login
                                </Button>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    modalContent: {
        width: '90%',
        maxWidth: 480,
        maxHeight: '90%',
        backgroundColor: '#fff',
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
    },
    scrollContent: {
        padding: 32,
    },
    closeBtn: {
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 10,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logo: {
        width: 64,
        height: 64,
        marginBottom: 16,
    },
    title: {
        fontWeight: '700',
        color: C.textPrimary,
        textAlign: 'center',
    },
    subtitle: {
        color: C.textSecondary,
        textAlign: 'center',
        marginTop: 4,
    },
    form: {
        width: '100%',
    },
    input: {
        marginBottom: 16,
        backgroundColor: '#fff',
    },
    mainBtn: {
        marginTop: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    forgotBtn: {
        alignSelf: 'flex-end',
        marginTop: -8,
        marginBottom: 8,
    },
    toggleBtn: {
        marginTop: 8,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: '#f0f0f0',
    },
    dividerText: {
        marginHorizontal: 16,
        color: C.textMuted,
        fontWeight: '600',
        fontSize: 12,
    },
    socialRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    socialBtn: {
        flex: 1,
        borderRadius: 12,
        borderColor: '#eee',
    },
    phoneToggle: {
        marginTop: 8,
    },
    phoneTitle: {
        marginBottom: 24,
        textAlign: 'center',
        fontWeight: '600',
    },
});
