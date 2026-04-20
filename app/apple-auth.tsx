import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useTheme, Text } from 'react-native-paper';

export default function AppleAuthRedirect() {
    const theme = useTheme();
    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text variant="titleMedium" style={{ marginTop: 20, color: theme.colors.onBackground }}>
                Securely authenticating with Apple...
            </Text>
        </View>
    );
}
