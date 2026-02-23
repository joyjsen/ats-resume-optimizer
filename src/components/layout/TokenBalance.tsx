import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
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
                <MaterialCommunityIcons name="lightning-bolt" size={moderateScale(16)} color="#FF9800" />
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
        fontSize: moderateScale(14),
        fontWeight: 'bold',
    }
});
