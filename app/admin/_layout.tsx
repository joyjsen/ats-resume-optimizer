import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useProfileStore } from '../../src/store/profileStore';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

/**
 * Admin Layout - Protects all routes under /admin
 */
export default function AdminLayout() {
    const { userProfile } = useProfileStore();
    const router = useRouter();
    const theme = useTheme();

    useEffect(() => {
        if (userProfile && userProfile.role !== 'admin') {
            console.warn('Unauthorized access attempt to Admin directory by:', userProfile.email);
            router.replace('/(tabs)/profile');
        }
    }, [userProfile?.role]);

    if (!userProfile) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (userProfile.role !== 'admin') {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <Text variant="headlineSmall" style={{ color: 'red', textAlign: 'center' }}>
                    Access Denied
                </Text>
                <Text variant="bodyMedium" style={{ textAlign: 'center', marginTop: 10 }}>
                    You do not have permission to view this section.
                </Text>
            </View>
        );
    }

    return (
        <Stack screenOptions={{
            headerShown: true,
            headerRight: () => (
                <Text
                    style={{ color: theme.colors.primary, marginRight: 16, fontWeight: 'bold' }}
                    onPress={() => router.replace('/(tabs)/profile')}
                >
                    Close
                </Text>
            )
        }}>
            <Stack.Screen name="index" options={{ title: 'Admin Registry' }} />
            <Stack.Screen name="users" options={{ title: 'User Management' }} />
            <Stack.Screen name="user/[uid]" options={{ title: 'User Detail' }} />
            <Stack.Screen name="activities" options={{ title: 'Activity Console' }} />
            <Stack.Screen name="analytics" options={{ title: 'Platform Analytics' }} />
            <Stack.Screen name="analysis-view" options={{ title: 'Analysis View' }} />
        </Stack>
    );
}
