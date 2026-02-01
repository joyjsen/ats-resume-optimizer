import React from 'react';
import { View, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Text, useTheme, Icon, Divider } from 'react-native-paper';
import { useRouter, useSegments } from 'expo-router';
import { useProfileStore } from '../../store/profileStore';
import { webStyles } from '../../styles/web.styles';

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
            <View style={{ paddingHorizontal: 16, paddingBottom: 16, alignItems: isCollapsed ? 'center' : 'flex-start' }}>
                <Icon source="briefcase-check" size={32} color={theme.colors.primary} />
                {!isCollapsed && (
                    <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: 8, fontWeight: 'bold' }}>
                        ATS Optimizer
                    </Text>
                )}
            </View>

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
        </View>
    );
};
