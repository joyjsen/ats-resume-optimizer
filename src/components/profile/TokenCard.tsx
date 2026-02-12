import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Card, Text, Button, IconButton, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface TokenCardProps {
    balance: number;
    totalPurchased: number;
    totalUsed: number;
    onPurchase?: () => void;
    onViewAnalytics: () => void;
}

const isAndroid = Platform.OS === 'android';

export const TokenCard: React.FC<TokenCardProps> = ({ balance, totalPurchased, totalUsed, onPurchase, onViewAnalytics }) => {
    const theme = useTheme();

    return (
        <Card style={styles.card}>
            <Card.Content>
                <View style={styles.header}>
                    <View style={styles.balanceContainer}>
                        <MaterialCommunityIcons name="database" size={isAndroid ? 20 : 24} color="#FFD700" />
                        <Text variant={isAndroid ? "headlineSmall" : "headlineMedium"} style={styles.balanceText}>{balance}</Text>
                        <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }, isAndroid && { fontSize: 10 }]}>Tokens Available</Text>
                    </View>
                    <IconButton icon="chevron-right" onPress={onViewAnalytics} />
                </View>

                {onPurchase && (
                    <Button
                        mode="contained"
                        onPress={onPurchase}
                        style={styles.button}
                        icon="plus-circle"
                        compact={isAndroid}
                    >
                        Purchase Tokens
                    </Button>
                )}

                <View style={[styles.statsRow, { borderTopColor: theme.colors.outlineVariant }]}>
                    <Text variant="labelSmall" style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
                        Total purchased: <Text style={{ fontWeight: 'bold' }}>{totalPurchased}</Text>
                    </Text>
                    <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
                    <Text variant="labelSmall" style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
                        Total used: <Text style={{ fontWeight: 'bold' }}>{totalUsed}</Text>
                    </Text>
                </View>
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        margin: isAndroid ? 12 : 16,
        elevation: 4,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    balanceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    balanceText: {
        fontWeight: 'bold',
        marginLeft: 8,
        marginRight: 4,
    },
    label: {
        // color: '#666', -- Handled inline
    },
    button: {
        marginBottom: 16,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderTopWidth: 1,
        // borderTopColor: '#f0f0f0', -- Handled inline
        paddingTop: 12,
    },
    statText: {
        // color: '#888', -- Handled inline
    },
    divider: {
        width: 1,
        height: 12,
        // backgroundColor: '#ddd', -- Handled inline
        marginHorizontal: 12,
    }
});
