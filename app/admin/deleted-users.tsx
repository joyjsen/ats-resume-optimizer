import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, ScrollView, Pressable, Dimensions } from 'react-native';
import { Text, Searchbar, List, Avatar, Chip, useTheme, ActivityIndicator, Button, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { collection, getDocs, doc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../src/services/firebase/config';
import { activityService } from '../../src/services/firebase/activityService';
import { userService } from '../../src/services/firebase/userService';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';

interface DeletedAccount {
    uid: string;
    email: string;
    displayName: string;
    provider: string;
    createdAt: Date;
    deletedAt: Date;
    reason: string;
    totalSpent: number;
    historyCount: number;
    tokenBalanceAtDeletion: number;
    fullProfile?: any;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function DeletedUsersScreen() {
    const theme = useTheme();
    const router = useRouter();
    const [deletedAccounts, setDeletedAccounts] = useState<DeletedAccount[]>([]);
    const [filteredAccounts, setFilteredAccounts] = useState<DeletedAccount[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedAccount, setSelectedAccount] = useState<DeletedAccount | null>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadDeletedAccounts();
    }, []);

    const loadDeletedAccounts = async () => {
        setLoading(true);
        try {
            console.log('[DeletedUsers] Loading deleted accounts...');
            const snapshot = await getDocs(collection(db, 'deleted_accounts'));
            console.log('[DeletedUsers] Found', snapshot.docs.length, 'deleted accounts');

            const accounts: DeletedAccount[] = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    uid: docSnap.id,
                    email: data.email || '',
                    displayName: data.displayName || data.fullProfile?.displayName || 'Unknown',
                    provider: data.provider || 'unknown',
                    createdAt: data.createdAt?.toDate?.() || new Date(),
                    deletedAt: data.deletedAt?.toDate?.() || new Date(),
                    reason: data.reason || 'No reason provided',
                    totalSpent: data.totalSpent || 0,
                    historyCount: data.historyCount || 0,
                    tokenBalanceAtDeletion: data.tokenBalanceAtDeletion || 0,
                    fullProfile: data.fullProfile,
                };
            });

            accounts.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
            setDeletedAccounts(accounts);
            setFilteredAccounts(accounts);
        } catch (error) {
            console.error('Error loading deleted accounts:', error);
            Alert.alert('Error', 'Failed to load deleted accounts. Check permissions.');
        } finally {
            setLoading(false);
        }
    };

    const onChangeSearch = (query: string) => {
        setSearchQuery(query);
        const lower = query.toLowerCase();
        const filtered = deletedAccounts.filter(a =>
            a.displayName.toLowerCase().includes(lower) ||
            a.email.toLowerCase().includes(lower) ||
            a.uid.includes(lower) ||
            a.reason.toLowerCase().includes(lower)
        );
        setFilteredAccounts(filtered);
    };

    const handleSelectAccount = async (account: DeletedAccount) => {
        setSelectedAccount(account);
        setLoadingActivities(true);
        try {
            const userActivities = await activityService.getUserActivitiesAdmin(account.uid, 50);
            setActivities(userActivities);
        } catch (error) {
            console.error('Error loading activities:', error);
            setActivities([]);
        } finally {
            setLoadingActivities(false);
        }
    };

    const handleRestoreAccount = async (account: DeletedAccount) => {
        Alert.alert(
            "Restore Account",
            `Are you sure you want to restore ${account.displayName}'s account?\n\nThis will:\n• Restore their profile\n• Preserve their ${account.tokenBalanceAtDeletion} token balance\n• Skip onboarding for them`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Restore",
                    onPress: async () => {
                        setRestoring(true);
                        try {
                            await userService.restoreDeletedAccount(account.uid);

                            // Ensure Auth account exists (it might have been deleted from Firebase Auth console)
                            try {
                                const functions = getFunctions();
                                const restoreAuth = httpsCallable(functions, 'restoreUserAuth');
                                const authResult = await restoreAuth({
                                    uid: account.uid,
                                    email: account.email,
                                    displayName: account.displayName,
                                    provider: account.provider
                                });

                                const res = authResult.data as any;
                                console.log('[Restore] Auth restoration result:', res);

                                if (res.success === false) {
                                    if (res.error === 'EMAIL_EXISTS_DIFFERENT_UID') {
                                        Alert.alert(
                                            "Auth Conflict",
                                            `Firestore restoration worked, but ${res.message}\n\nYou must delete the new account in Firebase Auth console before this one can be fully restored.`
                                        );
                                    } else {
                                        Alert.alert("Auth Error", res.message || "Failed to fully restore Auth account.");
                                    }
                                } else if (res.recreated) {
                                    console.log("[Restore] Auth account was recreated.");
                                }
                            } catch (authError: any) {
                                console.warn('Failed to ensure Auth account exists:', authError);
                                Alert.alert("Auth Warning", "Firestore record restored, but Auth restoration failed. The user might not be able to log in yet.");
                            }

                            // Send restoration email
                            try {
                                const functions = getFunctions();
                                const sendEmail = httpsCallable(functions, 'sendAccountStatusEmail');
                                await sendEmail({
                                    userId: account.uid,
                                    action: 'reactivated',
                                    email: account.email,
                                    displayName: account.displayName,
                                });
                            } catch (e) {
                                console.warn('Failed to send reactivation email:', e);
                            }

                            Alert.alert("Success", `${account.displayName}'s account has been restored successfully.`);
                            setSelectedAccount(null);
                            loadDeletedAccounts();
                        } catch (error: any) {
                            console.error('Error restoring account:', error);
                            Alert.alert("Error", error.message || "Failed to restore account.");
                        } finally {
                            setRestoring(false);
                        }
                    }
                }
            ]
        );
    };

    const handlePermanentDelete = async (account: DeletedAccount) => {
        Alert.alert(
            "⚠️ Permanent Deletion",
            `This will PERMANENTLY delete ${account.displayName}'s data.\n\nA minimal audit trail will be kept:\n• Name & Email\n• Phone (if available)\n• Purchase history\n\nContinue?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete Permanently",
                    style: "destructive",
                    onPress: async () => {
                        setDeleting(true);
                        try {
                            const profile = account.fullProfile || {};

                            // Create audit trail
                            const auditTrail = {
                                uid: account.uid,
                                displayName: account.displayName,
                                email: account.email,
                                phoneNumber: profile.phoneNumber || null,
                                totalSpent: account.totalSpent || 0,
                                totalTokensPurchased: profile.totalTokensPurchased || 0,
                                tokenBalanceAtDeletion: account.tokenBalanceAtDeletion || 0,
                                accountCreatedAt: account.createdAt,
                                accountDeletedAt: account.deletedAt,
                                permanentlyDeletedAt: serverTimestamp(),
                                deletionReason: account.reason,
                            };

                            await setDoc(doc(db, 'audit_trail', account.uid), auditTrail);

                            // Delete activities
                            try {
                                await activityService.deleteAllUserActivities(account.uid);
                            } catch (e) {
                                console.warn('Failed to delete activities:', e);
                            }

                            // Delete from users collection
                            try {
                                await deleteDoc(doc(db, 'users', account.uid));
                            } catch (e) {
                                console.warn('Failed to delete user doc:', e);
                            }

                            // Delete from deleted_accounts
                            await deleteDoc(doc(db, 'deleted_accounts', account.uid));

                            // Delete from Firebase Auth
                            try {
                                const functions = getFunctions();
                                const deleteAuth = httpsCallable(functions, 'deleteUserAuth');
                                const authResult = await deleteAuth({ uid: account.uid });
                                console.log('[Delete] Auth deletion result:', authResult.data);
                            } catch (authError) {
                                console.warn('Failed to delete Auth account (it might already be gone):', authError);
                            }

                            // Send final email
                            try {
                                const functions = getFunctions();
                                const sendEmail = httpsCallable(functions, 'sendAccountStatusEmail');
                                await sendEmail({
                                    userId: account.uid,
                                    action: 'permanent_delete',
                                    email: account.email,
                                    displayName: account.displayName,
                                });
                            } catch (e) {
                                console.warn('Failed to send final email:', e);
                            }

                            Alert.alert("Success", `${account.displayName}'s data has been permanently deleted. An audit trail has been preserved.`);
                            setSelectedAccount(null);
                            loadDeletedAccounts();
                        } catch (error: any) {
                            console.error('Permanent delete error:', error);
                            Alert.alert("Error", error.message || "Failed to permanently delete account.");
                        } finally {
                            setDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    const formatDate = (date: Date) => {
        try {
            return format(date, 'MMM d, yyyy \'at\' h:mm a');
        } catch {
            return 'Unknown date';
        }
    };

    const renderItem = ({ item }: { item: DeletedAccount }) => (
        <TouchableOpacity onPress={() => handleSelectAccount(item)}>
            <List.Item
                title={item.displayName}
                description={`${item.email}\nDeleted: ${formatDate(item.deletedAt)}`}
                descriptionNumberOfLines={2}
                left={props => (
                    <View style={styles.avatarContainer}>
                        <Avatar.Icon {...props} icon="account-remove" style={{ backgroundColor: '#ffebee' }} color="#D32F2F" />
                    </View>
                )}
                right={props => (
                    <View style={styles.rightContent}>
                        <Chip
                            style={styles.tokenChip}
                            textStyle={{ fontSize: 12, color: '#333', fontWeight: '600' }}
                        >
                            {item.tokenBalanceAtDeletion} 🪙
                        </Chip>
                        <Chip
                            style={styles.deletedChip}
                            textStyle={{ fontSize: 11, color: '#D32F2F', fontWeight: 'bold' }}
                        >
                            DELETED
                        </Chip>
                    </View>
                )}
                style={styles.listItem}
            />
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
                <Text style={{ marginTop: 16 }}>Loading deleted accounts...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text variant="headlineSmall" style={styles.title}>Deleted Accounts</Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                    {deletedAccounts.length} archived account{deletedAccounts.length !== 1 ? 's' : ''}
                </Text>
            </View>

            {/* Search */}
            <Searchbar
                placeholder="Search by name, email, or reason..."
                onChangeText={onChangeSearch}
                value={searchQuery}
                style={styles.searchbar}
            />

            {/* List */}
            <FlatList
                data={filteredAccounts}
                keyExtractor={(item) => item.uid}
                renderItem={renderItem}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="account-check" size={64} color="#4CAF50" />
                        <Text variant="titleMedium" style={{ marginTop: 16 }}>No Deleted Accounts</Text>
                        <Text variant="bodyMedium" style={{ color: '#666' }}>
                            All users are active and healthy!
                        </Text>
                    </View>
                }
                contentContainerStyle={{ paddingBottom: 20 }}
            />

            {/* Detail Modal */}
            <Modal
                visible={!!selectedAccount}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setSelectedAccount(null)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalBackdrop}
                        activeOpacity={1}
                        onPress={() => setSelectedAccount(null)}
                    />
                    <View style={styles.modalContent}>
                        {selectedAccount && (
                            <ScrollView
                                showsVerticalScrollIndicator={true}
                                bounces={true}
                                contentContainerStyle={{ paddingBottom: 40 }}
                            >
                                {/* Modal Header */}
                                <View style={styles.modalHeader}>
                                    <Avatar.Icon
                                        size={56}
                                        icon="account-remove"
                                        style={{ backgroundColor: '#ffebee' }}
                                        color="#D32F2F"
                                    />
                                    <View style={styles.modalHeaderText}>
                                        <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>
                                            {selectedAccount.displayName}
                                        </Text>
                                        <Text variant="bodyMedium" style={{ color: '#666' }}>
                                            {selectedAccount.email}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setSelectedAccount(null)} style={styles.closeButton}>
                                        <MaterialCommunityIcons name="close" size={24} color="#666" />
                                    </TouchableOpacity>
                                </View>

                                <Divider style={{ marginVertical: 16 }} />

                                {/* Deletion Info */}
                                <View style={styles.section}>
                                    <Text variant="titleMedium" style={styles.sectionTitle}>Deletion Details</Text>

                                    <View style={styles.infoRow}>
                                        <MaterialCommunityIcons name="alert-circle" size={20} color="#D32F2F" />
                                        <View style={styles.infoContent}>
                                            <Text variant="labelSmall" style={{ color: '#888' }}>Reason</Text>
                                            <Text variant="bodyMedium">{selectedAccount.reason}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.infoRow}>
                                        <MaterialCommunityIcons name="calendar-remove" size={20} color="#666" />
                                        <View style={styles.infoContent}>
                                            <Text variant="labelSmall" style={{ color: '#888' }}>Deleted On</Text>
                                            <Text variant="bodyMedium">{formatDate(selectedAccount.deletedAt)}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.infoRow}>
                                        <MaterialCommunityIcons name="calendar-plus" size={20} color="#666" />
                                        <View style={styles.infoContent}>
                                            <Text variant="labelSmall" style={{ color: '#888' }}>Account Created</Text>
                                            <Text variant="bodyMedium">{formatDate(selectedAccount.createdAt)}</Text>
                                        </View>
                                    </View>
                                </View>

                                <Divider style={{ marginVertical: 16 }} />

                                {/* Stats */}
                                <View style={styles.section}>
                                    <Text variant="titleMedium" style={styles.sectionTitle}>Account Summary</Text>
                                    <View style={styles.statsRow}>
                                        <View style={styles.statCard}>
                                            <Text variant="headlineSmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                                                ${selectedAccount.totalSpent.toFixed(2)}
                                            </Text>
                                            <Text variant="labelSmall" style={{ color: '#888' }}>Total Spent</Text>
                                        </View>
                                        <View style={styles.statCard}>
                                            <Text variant="headlineSmall" style={{ color: '#FF9800', fontWeight: 'bold' }}>
                                                {selectedAccount.tokenBalanceAtDeletion}
                                            </Text>
                                            <Text variant="labelSmall" style={{ color: '#888' }}>Tokens Left</Text>
                                        </View>
                                        <View style={styles.statCard}>
                                            <Text variant="headlineSmall" style={{ color: '#2196F3', fontWeight: 'bold' }}>
                                                {selectedAccount.historyCount}
                                            </Text>
                                            <Text variant="labelSmall" style={{ color: '#888' }}>Analyses</Text>
                                        </View>
                                    </View>
                                </View>

                                <Divider style={{ marginVertical: 16 }} />

                                {/* Activity History */}
                                <View style={styles.section}>
                                    <Text variant="titleMedium" style={styles.sectionTitle}>Recent Activity</Text>
                                    {loadingActivities ? (
                                        <ActivityIndicator size="small" style={{ marginVertical: 16 }} />
                                    ) : activities.length > 0 ? (
                                        activities.slice(0, 10).map((item, index) => (
                                            <View key={item.id || index} style={styles.activityRow}>
                                                <MaterialCommunityIcons name="history" size={16} color="#888" />
                                                <View style={styles.activityContent}>
                                                    <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                                                        {item.type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                                    </Text>
                                                    <Text variant="bodySmall" style={{ color: '#888' }}>
                                                        {item.description || 'No description'}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))
                                    ) : (
                                        <Text variant="bodyMedium" style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: 16 }}>
                                            No activity history found
                                        </Text>
                                    )}
                                </View>

                                {/* Action Buttons */}
                                <View style={styles.actionButtons}>
                                    <Button
                                        mode="contained"
                                        onPress={() => handleRestoreAccount(selectedAccount)}
                                        style={styles.restoreButton}
                                        icon="account-reactivate"
                                        loading={restoring}
                                        disabled={restoring || deleting}
                                    >
                                        {restoring ? 'Restoring...' : 'Restore Account'}
                                    </Button>

                                    <Button
                                        mode="contained"
                                        onPress={() => handlePermanentDelete(selectedAccount)}
                                        style={styles.deleteButton}
                                        icon="delete-forever"
                                        loading={deleting}
                                        disabled={restoring || deleting}
                                        buttonColor="#D32F2F"
                                    >
                                        {deleting ? 'Deleting...' : 'Delete Permanently'}
                                    </Button>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    title: {
        fontWeight: 'bold',
    },
    subtitle: {
        color: '#888',
        marginTop: 4,
    },
    searchbar: {
        margin: 16,
        elevation: 1,
        backgroundColor: '#fff',
    },
    listItem: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 8,
    },
    avatarContainer: {
        justifyContent: 'center',
    },
    rightContent: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 4,
    },
    tokenChip: {
        height: 28,
        backgroundColor: '#f5f5f5',
    },
    deletedChip: {
        backgroundColor: '#ffebee',
        height: 28,
    },
    emptyState: {
        alignItems: 'center',
        padding: 40,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalBackdrop: {
        flex: 1,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: SCREEN_HEIGHT * 0.85,
        flex: 0,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    modalHeaderText: {
        flex: 1,
    },
    closeButton: {
        padding: 4,
    },
    section: {
        marginBottom: 8,
    },
    sectionTitle: {
        fontWeight: 'bold',
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 12,
    },
    infoContent: {
        flex: 1,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statCard: {
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        minWidth: 80,
    },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    activityContent: {
        flex: 1,
    },
    actionButtons: {
        marginTop: 20,
        marginBottom: 20,
        gap: 12,
    },
    restoreButton: {
        backgroundColor: '#4CAF50',
    },
    deleteButton: {
        // buttonColor prop is used instead
    },
});
