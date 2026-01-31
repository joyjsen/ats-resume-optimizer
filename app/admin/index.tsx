import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, useTheme, Button, ActivityIndicator, List, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { userService } from '../../src/services/firebase/userService';
import { activityService } from '../../src/services/firebase/activityService';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function AdminHomeScreen() {
    const theme = useTheme();
    const router = useRouter();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoading(true);
        try {
            const platformStats = await userService.getPlatformStats();
            setStats(platformStats);
        } catch (error) {
            console.error("Failed to load admin stats:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <View style={styles.centered}><ActivityIndicator size="large" /></View>;

    if (!stats) {
        return (
            <View style={styles.centered}>
                <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#F44336" />
                <Text variant="bodyLarge" style={{ marginTop: 16, textAlign: 'center' }}>Failed to load admin stats.</Text>
                <Button mode="contained" onPress={loadStats} style={{ marginTop: 16 }}>Retry</Button>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text variant="headlineMedium" style={styles.title}>Admin Dashboard</Text>
                <Text variant="bodySmall">Overview of platform performance and users.</Text>
            </View>

            <View style={styles.statsGrid}>
                <StatCard label="Total Users" value={stats.totalUsers ?? 0} icon="account-group" color="#2196F3" />
                <StatCard label="Active (30d)" value={stats.activeUsers30d ?? 0} icon="account-check" color="#4CAF50" />
                <StatCard label="Tokens Used" value={stats.totalTokensUsed ?? 0} icon="database-minus" color="#F44336" />
                <StatCard label="Utilization" value={`${((stats.tokenUtilizationRate ?? 0) * 100).toFixed(1)}%`} icon="chart-pie" color="#9C27B0" />
            </View>

            <List.Section>
                <List.Subheader>Management</List.Subheader>
                <List.Item
                    title="User Management"
                    description="View, search and manage user accounts"
                    left={props => <List.Icon {...props} icon="account-cog" />}
                    right={props => <List.Icon {...props} icon="chevron-right" />}
                    onPress={() => router.push('/admin/users' as any)}
                />
                <Divider />
                <List.Item
                    title="Platform Analytics"
                    description="User activities and token usage"
                    left={props => <List.Icon {...props} icon="chart-bar" />}
                    right={props => <List.Icon {...props} icon="chevron-right" />}
                    onPress={() => router.push('/admin/analytics' as any)}
                />
            </List.Section>
        </ScrollView>
    );
}

const StatCard = ({ label, value, icon, color }: any) => (
    <Card style={styles.statCard}>
        <Card.Content style={{ alignItems: 'center' }}>
            <MaterialCommunityIcons name={icon} size={28} color={color} />
            <Text variant="headlineSmall" style={{ fontWeight: 'bold', marginVertical: 4 }}>{value}</Text>
            <Text variant="labelSmall" style={{ color: '#666' }}>{label}</Text>
        </Card.Content>
    </Card>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        padding: 24,
    },
    title: {
        fontWeight: 'bold',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 8,
    },
    statCard: {
        width: '45%',
        margin: '2.5%',
        backgroundColor: '#fff',
    }
});
