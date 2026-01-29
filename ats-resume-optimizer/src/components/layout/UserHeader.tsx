import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from 'react-native-paper';
import { useProfileStore } from '../../store/profileStore';

export const UserHeader = () => {
    const { userProfile } = useProfileStore();
    const router = useRouter();

    if (!userProfile) return null;

    return (
        <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            style={{ marginRight: 16, flexDirection: 'row', alignItems: 'center' }}
        >
            {userProfile.photoURL ? (
                <Avatar.Image size={32} source={{ uri: userProfile.photoURL }} />
            ) : (
                <Avatar.Text size={32} label={userProfile.displayName?.substring(0, 2).toUpperCase() || 'U'} />
            )}
        </TouchableOpacity>
    );
};
