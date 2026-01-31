import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import { authService, UserInactiveError } from '../services/firebase/authService';

export default function LoginScreen({ navigation }: any) {
    const [loading, setLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        try {
            const user = await authService.signInWithGoogle();
            console.log('Signed in as:', user.displayName);
            // Navigation is handled by auth state listener in App.js or Expo Router
        } catch (error: any) {
            if (error instanceof UserInactiveError || error.name === 'UserInactiveError') {
                Alert.alert('Account Inactive', 'User Inactive: Please contact admin.', [{ text: 'OK' }]);
            } else {
                Alert.alert(
                    'Sign In Failed',
                    error.message || 'Could not sign in with Google. Please try again.',
                    [{ text: 'OK' }]
                );
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Fallback to icon.png if logo.png is missing */}
            <Image
                source={require('../../assets/icon.png')}
                style={styles.logo}
            />

            <Text style={styles.title}>ATS Resume Optimizer</Text>
            <Text style={styles.subtitle}>
                Optimize your resume for any job with AI-powered insights
            </Text>

            <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                disabled={loading}
            >
                {/* Note: google-icon.png needs to be added to assets/ */}
                <View style={styles.googleIconPlaceholder} />
                <Text style={styles.googleButtonText}>
                    {loading ? 'Signing in...' : 'Continue with Google'}
                </Text>
            </TouchableOpacity>

            <Text style={styles.termsText}>
                By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
    },
    logo: {
        width: 120,
        height: 120,
        marginBottom: 20,
        borderRadius: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 40,
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    googleIconPlaceholder: {
        width: 24,
        height: 24,
        marginRight: 12,
        backgroundColor: '#4285F4',
        borderRadius: 12,
    },
    googleButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    termsText: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
        paddingHorizontal: 40,
    },
});
