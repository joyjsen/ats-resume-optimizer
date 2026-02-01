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

            // Use dismissAll if available (safer than while loop)
            if (router.canDismiss()) {
                router.dismissAll();
            }

            // Navigate to home with clean state
            setTimeout(() => {
                router.navigate('/(tabs)/home');
            }, 100);
        } catch (error) {
            console.error("Logo reset error:", error);
            // Fallback
            router.navigate('/(tabs)/home');
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
