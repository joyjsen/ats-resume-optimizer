import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, useTheme, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { authService } from '../../src/services/firebase/authService';
import { auth } from '../../src/services/firebase/config';
import { useProfileStore } from '../../src/store/profileStore';

export default function VerifyEmailScreen() {
    const theme = useTheme();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const { refreshProfile } = useProfileStore();

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (resendCooldown > 0) {
            interval = setInterval(() => {
                setResendCooldown((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [resendCooldown]);

    const handleCheckVerification = async () => {
        setLoading(true);
        try {
            const user = await authService.reloadUser();
            if (user?.emailVerified) {
                Alert.alert("Success", "Email verified!");
                // The root layout should pick this up automatically, but we can force a profile refresh
                await refreshProfile();
                router.replace('/(tabs)/');
            } else {
                Alert.alert("Not Verified", "We haven't detected the verification yet. Please check your email and click the link.");
            }
        } catch (error: any) {
            Alert.alert("Error", "Failed to check verification status.");
        } finally {
            setLoading(false);
        }
    };

    const handleResendEmail = async () => {
        if (resendCooldown > 0) return;

        setLoading(true);
        try {
            if (auth.currentUser) {
                await authService.sendVerificationEmail(auth.currentUser);
                Alert.alert("Sent", "Verification email sent! Please check your inbox (and spam folder).");
                setResendCooldown(60);
            }
        } catch (error: any) {
            // Firebase limits this automatically too
            Alert.alert("Error", error.message || "Failed to resend email.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await authService.logout();
            router.replace('/(auth)/sign-in');
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.content}>
                <Text variant="headlineMedium" style={styles.title}>Verify Your Email</Text>
                <Text variant="bodyLarge" style={styles.text}>
                    We've sent a verification link to:
                </Text>
                <Text variant="titleMedium" style={styles.email}>
                    {auth.currentUser?.email}
                </Text>
                <Text variant="bodyMedium" style={styles.instruction}>
                    Please click the link in that email to verify your account.
                    Once confirmed, return here and tap the button below.
                </Text>

                <Button
                    mode="contained"
                    onPress={handleCheckVerification}
                    loading={loading}
                    disabled={loading}
                    style={styles.button}
                >
                    I've Verified My Email
                </Button>

                <Button
                    mode="outlined"
                    onPress={handleResendEmail}
                    disabled={loading || resendCooldown > 0}
                    style={styles.button}
                >
                    {resendCooldown > 0 ? `Resend Email (${resendCooldown}s)` : "Resend Verification Email"}
                </Button>

                <Button
                    mode="text"
                    onPress={handleLogout}
                    style={[styles.button, { marginTop: 24 }]}
                    textColor={theme.colors.error}
                >
                    Log Out / Wrong Email
                </Button>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
    },
    content: {
        alignItems: 'center',
    },
    title: {
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    text: {
        textAlign: 'center',
        marginBottom: 4,
    },
    email: {
        fontWeight: 'bold',
        marginBottom: 24,
        color: '#6200ee',
    },
    instruction: {
        textAlign: 'center',
        marginBottom: 32,
        opacity: 0.7,
    },
    button: {
        width: '100%',
        marginVertical: 8,
    }
});
