import React from 'react';
import { TouchableOpacity, View, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar, IconButton } from 'react-native-paper';
import { useAppTheme } from '../../context/ThemeContext';
import { useProfileStore } from '../../store/profileStore';
import { moderateScale } from '../../utils/responsive';

export const UserHeader = () => {
    const { userProfile } = useProfileStore();
    const router = useRouter();
    const { isDark, toggleTheme } = useAppTheme();

    if (!userProfile) return null;

    return (
        <View
            style={{
                marginRight: moderateScale(4),
                flexDirection: 'row',
                alignItems: 'center',
                height: '100%'
            }}
        >
            <IconButton
                icon={isDark ? "weather-sunny" : "weather-night"}
                onPress={toggleTheme}
                size={Platform.OS === 'web' ? 22 : moderateScale(24)}
                style={{ margin: 0 }}
            />
            <TouchableOpacity
                onPress={() => router.push('/(tabs)/profile')}
                style={{ marginRight: moderateScale(8) }}
            >
                {userProfile.photoURL ? (
                    <Avatar.Image size={Platform.OS === 'web' ? 30 : moderateScale(32)} source={{ uri: userProfile.photoURL }} />
                ) : (
                    <Avatar.Text size={Platform.OS === 'web' ? 30 : moderateScale(32)} label={userProfile.displayName?.substring(0, 2).toUpperCase() || 'U'} />
                )}
            </TouchableOpacity>
        </View>
    );
};
