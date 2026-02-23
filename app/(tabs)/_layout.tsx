import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useTheme, Icon } from 'react-native-paper';
import { UserHeader } from '../../src/components/layout/UserHeader';
import { AppLogo } from '../../src/components/layout/AppLogo';
import { useProfileStore } from '../../src/store/profileStore';

import { TokenBalance } from '../../src/components/layout/TokenBalance';
import { View } from 'react-native';

export default function TabsLayout() {
    const theme = useTheme();
    const { userProfile, subscribeToProfile } = useProfileStore();

    useEffect(() => {
        if (userProfile?.uid) {
            const unsubscribe = subscribeToProfile(userProfile.uid);
            return () => unsubscribe();
        }
    }, [userProfile?.uid, subscribeToProfile]);

    if (!userProfile) {
        return null;
    }

    const HeaderLeftWithBalance = () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AppLogo />
            <TokenBalance />
        </View>
    );

    return (
        <Tabs
            screenOptions={{
                headerShown: Platform.OS !== 'web',
                headerLeft: () => <AppLogo />,
                headerRight: () => <UserHeader />,
                headerStyle: {
                    backgroundColor: theme.colors.elevation.level2,
                },
                headerTintColor: theme.colors.onSurface,
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
                tabBarStyle: Platform.OS === 'web' ? { display: 'none' } : {
                    backgroundColor: theme.colors.elevation.level2,
                    borderTopColor: theme.colors.outlineVariant,
                },
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, size }) => <Icon source="home" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="optimize"
                options={{
                    title: 'Optimize',
                    headerLeft: () => <HeaderLeftWithBalance />,
                    tabBarIcon: ({ color, size }) => <Icon source="shimmer" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="analyze"
                options={{
                    title: 'Analyze',
                    headerLeft: () => <HeaderLeftWithBalance />,
                    tabBarIcon: ({ color, size }) => <Icon source="file-document-edit" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="applications"
                options={{
                    title: 'Applications',
                    headerLeft: () => <HeaderLeftWithBalance />,
                    tabBarIcon: ({ color, size }) => <Icon source="briefcase" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="learning"
                options={{
                    title: 'Learning',
                    headerLeft: () => <HeaderLeftWithBalance />,
                    tabBarIcon: ({ color, size }) => <Icon source="school" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, size }) => <Icon source="account" size={size} color={color} />,
                }}
            />
        </Tabs>
    );
}
