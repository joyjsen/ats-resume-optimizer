import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, useTheme, Card, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { authService } from '../../src/services/firebase/authService';

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

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            Alert.alert("Error", "Please enter a valid email address.");
            return;
        }

        setLoading(true);
        try {
            // 1. Check Providers
            const providers = await authService.fetchSignInMethods(email);

            // If explicit "password" provider or NO provider (sometimes privacy settings hide this, but usually good to try)
            // Actually, if providers is empty for an existing user, it might be privacy protection (email enumeration protection).
            // But if we get a specific social provider, we know.

            const isSocial = providers.some(p => p.includes('google') || p.includes('apple') || p.includes('microsoft') || p.includes('facebook'));
            const hasPassword = providers.includes('password');

            if (isSocial && !hasPassword) {
                // Determine which provider to show in message
                const providerName = providers.find(p => p !== 'password')?.split('.')[0] || 'Social';
                Alert.alert(
                    "Social Login Detected",
                    `This email is linked to ${providerName}. Please update your ${providerName} password directly. This feature is only for email sign-ups.`
                );
                return;
            }

            // 2. Send Reset Email (if password user or we want to be safe)
            await authService.resetPassword(email);
            setStep('success');

        } catch (error: any) {
            console.error(error);
            // Depending on security config, we might not want to reveal if user exists, 
            // but for this app's UX requirements:
            Alert.alert("Error", "Failed to send reset link. Please check the email and try again.");
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
                            <Text variant="bodyMedium" style={{ textAlign: 'center', marginBottom: 24 }}>
                                Please check your email inbox (and spam) for the password reset link.
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
