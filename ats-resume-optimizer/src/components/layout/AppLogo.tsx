import React from 'react';
import { Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const AppLogo = () => {
    const router = useRouter();

    return (
        <TouchableOpacity
            onPress={() => router.push('/(tabs)')}
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
