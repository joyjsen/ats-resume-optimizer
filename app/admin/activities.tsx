import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, ActivityIndicator, Chip, useTheme } from 'react-native-paper';
import { activityService } from '../../src/services/firebase/activityService';
import { UserActivity } from '../../src/types/profile.types';
import { format } from 'date-fns';

export default function ActivitiesConsole() {
    const theme = useTheme();
    const [activities, setActivities] = useState<UserActivity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadActivities();
    }, []);

    const loadActivities = async () => {
        setLoading(true);
        try {
            const data = await activityService.getAllActivities(100);
            setActivities(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'generate_cover_letter': return '#4CAF50';
            case 'generate_prep_guide': return '#2196F3';
            case 'analyze_resume': return '#FF9800';
            case 'optimize_resume': return '#9C27B0';
            default: return '#757575';
        }
    };

    return (
        <View style={styles.container}>
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" />
                </View>
            ) : (
                <FlatList
                    data={activities}
                    keyExtractor={(item) => item.activityId}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => (
                        <Card style={styles.card}>
                            <Card.Content>
                                <View style={styles.row}>
                                    <View style={{ flex: 1 }}>
                                        <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>
                                            {item.description}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: '#666', marginTop: 4 }}>
                                            User ID: {item.uid}
                                        </Text>
                                        <View style={{ flexDirection: 'row', marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
                                            <Chip
                                                textStyle={{ fontSize: 10, height: 12, lineHeight: 12 }}
                                                style={{ height: 24, backgroundColor: getTypeColor(item.type) + '20' }}
                                            >
                                                {item.type}
                                            </Chip>
                                            {item.tokensUsed > 0 && (
                                                <Chip icon="fire" textStyle={{ fontSize: 10 }} style={{ height: 24, backgroundColor: '#ffebee' }}>
                                                    {item.tokensUsed} tokens
                                                </Chip>
                                            )}
                                        </View>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text variant="labelSmall" style={{ color: '#888' }}>
                                            {format(item.timestamp, 'MMM d')}
                                        </Text>
                                        <Text variant="labelSmall" style={{ color: '#888' }}>
                                            {format(item.timestamp, 'HH:mm')}
                                        </Text>
                                    </View>
                                </View>
                            </Card.Content>
                        </Card>
                    )}
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Text>No activity records found.</Text>
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
        backgroundColor: '#f5f5f5',
    },
    list: {
        padding: 16,
    },
    card: {
        marginBottom: 8,
        backgroundColor: 'white',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    }
});
