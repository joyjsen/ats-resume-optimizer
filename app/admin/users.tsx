import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Alert, TouchableOpacity } from 'react-native';
import { Text, Searchbar, List, Avatar, Chip, useTheme, IconButton, Menu, Divider, Button, Switch } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { userService } from '../../src/services/firebase/userService';
import { auth } from '../../src/services/firebase/config';
import { UserProfile } from '../../src/types/profile.types';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function UserManagementScreen() {
    const theme = useTheme();
    const router = useRouter();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await userService.getAllUsers();
            setUsers(data);
            setFilteredUsers(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const onChangeSearch = (query: string) => {
        setSearchQuery(query);
        const lower = query.toLowerCase();
        const filtered = users.filter(u =>
            u.displayName.toLowerCase().includes(lower) ||
            u.email.toLowerCase().includes(lower) ||
            u.uid.includes(lower)
        );
        setFilteredUsers(filtered);
    };

    const handleActivateAll = async () => {
        Alert.alert(
            "Activate All Users?",
            "This will set all users to 'active' status and ensure everyone has at least 50 tokens. Continue?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Activate All",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const result = await userService.batchActivateUsers();
                            Alert.alert("Success", `Activated ${result.count} users successfully.`);
                            loadUsers();
                        } catch (error) {
                            Alert.alert("Error", "Failed to activate users.");
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleToggleStatus = async (user: UserProfile) => {
        if (user.uid === auth.currentUser?.uid) {
            Alert.alert("Action Prevented", "You cannot deactivate your own account. This is a safety measure to ensure you don't lock yourself out of the admin system.");
            return;
        }

        const newStatus = user.accountStatus === 'active' ? 'suspended' : 'active';
        try {
            // When reactivating, ensure profileCompleted stays true so user doesn't see onboarding again
            const updateData: any = { accountStatus: newStatus };
            if (newStatus === 'active') {
                updateData.profileCompleted = true;
                updateData.reactivatedAt = new Date();
                updateData.reactivatedBy = 'admin';
            }
            await userService.updateProfile(user.uid, updateData);

            // Send email notification
            try {
                const functions = getFunctions();
                const sendAccountStatusEmail = httpsCallable(functions, 'sendAccountStatusEmail');
                await sendAccountStatusEmail({
                    email: user.email,
                    displayName: user.displayName,
                    action: newStatus === 'active' ? 'reactivated' : 'suspended'
                });
            } catch (emailError) {
                console.error('[Admin] Failed to send status email:', emailError);
            }

            loadUsers();
        } catch (error) {
            Alert.alert("Error", "Failed to update status.");
        }
    };

    const handleToggleRole = async (user: UserProfile) => {
        if (user.uid === auth.currentUser?.uid) {
            Alert.alert("Action Prevented", "You cannot demote yourself. This is a safety measure to ensure you don't lose access to the Admin Dashboard.");
            return;
        }

        const newRole = user.role === 'admin' ? 'user' : 'admin';
        try {
            await userService.updateProfile(user.uid, { role: newRole });
            loadUsers();
        } catch (error) {
            Alert.alert("Error", "Failed to update role.");
        }
    };

    const renderItem = ({ item }: { item: UserProfile }) => (
        <List.Item
            title={item.displayName}
            description={`${item.email}`}
            left={props => (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                    {item.photoURL ? (
                        <Avatar.Image size={40} source={{ uri: item.photoURL }} />
                    ) : (
                        <Avatar.Text size={40} label={item.displayName.charAt(0)} />
                    )}
                </View>
            )}
            right={props => (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                        <Chip
                            textStyle={{ fontSize: 10, height: 16, lineHeight: 16 }}
                            style={{ height: 24, marginBottom: 4 }}
                        >
                            {item.tokenBalance} 🪙
                        </Chip>
                        <TouchableOpacity onPress={() => handleToggleRole(item)}>
                            <Chip
                                style={{
                                    minHeight: 28,
                                    justifyContent: 'center',
                                    backgroundColor: item.role === 'admin' ? theme.colors.primary : '#eee'
                                }}
                                textStyle={{
                                    color: item.role === 'admin' ? 'white' : '#666',
                                    fontSize: 11,
                                    lineHeight: 14
                                }}
                            >
                                {item.role.toUpperCase()}
                            </Chip>
                        </TouchableOpacity>
                    </View>

                    <View style={{ alignItems: 'center', width: 50 }}>
                        <Text variant="labelSmall" style={{ fontSize: 8, marginBottom: 2 }}>
                            {item.accountStatus === 'active' ? 'ACTIVE' : 'OFF'}
                        </Text>
                        <Switch
                            value={item.accountStatus === 'active'}
                            onValueChange={() => handleToggleStatus(item)}
                            color={theme.colors.primary}
                        />
                    </View>
                </View>
            )}
            onPress={() => router.push(`/admin/user/${item.uid}`)}
            style={styles.item}
        />
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.searchRow}>
                    <Searchbar
                        placeholder="Search users..."
                        onChangeText={onChangeSearch}
                        value={searchQuery}
                        style={styles.search}
                    />
                </View>

                <View style={styles.buttonRow}>
                    <Button
                        mode="contained"
                        onPress={handleActivateAll}
                        icon="flash"
                        style={styles.batchButton}
                        loading={loading}
                    >
                        Activate All
                    </Button>

                    <Button
                        mode="outlined"
                        onPress={() => router.push('/admin/deleted-users')}
                        icon="account-remove"
                        style={styles.deletedButton}
                        textColor="#D32F2F"
                    >
                        Deleted Users
                    </Button>
                </View>
            </View>

            <FlatList
                data={filteredUsers}
                keyExtractor={item => item.uid}
                renderItem={renderItem}
                ItemSeparatorComponent={() => <Divider />}
                onRefresh={loadUsers}
                refreshing={loading}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        padding: 16,
        backgroundColor: '#f5f5f5',
    },
    searchRow: {
        marginBottom: 12,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    batchButton: {
        borderRadius: 8,
        flex: 1,
    },
    deletedButton: {
        borderRadius: 8,
        borderColor: '#D32F2F',
        flex: 1,
    },
    search: {
        elevation: 0,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    item: {
        paddingVertical: 12,
        minHeight: 80,
        justifyContent: 'center',
    }
});
