import React from 'react';
import { Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const AppLogo = () => {
    const router = useRouter();

    const handleReset = () => {
        // Global Reset Logic
        if (router.canDismiss()) {
            router.dismissAll();
        }
        // Force replace to ensure clean state
        router.replace('/(tabs)/home');
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
