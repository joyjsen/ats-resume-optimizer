import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { Text, TextInput, Button, useTheme, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { authService } from '../../src/services/firebase/authService';

export default function SignUp() {
    const router = useRouter();
    const theme = useTheme();
    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [socialLoading, setSocialLoading] = useState<string | null>(null);

    const handleSocialLogin = async (provider: 'google' | 'apple' | 'microsoft') => {
        setSocialLoading(provider);
        try {
            if (provider === 'google') await authService.signInWithGoogle();
            else if (provider === 'apple') await authService.signInWithApple();
            else if (provider === 'microsoft') await authService.signInWithMicrosoft();
        } catch (error: any) {
            if (error.code !== -1) {
                console.error(`${provider} Login Error:`, error);
                Alert.alert("Sign Up Failed", error.message || `Could not sign up with ${provider}.`);
            }
        } finally {
            setSocialLoading(null);
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

        setLoading(true);
        try {
            const profile = await authService.registerWithEmail(email, password, fullName);

            // Send Verification Email
            // We need to wait a sec for auth state to propagate or just use the user we just made?
            // actually registerWithEmail returns user profile, but we need firebase user for verification
            // Send Verification Email
            const { auth } = require('../../src/services/firebase/config');
            console.log("Sign Up: Checking currentUser for verification...");
            if (auth.currentUser) {
                console.log("Sign Up: Sending verification email to", auth.currentUser.email);
                await authService.sendVerificationEmail(auth.currentUser);
                console.log("Sign Up: Verification email sent successfully.");
            } else {
                console.warn("Sign Up: No currentUser found after registration!");
            }
            Alert.alert("Success", "Account created! Please check your email (and spam) to verify your account.");

            // Layout guard will handle redirection to verify-email
            // But we can check if we need to do anything else here

        } catch (error: any) {
            console.error("Sign Up Error:", error);
            Alert.alert("Sign Up Failed", error.message || "Could not create account.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <Text variant="displaySmall" style={styles.title}>Create Account</Text>
                <Text variant="bodyLarge" style={styles.subtitle}>Join us and optimize your career</Text>
            </View>

            <Card style={styles.card}>
                <Card.Content>
                    <TextInput
                        label="Full Name"
                        value={fullName}
                        onChangeText={setFullName}
                        mode="outlined"
                        autoCapitalize="words"
                        style={styles.input}
                    />
                    <TextInput
                        label="Phone Number"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        mode="outlined"
                        keyboardType="phone-pad"
                        style={styles.input}
                    />
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
                    <TextInput
                        label="Confirm Password"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        mode="outlined"
                        secureTextEntry
                        style={styles.input}
                    />
                    <Button
                        mode="contained"
                        onPress={handleSignUp}
                        loading={loading}
                        disabled={loading}
                        style={styles.button}
                    >
                        Create Account
                    </Button>
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
                        icon="microsoft"
                        mode="outlined"
                        onPress={() => handleSocialLogin('microsoft')}
                        loading={socialLoading === 'microsoft'}
                        disabled={loading || !!socialLoading}
                        style={styles.socialButton}
                    >
                        Sign up with Microsoft
                    </Button>
                    <View style={styles.socialRow}>
                        <Button
                            icon="apple"
                            mode="outlined"
                            onPress={() => handleSocialLogin('apple')}
                            loading={socialLoading === 'apple'}
                            disabled={loading || !!socialLoading}
                            style={[styles.socialButton, { flex: 1, marginRight: 8 }]}
                        >
                            Apple
                        </Button>
                        <Button
                            icon="facebook"
                            mode="outlined"
                            onPress={() => Alert.alert("Coming Soon", "Facebook signup will be available soon.")}
                            style={[styles.socialButton, { flex: 1 }]}
                        >
                            Facebook
                        </Button>
                    </View>
                    <Button
                        icon="cellphone"
                        mode="outlined"
                        onPress={() => Alert.alert("Coming Soon", "Phone signup will be available soon.")}
                        style={styles.socialButton}
                    >
                        Sign up with Phone
                    </Button>
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

