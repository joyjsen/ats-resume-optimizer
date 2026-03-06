import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useProfileStore } from '../../store/profileStore';
import { moderateScale } from '../../utils/responsive';
import { useRouter } from 'expo-router';

export const TokenBalance = () => {
    const { userProfile } = useProfileStore();
    const theme = useTheme();
    const router = useRouter();

    if (!userProfile) return null;

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={() => router.push('/purchase')}
            activeOpacity={0.7}
        >
            <View style={styles.badge}>
                <MaterialCommunityIcons name="lightning-bolt" size={Platform.OS === 'web' ? 16 : moderateScale(16)} color="#FF9800" />
                <Text style={[styles.text, { color: theme.dark ? '#FFB74D' : '#F57C00' }]}>
                    {userProfile.tokenBalance}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        marginLeft: moderateScale(4),
        justifyContent: 'center',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: moderateScale(2),
    },
    text: {
        fontSize: Platform.OS === 'web' ? 14 : moderateScale(14),
        fontWeight: 'bold',
    }
});
