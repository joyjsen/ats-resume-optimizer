import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Alert, TouchableOpacity } from 'react-native';
import { Text, Divider, List, Switch, Button, useTheme, Portal, Dialog, ActivityIndicator } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { ProfileHeader } from '../../src/components/profile/ProfileHeader';
import { TokenCard } from '../../src/components/profile/TokenCard';
import { QuickStats } from '../../src/components/profile/QuickStats';
import { ActivityTimeline } from '../../src/components/profile/ActivityTimeline';
import { useProfileStore } from '../../src/store/profileStore';
import { useAppTheme } from '../../src/context/ThemeContext';
import { authService } from '../../src/services/firebase/authService';
import { userService } from '../../src/services/firebase/userService';
import { auth } from '../../src/services/firebase/config';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ProfileScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { isDark, toggleTheme } = useAppTheme();
    const {
        userProfile,
        activities,
        userStats,
        fetchActivities,
        fetchUserStats,
        refreshProfile,
        setUserProfile,
        subscribeToProfile
    } = useProfileStore();
    const [loading, setLoading] = useState(false);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

    // Initial Data Fetch & Subscription
    useEffect(() => {
        if (userProfile?.uid) {
            // Subscribe to real-time profile updates (tokens, etc.)
            const unsubscribe = subscribeToProfile(userProfile.uid);

            // Fetch other data
            fetchActivities();
            fetchUserStats();

            return () => unsubscribe();
        }
    }, [userProfile?.uid]);

    useFocusEffect(
        React.useCallback(() => {
            if (userProfile) {
                // Refresh activities/stats on focus in case they changed elsewhere
                fetchActivities();
                fetchUserStats();

                // Auto-migrate anonymous data if this is the admin
                if (userProfile.role === 'admin') {
                    const triggerMigration = async () => {
                        const { migrationService } = require('../../src/services/firebase/migrationService');
                        const result = await migrationService.migrateAnonymousData();
                        if (result.success && result.count > 0) {
                            console.log(`Successfully migrated ${result.count} anonymous records.`);
                            // Alert.alert("Data Sync", `Associated ${result.count} previous activities with your admin account.`);
                            // Refresh data to show migrated items
                            fetchActivities();
                            fetchUserStats();
                            refreshProfile();
                        }
                    };
                    triggerMigration();
                }
            }
        }, [userProfile?.uid])
    );

    const handleLogout = async () => {
        try {
            await authService.logout();
            setUserProfile(null);
            router.replace('/(auth)/sign-in' as any);
        } catch (error) {
            Alert.alert("Error", "Failed to logout.");
        }
    };

    const handleDeleteAccount = async () => {
        setLoading(true);
        try {
            if (userProfile?.uid) {
                await userService.deleteAccount(userProfile.uid);
                await authService.deleteUser();
            }
            setDeleteDialogVisible(false);
            setUserProfile(null);
            router.replace('/(auth)/sign-in' as any);
        } catch (error: any) {
            if (error.code === 'auth/requires-recent-login' || error.code === 'auth/user-token-expired') {
                Alert.alert("Security Check", "Please log out and log in again to delete your account.");
            } else {
                Alert.alert("Error", "Failed to delete account. You may need to re-login.");
            }
        } finally {
            setLoading(false);
        }
    };


    const toggleNotification = async (type: 'push' | 'email') => {
        if (!userProfile) return;
        const updates = type === 'push'
            ? { notificationsEnabled: !userProfile.notificationsEnabled }
            : { emailNotifications: !userProfile.emailNotifications };

        try {
            await userService.updateProfile(userProfile.uid, updates);
            await refreshProfile();
        } catch (error) {
            Alert.alert("Error", "Failed to update settings.");
        }
    };

    if (!userProfile) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <ProfileHeader
                profile={userProfile}
                onEdit={() => router.push('/profile/edit')}
            />

            <TokenCard
                balance={userProfile.tokenBalance}
                totalPurchased={userProfile.totalTokensPurchased}
                totalUsed={userProfile.totalTokensUsed}
                onViewAnalytics={() => router.push('/analytics' as any)}
            />

            <QuickStats
                stats={userStats}
                activities={activities}
                onStatPress={(type) => router.push({ pathname: '/history-details', params: { filter: type } } as any)}
            />

            <ActivityTimeline
                activities={activities.slice(0, 5)}
                onViewAll={() => router.push('/user-activity' as any)}
            />

            <List.Section title="Settings">
                <List.Item
                    title="Push Notifications"
                    left={props => <List.Icon {...props} icon="bell-outline" />}
                    right={() => (
                        <Switch
                            value={userProfile.notificationsEnabled}
                            onValueChange={() => toggleNotification('push')}
                        />
                    )}
                />
                <List.Item
                    title="Email Notifications"
                    left={props => <List.Icon {...props} icon="email-outline" />}
                    right={() => (
                        <Switch
                            value={userProfile.emailNotifications}
                            onValueChange={() => toggleNotification('email')}
                        />
                    )}
                />
                <List.Item
                    title="Appearance"
                    description={isDark ? "Dark Mode" : "Light Mode"}
                    left={props => <List.Icon {...props} icon="theme-light-dark" />}
                    right={() => (
                        <Switch
                            value={isDark}
                            onValueChange={toggleTheme}
                        />
                    )}
                />
            </List.Section>

            {userProfile.role === 'admin' && (
                <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                    <Button
                        mode="outlined"
                        icon="sync"
                        loading={loading}
                        onPress={async () => {
                            setLoading(true);
                            const { migrationService } = require('../../src/services/firebase/migrationService');
                            try {
                                const result = await migrationService.migrateAnonymousData();
                                if (result.success) {
                                    if (result.count > 0) {
                                        Alert.alert("Success", `Migrated ${result.count} items to your account.`);
                                        await refreshProfile();
                                        await fetchUserStats();
                                        await fetchActivities();
                                    } else {
                                        Alert.alert("Info", "No anonymous data found to migrate.");
                                    }
                                } else {
                                    Alert.alert("Error", "Migration failed. Please check console.");
                                }
                            } catch (e) {
                                Alert.alert("Error", "Failed to sync data.");
                            } finally {
                                setLoading(false);
                            }
                        }}
                    >
                        Sync Previous Work
                    </Button>
                </View>
            )}

            <Divider />

            <List.Section title="Payment & Billing">
                <List.Item
                    title="Purchase History"
                    left={props => <List.Icon {...props} icon="history" />}
                    onPress={() => router.push('/purchase-history' as any)}
                />
                <List.Item
                    title="Manage Payment Methods"
                    left={props => <List.Icon {...props} icon="credit-card-outline" />}
                    onPress={() => Alert.alert("Payments", "Stripe management coming soon.")}
                />
            </List.Section>

            <Divider />

            <List.Section title="Support & Legal">
                <List.Item
                    title="Help & Support"
                    left={props => <List.Icon {...props} icon="help-circle-outline" />}
                    onPress={() => router.push('/settings/help' as any)}
                />
                <List.Item
                    title="Terms of Service"
                    left={props => <List.Icon {...props} icon="file-document-outline" />}
                    onPress={() => router.push('/settings/terms' as any)}
                />
                <List.Item
                    title="Privacy Policy"
                    left={props => <List.Icon {...props} icon="shield-check-outline" />}
                    onPress={() => router.push('/settings/privacy' as any)}
                />
                <List.Item
                    title="About this app"
                    description="Version 1.0.0"
                    left={props => <List.Icon {...props} icon="information-outline" />}
                    onPress={() => router.push('/settings/about' as any)}
                />
            </List.Section>

            <Divider />

            <View style={styles.actions}>
                <Button
                    mode="outlined"
                    onPress={handleLogout}
                    style={styles.actionButton}
                    icon="logout"
                >
                    Logout
                </Button>
                <Button
                    mode="text"
                    onPress={() => setDeleteDialogVisible(true)}
                    textColor={theme.colors.error}
                    style={styles.actionButton}
                >
                    Delete Account
                </Button>
            </View>

            {userProfile.role === 'admin' && (
                <View style={styles.adminSection}>
                    <Button
                        mode="contained"
                        onPress={() => router.push('/admin' as any)}
                        style={styles.adminButton}
                        buttonColor={theme.colors.tertiary}
                    >
                        Admin Dashboard
                    </Button>
                </View>
            )}

            <View style={{ height: 40 }} />

            <Portal>
                <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)}>
                    <Dialog.Title>Delete Account?</Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyMedium">
                            This action is permanent and will delete all your data, including your token balance and saved resumes.
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setDeleteDialogVisible(false)}>Cancel</Button>
                        <Button onPress={handleDeleteAccount} textColor={theme.colors.error}>Delete</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actions: {
        padding: 16,
    },
    actionButton: {
        marginVertical: 4,
    },
    adminSection: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    adminButton: {
        borderRadius: 8,
    }
});
