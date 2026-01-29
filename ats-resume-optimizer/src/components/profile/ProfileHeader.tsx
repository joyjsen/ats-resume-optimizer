import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Avatar, Text, IconButton, useTheme, Chip } from 'react-native-paper';
import { UserProfile } from '../../types/profile.types';

interface ProfileHeaderProps {
    profile: UserProfile;
    onEdit: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ profile, onEdit }) => {
    const theme = useTheme();

    const displayNameResult = profile.displayName || 'Guest User';
    const initials = displayNameResult.substring(0, 2).toUpperCase() || 'GU';
    const createdAt = profile.createdAt ? new Date(profile.createdAt) : new Date();

    const memberSince = createdAt.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
    });

    return (
        <View style={styles.container}>
            <View style={styles.avatarContainer}>
                {profile.photoURL ? (
                    <Avatar.Image size={100} source={{ uri: profile.photoURL }} />
                ) : (
                    <Avatar.Text size={100} label={initials} />
                )}
                <TouchableOpacity style={styles.editButton} onPress={onEdit}>
                    <IconButton icon="pencil" size={20} iconColor="white" style={{ backgroundColor: theme.colors.primary }} />
                </TouchableOpacity>
            </View>

            <Text variant="headlineSmall" style={styles.name}>{profile.displayName}</Text>
            <Text variant="bodyMedium" style={[styles.email, { color: theme.colors.onSurfaceVariant }]}>{profile.email}</Text>

            <Chip icon="account-clock" style={[styles.badge, { backgroundColor: theme.colors.elevation.level1 }]}>
                Member since {memberSince}
            </Chip>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    editButton: {
        position: 'absolute',
        bottom: -10,
        right: -10,
    },
    name: {
        fontWeight: 'bold',
    },
    email: {
        // color: '#666', -- Handled inline
        marginBottom: 12,
    },
    badge: {
        // backgroundColor: '#f0f0f0', -- Handled inline
    }
});
