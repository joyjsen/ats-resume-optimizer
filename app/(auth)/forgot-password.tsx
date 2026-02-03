import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, useTheme, Card, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { authService } from '../../src/services/firebase/authService';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function ForgotPasswordScreen() {
    const theme = useTheme();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'input' | 'success'>('input');

    const handleReset = async () => {
        if (!email) {
            Alert.alert("Error", "Please enter your email address.");
            return;
        }

        const trimmedEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            Alert.alert("Error", "Please enter a valid email address.");
            return;
        }

        setLoading(true);
        try {
            // 1. Attempt to check Registration Method via Secure Cloud Function
            try {
                const functions = getFunctions();
                const checkUserProviderFunc = httpsCallable(functions, 'checkUserProvider');
                const result = await checkUserProviderFunc({ email: trimmedEmail });
                const info = result.data as any;

                if (info?.exists) {
                    if (info.status === 'deleted' || info.status === 'suspended') {
                        Alert.alert("Account Blocked", `This account is currently ${info.status}. Please contact support for assistance.`);
                        setLoading(false);
                        return;
                    }

                    if (info.provider && info.provider !== 'email' && info.provider !== 'password') {
                        const providerName = info.provider.charAt(0).toUpperCase() + info.provider.slice(1);
                        Alert.alert(
                            "Social Login Detected",
                            `This account was created using ${providerName}. Please sign in using the ${providerName} button instead.`
                        );
                        setLoading(false);
                        return;
                    }
                } else {
                    // If Firestore doesn't know the email, try standard Firebase fetchSignInMethods
                    // (This works if Enumeration Protection is OFF in Firebase Console)
                    const providers = await authService.fetchSignInMethods(trimmedEmail);
                    if (providers.length > 0 && !providers.includes('password')) {
                        const providerName = providers[0].split('.')[0];
                        const displayProvider = providerName.charAt(0).toUpperCase() + providerName.slice(1);
                        Alert.alert(
                            "Social Login Detected",
                            `This account is linked to ${displayProvider}. Please sign in using the ${displayProvider} button instead.`
                        );
                        setLoading(false);
                        return;
                    }
                }
            } catch (checkError) {
                console.log("[ForgotPassword] Secure check failed, falling back to standard Firebase check.");
                const providers = await authService.fetchSignInMethods(trimmedEmail);
                if (providers.length > 0 && !providers.includes('password')) {
                    const providerName = providers[0].split('.')[0];
                    const displayProvider = providerName.charAt(0).toUpperCase() + providerName.slice(1);
                    Alert.alert(
                        "Social Login Detected",
                        `This account is linked to ${displayProvider}. Please sign in using the ${displayProvider} button instead.`
                    );
                    setLoading(false);
                    return;
                }
            }

            // 2. Send Reset Email
            await authService.resetPassword(trimmedEmail);
            setStep('success');

        } catch (error: any) {
            console.error("Reset Password Error:", error);
            if (error.code === 'auth/network-request-failed') {
                Alert.alert("Connection Error", "Please check your internet connection and try again.");
            } else {
                // For security, still show success message (Email Enumeration Protection)
                setStep('success');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <Text variant="displaySmall" style={styles.title}>Reset Password</Text>
                <Text variant="bodyLarge" style={styles.subtitle}>
                    Enter your email to receive a reset link.
                </Text>
            </View>

            <Card style={styles.card}>
                <Card.Content>
                    {step === 'input' ? (
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

                            <Button
                                mode="contained"
                                onPress={handleReset}
                                loading={loading}
                                disabled={loading}
                                style={styles.button}
                            >
                                Send Reset Link
                            </Button>
                        </>
                    ) : (
                        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                            <Button icon="email-check" mode="text" style={{ marginBottom: 16 }} contentStyle={{ transform: [{ scale: 2 }] }}>
                                {""}
                            </Button>
                            <Text variant="headlineSmall" style={{ marginBottom: 8, fontWeight: 'bold' }}>Link Sent!</Text>
                            <Text variant="bodyMedium" style={{ textAlign: 'center', marginBottom: 8 }}>
                                A password reset link has been sent to:
                            </Text>
                            <Text variant="bodyLarge" style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 24, color: theme.colors.primary }}>
                                {email.trim().toLowerCase()}
                            </Text>
                            <Text variant="bodySmall" style={{ textAlign: 'center', marginBottom: 24, opacity: 0.7 }}>
                                If you don't see it within a few minutes, please check your spam folder or verify if you used a social login (Google/Apple) originally.
                            </Text>
                            <Button mode="contained" onPress={() => router.back()}>
                                Back to Login
                            </Button>
                        </View>
                    )}

                    {step === 'input' && (
                        <Button
                            mode="text"
                            onPress={() => router.back()}
                            style={[styles.button, { marginTop: 16 }]}
                        >
                            Back to Login
                        </Button>
                    )}
                </Card.Content>
            </Card>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
    },
    header: {
        marginBottom: 32,
        alignItems: 'center',
    },
    title: {
        fontWeight: 'bold',
        textAlign: 'center',
    },
    subtitle: {
        textAlign: 'center',
        opacity: 0.7,
        marginTop: 8,
    },
    card: {
        elevation: 2,
    },
    input: {
        marginBottom: 16,
    },
    button: {
        marginTop: 8,
    }
});
