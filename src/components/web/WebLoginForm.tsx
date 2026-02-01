import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Text, Button, useTheme, Divider } from 'react-native-paper';
import { authService } from '../../services/firebase/authService';

interface Props {
    onSuccess?: () => void;
}

export const WebLoginForm: React.FC<Props> = ({ onSuccess }) => {
    const theme = useTheme();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleEmailAuth = async () => {
        if (!email || !password) {
            setError('Please enter email and password');
            return;
        }
        if (isSignUp && password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                await authService.registerWithEmail(email, password);
            } else {
                await authService.loginWithEmail(email, password);
            }
            onSuccess?.();
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError(null);
        try {
            await authService.signInWithGoogle();
            onSuccess?.();
        } catch (err: any) {
            setError(err.message || 'Google sign-in failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.elevation.level2 }]}>
            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onSurface }]}>
                {isSignUp ? 'Create Account' : 'Welcome Back'}
            </Text>

            {error && (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
            )}

            <Button
                mode="outlined"
                icon="google"
                onPress={handleGoogleSignIn}
                disabled={loading}
                style={styles.googleButton}
                contentStyle={styles.googleButtonContent}
            >
                Continue with Google
            </Button>

            <View style={styles.dividerContainer}>
                <Divider style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                <Text style={[styles.dividerText, { color: theme.colors.onSurfaceVariant }]}>or</Text>
                <Divider style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
            </View>

            <TextInput
                placeholder="Email"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[
                    styles.input,
                    {
                        backgroundColor: theme.colors.surface,
                        color: theme.colors.onSurface,
                        borderColor: theme.colors.outline,
                    },
                ]}
            />

            <TextInput
                placeholder="Password"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={[
                    styles.input,
                    {
                        backgroundColor: theme.colors.surface,
                        color: theme.colors.onSurface,
                        borderColor: theme.colors.outline,
                    },
                ]}
            />

            {isSignUp && (
                <TextInput
                    placeholder="Confirm Password"
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    style={[
                        styles.input,
                        {
                            backgroundColor: theme.colors.surface,
                            color: theme.colors.onSurface,
                            borderColor: theme.colors.outline,
                        },
                    ]}
                />
            )}

            <Button
                mode="contained"
                onPress={handleEmailAuth}
                disabled={loading}
                loading={loading}
                style={styles.submitButton}
            >
                {isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>

            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.toggleContainer}>
                <Text style={{ color: theme.colors.primary }}>
                    {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 32,
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
    },
    title: {
        fontWeight: 'bold',
        marginBottom: 24,
        textAlign: 'center',
    },
    errorText: {
        marginBottom: 16,
        textAlign: 'center',
    },
    googleButton: {
        marginBottom: 16,
    },
    googleButtonContent: {
        paddingVertical: 8,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16,
    },
    divider: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        marginHorizontal: 12,
        fontSize: 12,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 16,
        marginBottom: 12,
        fontSize: 16,
    },
    submitButton: {
        marginTop: 8,
    },
    toggleContainer: {
        marginTop: 16,
        alignItems: 'center',
    },
});
