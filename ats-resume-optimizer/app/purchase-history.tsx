import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, useTheme, ActivityIndicator, Divider } from 'react-native-paper';
import { format } from 'date-fns';
import { useProfileStore } from '../src/store/profileStore';
import { activityService } from '../src/services/firebase/activityService';
import { UserActivity } from '../src/types/profile.types';

// Transaction Type for Display
interface Transaction {
    id: string;
    date: Date;
    amount: number;
    tokens: number;
    status: 'succeeded' | 'pending' | 'failed';
    type: 'purchase' | 'bonus' | 'adjustment';
}

export default function PurchaseHistoryScreen() {
    const theme = useTheme();
    const { userProfile } = useProfileStore();
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const activities = await activityService.getPurchaseHistory();

                const mappedTransactions: Transaction[] = activities.map(act => ({
                    id: act.activityId,
                    date: act.timestamp,
                    // Fallback to data in context, or implicit 0 for legacy records
                    amount: act.contextData?.amount || 0,
                    tokens: act.contextData?.tokens || 0,
                    status: act.status === 'completed' ? 'succeeded' : act.status as any,
                    type: act.description.toLowerCase().includes('bonus') ? 'bonus' : 'purchase'
                }));

                // If user just joined and has no purchase types but has a balance, 
                // we might want to show the Welcome Bonus if we can infer it, 
                // but strictly speaking we only show what's in the log.
                // The Welcome Bonus is likely created as an activity during account creation or just set as initial state.
                // Looking at userService, it sets `tokenBalance: 50`. It DOES NOT log an activity for welcome bonus.
                // So "Welcome Bonus" might be missing if we only query activities. 
                // We should manually inject it if we want to be thorough, but the user complained about "Purchase History".
                // I will stick to actual logs first.

                setTransactions(mappedTransactions);
            } catch (error) {
                console.error("Failed to load purchase history:", error);
            } finally {
                setLoading(false);
            }
        };

        if (userProfile) {
            fetchHistory();
        }
    }, [userProfile]);

    const renderItem = ({ item }: { item: Transaction }) => (
        <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
                <View>
                    <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>
                        {item.type === 'bonus' ? 'Welcome Bonus' : `${item.tokens} Tokens`}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                        {format(item.date, 'MMM d, yyyy h:mm a')}
                    </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text variant="bodyMedium" style={{ fontWeight: 'bold', color: item.amount > 0 ? theme.colors.primary : theme.colors.tertiary }}>
                        {item.amount > 0 ? `$${item.amount.toFixed(2)}` : 'FREE'}
                    </Text>
                    <Text variant="labelSmall" style={{ color: item.status === 'succeeded' ? '#4CAF50' : '#F44336' }}>
                        {item.status.toUpperCase()}
                    </Text>
                </View>
            </Card.Content>
        </Card>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" />
                </View>
            ) : (
                <FlatList
                    data={transactions}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Text>No purchase history found.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    list: {
        padding: 16,
    },
    card: {
        marginBottom: 12,
        elevation: 1
    },
    cardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    }
});
