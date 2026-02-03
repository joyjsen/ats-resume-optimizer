import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Alert, TouchableOpacity, Linking, TextInput } from 'react-native';
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
    const [deletionReason, setDeletionReason] = useState('');
    const [otherReason, setOtherReason] = useState('');
    const [showReasonStep, setShowReasonStep] = useState(true);

    const deletionReasons = [
        "Found a job",
        "Too expensive",
        "Didn't meet expectations",
        "Technical issues",
        "Don't need it anymore",
        "Other"
    ];

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
        const finalReason = deletionReason === 'Other' ? `Other: ${otherReason}` : deletionReason;

        if (!finalReason) {
            Alert.alert("Reason Required", "Please select a reason for deleting your account.");
            return;
        }

        setLoading(true);
        try {
            if (userProfile?.uid) {
                // Archive data first
                await userService.archiveAndSoftDelete(userProfile.uid, finalReason);
                // Then delete from Auth
                await authService.deleteUser();
            }
            setDeleteDialogVisible(false);
            setUserProfile(null);
            router.replace('/(auth)/sign-in' as any);
        } catch (error: any) {
            console.error("Deletion error:", error);
            const errorCode = error.code || '';
            const errorMessage = error.message || '';

            // Check for requires-recent-login in multiple ways (Firebase can return it differently)
            if (errorCode.includes('requires-recent-login') ||
                errorCode.includes('user-token-expired') ||
                errorMessage.includes('requires-recent-login') ||
                errorMessage.includes('user-token-expired')) {
                Alert.alert(
                    "Security Check Required",
                    "For your security, Firebase requires a recent login to delete your account.\n\nPlease log out, log back in, and try again immediately.",
                    [{ text: "OK" }]
                );
            } else if (errorMessage.includes('permission') || errorCode === 'permission-denied') {
                Alert.alert("Permission Error", "Firestore rules may need to be deployed. Please contact support.");
            } else {
                Alert.alert("Error", `Failed to delete account: ${errorMessage || 'Unknown error'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGiveFeedback = () => {
        const email = 'pjmarket1316@gmail.com';
        const userName = userProfile?.displayName || 'User';
        const subject = `RiResume App Feedback - ${userName}`;
        const body = `Dear RiResume Team,\n\nI would like to share my experience and feedback regarding the RiResume application.\n\n[Please enter your feedback here]\n\nSincerely,\n${userName}\n\n---\nUser Information:\n- Email: ${userProfile?.email}\n- User ID: ${userProfile?.uid}`;

        Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
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
                    title="Give Feedback"
                    description="Help us improve RiResume"
                    left={props => <List.Icon {...props} icon="message-draw" />}
                    onPress={handleGiveFeedback}
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
                <Dialog visible={deleteDialogVisible} onDismiss={() => {
                    setDeleteDialogVisible(false);
                    setShowReasonStep(true);
                }}>
                    <Dialog.Title>{showReasonStep ? "Why are you leaving?" : "Archive & Delete Account?"}</Dialog.Title>
                    <Dialog.Content>
                        {showReasonStep ? (
                            <View>
                                <Text variant="bodySmall" style={{ marginBottom: 12, color: theme.colors.onSurfaceVariant }}>
                                    We're sorry to see you go. Please let us know why you're deleting your account.
                                </Text>
                                {deletionReasons.map((reason) => (
                                    <TouchableOpacity
                                        key={reason}
                                        style={styles.reasonOption}
                                        onPress={() => setDeletionReason(reason)}
                                    >
                                        <View style={[
                                            styles.radioButton,
                                            { borderColor: deletionReason === reason ? theme.colors.primary : theme.colors.outline }
                                        ]}>
                                            {deletionReason === reason && <View style={[styles.radioButtonInner, { backgroundColor: theme.colors.primary }]} />}
                                        </View>
                                        <Text variant="bodyMedium">{reason}</Text>
                                    </TouchableOpacity>
                                ))}
                                {deletionReason === 'Other' && (
                                    <TextInput
                                        style={[styles.textInput, { borderColor: theme.colors.outline, color: theme.colors.onSurface }]}
                                        placeholder="Please specify..."
                                        placeholderTextColor={theme.colors.onSurfaceVariant}
                                        value={otherReason}
                                        onChangeText={setOtherReason}
                                        multiline
                                    />
                                )}
                            </View>
                        ) : (
                            <View>
                                <Text variant="bodyMedium">
                                    This action is permanent and will delete all your active data. Your profile and history will be archived for administrative review.
                                </Text>
                                <View style={styles.tokenWarning}>
                                    <MaterialCommunityIcons name="alert" size={20} color={theme.colors.error} />
                                    <Text variant="bodyMedium" style={{ marginLeft: 8, color: theme.colors.error, fontWeight: 'bold' }}>
                                        Remaining Balance: {userProfile.tokenBalance} tokens
                                    </Text>
                                </View>
                            </View>
                        )}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => {
                            setDeleteDialogVisible(false);
                            setShowReasonStep(true);
                        }}>Cancel</Button>
                        {showReasonStep ? (
                            <Button
                                disabled={!deletionReason || (deletionReason === 'Other' && !otherReason)}
                                onPress={() => setShowReasonStep(false)}
                            >
                                Next
                            </Button>
                        ) : (
                            <Button
                                onPress={handleDeleteAccount}
                                textColor={theme.colors.error}
                                loading={loading}
                            >
                                Confirm Delete
                            </Button>
                        )}
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
    },
    reasonOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    radioButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioButtonInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    textInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
        height: 80,
        textAlignVertical: 'top',
    },
    tokenWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        padding: 12,
        backgroundColor: 'rgba(186, 26, 26, 0.1)',
        borderRadius: 8,
    }
});
