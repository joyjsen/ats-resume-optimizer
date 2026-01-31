import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar, IconButton } from 'react-native-paper';
import { useAppTheme } from '../../context/ThemeContext';
import { useProfileStore } from '../../store/profileStore';

export const UserHeader = () => {
    const { userProfile } = useProfileStore();
    const router = useRouter();
    const { isDark, toggleTheme } = useAppTheme();

    if (!userProfile) return null;

    return (
        <TouchableOpacity
            style={{ marginRight: 16, flexDirection: 'row', alignItems: 'center' }}
        >
            <IconButton
                icon={isDark ? "weather-sunny" : "weather-night"}
                onPress={toggleTheme}
                size={24}
            />
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
                {userProfile.photoURL ? (
                    <Avatar.Image size={32} source={{ uri: userProfile.photoURL }} />
                ) : (
                    <Avatar.Text size={32} label={userProfile.displayName?.substring(0, 2).toUpperCase() || 'U'} />
                )}
            </TouchableOpacity>
        </TouchableOpacity>
    );
};
