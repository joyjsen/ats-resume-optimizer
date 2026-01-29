import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, useTheme, Button, ActivityIndicator, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useProfileStore } from '../../src/store/profileStore';
import { userService } from '../../src/services/firebase/userService';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function AdminDashboard() {
    const theme = useTheme();
    const router = useRouter();
    const { userProfile } = useProfileStore();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userProfile && userProfile.role !== 'admin') {
            router.replace('/(tabs)/');
            return;
        }

        loadStats();
    }, [userProfile]);

    const loadStats = async () => {
        setLoading(true);
        try {
            const data = await userService.getPlatformStats();
            setStats(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };


    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text variant="headlineMedium" style={styles.title}>Admin Dashboard</Text>
                <Button mode="outlined" onPress={loadStats} icon="refresh">Refresh</Button>
            </View>

            <View style={styles.grid}>
                <MetricCard
                    label="Total Users"
                    value={stats?.totalUsers || 0}
                    icon="account-group"
                    color={theme.colors.primary}
                />
                <MetricCard
                    label="Active (30d)"
                    value={stats?.activeUsers30d || 0}
                    icon="account-check"
                    color="#4CAF50"
                />
                <MetricCard
                    label="Tokens Distributed"
                    value={stats?.totalTokensDistributed || 0}
                    icon="bitcoin"
                    color="#FFC107"
                />
                <MetricCard
                    label="Tokens Used"
                    value={stats?.totalTokensUsed || 0}
                    icon="fire"
                    color="#F44336"
                />
            </View>

            <View style={styles.section}>
                <Text variant="titleLarge" style={styles.sectionTitle}>Management</Text>

                <Card style={styles.actionCard} onPress={() => router.push('/admin/users')}>
                    <Card.Title
                        title="User Management"
                        subtitle="View users, grant tokens, suspend accounts"
                        left={(props) => <MaterialCommunityIcons name="account-cog" size={24} color={theme.colors.primary} />}
                        right={(props) => <IconButton icon="chevron-right" {...props} />}
                    />
                </Card>


                <Card style={styles.actionCard} onPress={() => router.push('/admin/activities')}>
                    <Card.Title
                        title="Activity Console"
                        subtitle="Centralized view of all user activities"
                        left={(props) => <MaterialCommunityIcons name="pulse" size={24} color={theme.colors.secondary} />}
                        right={(props) => <IconButton icon="chevron-right" {...props} />}
                    />
                </Card>

                <Card style={styles.actionCard} onPress={() => { }}>
                    <Card.Title
                        title="System Logs"
                        subtitle="View error logs and system events (Coming Soon)"
                        left={(props) => <MaterialCommunityIcons name="file-document-outline" size={24} color="#666" />}
                        right={(props) => <IconButton icon="chevron-right" {...props} />}
                    />
                </Card>
            </View>
        </ScrollView>
    );
}

const MetricCard = ({ label, value, icon, color }: any) => (
    <Card style={styles.card}>
        <Card.Content style={styles.cardContent}>
            <MaterialCommunityIcons name={icon} size={32} color={color} style={{ marginBottom: 8 }} />
            <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>{value}</Text>
            <Text variant="bodySmall" style={{ color: '#666' }}>{label}</Text>
        </Card.Content>
    </Card>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    title: {
        fontWeight: 'bold',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 8,
    },
    card: {
        width: '46%', // approximate for 2 columns with margin
        margin: '2%',
        elevation: 2,
    },
    cardContent: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    section: {
        padding: 16,
    },
    sectionTitle: {
        fontWeight: 'bold',
        marginBottom: 12,
    },
    actionCard: {
        marginBottom: 12,
        backgroundColor: '#fff',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
