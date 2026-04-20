import React from 'react';
import { View, TouchableOpacity, useWindowDimensions, Image, Pressable, Platform } from 'react-native';
import { Text, useTheme, Icon, Divider } from 'react-native-paper';
import { useRouter, useSegments } from 'expo-router';
import { useProfileStore } from '../../store/profileStore';
import { webStyles } from '../../styles/web.styles';
import { authService } from '../../services/firebase/authService';

interface NavItem {
    label: string;
    icon: string;
    route: string;
}

const navItems: NavItem[] = [
    { label: 'Home', icon: 'home', route: '/(tabs)/home' },
    { label: 'Optimize', icon: 'shimmer', route: '/(tabs)/optimize' },
    { label: 'Analyze', icon: 'file-document-edit', route: '/(tabs)/analyze' },
    { label: 'Applications', icon: 'briefcase', route: '/(tabs)/applications' },
    { label: 'Learning', icon: 'school', route: '/(tabs)/learning' },
    { label: 'Profile', icon: 'account', route: '/(tabs)/profile' },
];

export const WebSidebar: React.FC = () => {
    const theme = useTheme();
    const router = useRouter();
    const segments = useSegments();
    const { userProfile } = useProfileStore();
    const { width } = useWindowDimensions();
    const isCollapsed = width < 900;

    const currentRoute = `/${segments.join('/')}`;

    const handleNavigate = (route: string) => {
        router.push(route as any);
    };

    const handleLogout = async () => {
        try {
            await authService.logout();
            if (Platform.OS === 'web') {
                window.location.href = 'https://www.riresume.com';
            } else {
                router.replace('/' as any);
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    return (
        <View
            style={[
                webStyles.sidebarContainer,
                {
                    backgroundColor: theme.colors.elevation.level2,
                    borderRightColor: theme.colors.outlineVariant,
                    width: isCollapsed ? 64 : 240,
                },
            ]}
        >
            {/* Logo / Brand */}
            <Pressable
                onPress={() => {
                    if (Platform.OS === 'web') {
                        window.location.href = 'https://www.riresume.com';
                    }
                }}
                style={{ paddingHorizontal: 16, paddingBottom: 16, alignItems: isCollapsed ? 'center' : 'flex-start', flexDirection: isCollapsed ? 'column' : 'row', gap: 10 }}
            >
                <Image
                    source={require('../../../assets/logo-72.png')}
                    style={{ width: isCollapsed ? 36 : 40, height: isCollapsed ? 36 : 40, borderRadius: 8 }}
                    resizeMode="contain"
                />
                {!isCollapsed && (
                    <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}>
                        RiResume
                    </Text>
                )}
            </Pressable>

            <Divider style={{ marginBottom: 8, backgroundColor: theme.colors.outlineVariant }} />

            {/* Navigation Items */}
            {navItems.map((item) => {
                const isActive = currentRoute.includes(item.route.replace('/(tabs)', ''));
                return (
                    <TouchableOpacity
                        key={item.route}
                        onPress={() => handleNavigate(item.route)}
                        style={[
                            webStyles.sidebarItem,
                            isActive && { backgroundColor: theme.colors.primaryContainer },
                        ]}
                    >
                        <Icon
                            source={item.icon}
                            size={22}
                            color={isActive ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant}
                        />
                        {!isCollapsed && (
                            <Text
                                style={[
                                    webStyles.sidebarItemText,
                                    { color: isActive ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant },
                                ]}
                            >
                                {item.label}
                            </Text>
                        )}
                    </TouchableOpacity>
                );
            })}

            {/* Token Balance */}
            <View style={[webStyles.sidebarTokens, { borderTopColor: theme.colors.outlineVariant }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
                    <Icon source="lightning-bolt" size={20} color={theme.colors.tertiary} />
                    {!isCollapsed && (
                        <Text style={{ marginLeft: 8, color: theme.colors.onSurface, fontWeight: '600' }}>
                            {userProfile?.tokenBalance ?? 0} Tokens
                        </Text>
                    )}
                </View>
            </View>

            {/* Logout Button */}
            <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
            <TouchableOpacity
                onPress={handleLogout}
                style={[
                    webStyles.sidebarItem,
                    { marginTop: 4, marginBottom: 8 },
                ]}
            >
                <Icon source="logout" size={22} color={theme.colors.error} />
                {!isCollapsed && (
                    <Text style={[webStyles.sidebarItemText, { color: theme.colors.error }]}>
                        Logout
                    </Text>
                )}
            </TouchableOpacity>
        </View>
    );
};
