import { Tabs } from 'expo-router';
import { useTheme, Icon } from 'react-native-paper';

export default function TabsLayout() {
    const theme = useTheme();

    return (
        <Tabs
            screenOptions={{
                headerShown: true,
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Dashboard',
                    tabBarIcon: ({ color, size }) => (
                        <Icon source="view-dashboard" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="analyze"
                options={{
                    title: 'Analyze',
                    tabBarIcon: ({ color, size }) => (
                        <Icon source="file-document-edit" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="applications"
                options={{
                    title: 'Applications',
                    tabBarIcon: ({ color, size }) => (
                        <Icon source="briefcase" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="learning"
                options={{
                    title: 'Learning',
                    tabBarIcon: ({ color, size }) => (
                        <Icon source="school" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, size }) => (
                        <Icon source="account" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
