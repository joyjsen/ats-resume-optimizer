import React from 'react';
import { Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useResumeStore } from '../../store/resumeStore';

export const AppLogo = () => {
    const router = useRouter();
    const { setCurrentAnalysis } = useResumeStore();

    const handleReset = () => {
        try {
            // Clear any stored analysis state
            setCurrentAnalysis(null);

            // Guard: Only navigate if the router is ready
            // Check if we can navigate by verifying the navigation state exists
            const canNavigate = router && typeof router.navigate === 'function';
            if (!canNavigate) {
                console.warn("[AppLogo] Router not ready, skipping navigation.");
                return;
            }

            // Use dismissAll if available (safer than while loop)
            if (router.canDismiss()) {
                router.dismissAll();
            }

            // Navigate to home with clean state
            // Use replace to avoid stacking and reduce chance of race conditions
            router.replace('/(tabs)/home');
        } catch (error) {
            console.error("Logo reset error:", error);
            // Silently fail - don't attempt fallback navigation as it may cause the same error
        }
    };

    return (
        <TouchableOpacity
            onPress={handleReset}
            style={styles.container}
            activeOpacity={0.7}
        >
            <Image
                source={require('../../../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
            />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        marginLeft: 16,
        paddingVertical: 8,
    },
    logo: {
        width: 40,
        height: 40,
    }
});
