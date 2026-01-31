import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, FlatList, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import {
    Text,
    Card,
    ActivityIndicator,
    Chip,
    useTheme,
    Searchbar,
    SegmentedButtons,
    Divider,
    Button,
    RadioButton
} from 'react-native-paper';
import { activityService } from '../../src/services/firebase/activityService';
import { userService } from '../../src/services/firebase/userService';
import { UserActivity, UserProfile, ActivityType, ACTIVITY_COSTS } from '../../src/types/profile.types';
import { format, subDays, isAfter } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type DateFilter = '7d' | '30d' | '90d' | 'all';

export default function PlatformAnalytics() {
    const theme = useTheme();
    const [activities, setActivities] = useState<UserActivity[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUserId, setSelectedUserId] = useState<string>('all');
    const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
    const [searchQuery, setSearchQuery] = useState('');
    const [userMenuVisible, setUserMenuVisible] = useState(false);
    const [activityLogExpanded, setActivityLogExpanded] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [activitiesData, usersData] = await Promise.all([
                activityService.getAllActivities(500),
                userService.getAllUsers()
            ]);
            setActivities(activitiesData);
            setUsers(usersData);
        } catch (error) {
            console.error('Failed to load analytics data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter activities based on selected filters
    const filteredActivities = useMemo(() => {
        let filtered = [...activities];

        // Filter by user
        if (selectedUserId !== 'all') {
            filtered = filtered.filter(a => a.uid === selectedUserId);
        }

        // Filter by date
        if (dateFilter !== 'all') {
            const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
            const cutoffDate = subDays(new Date(), days);
            filtered = filtered.filter(a => isAfter(a.timestamp, cutoffDate));
        }

        // Filter by search query
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            filtered = filtered.filter(a =>
                a.description.toLowerCase().includes(lower) ||
                a.type.toLowerCase().includes(lower)
            );
        }

        return filtered;
    }, [activities, selectedUserId, dateFilter, searchQuery]);

    // Calculate statistics
    const stats = useMemo(() => {
        const totalTokensUsed = filteredActivities.reduce((sum, a) => sum + (a.tokensUsed || 0), 0);
        const uniqueUsers = new Set(filteredActivities.map(a => a.uid)).size;

        // Activity type breakdown
        const typeBreakdown: Record<string, { count: number; tokens: number }> = {};
        filteredActivities.forEach(a => {
            if (!typeBreakdown[a.type]) {
                typeBreakdown[a.type] = { count: 0, tokens: 0 };
            }
            typeBreakdown[a.type].count++;
            typeBreakdown[a.type].tokens += a.tokensUsed || 0;
        });

        // Sort by token usage
        const sortedTypes = Object.entries(typeBreakdown)
            .sort((a, b) => b[1].tokens - a[1].tokens)
            .slice(0, 5);

        return {
            totalActivities: filteredActivities.length,
            totalTokensUsed,
            uniqueUsers,
            avgTokensPerActivity: filteredActivities.length > 0
                ? (totalTokensUsed / filteredActivities.length).toFixed(1)
                : '0',
            topActivityTypes: sortedTypes
        };
    }, [filteredActivities]);

    // Get user display name by uid
    const getUserName = (uid: string) => {
        const user = users.find(u => u.uid === uid);
        return user ? user.displayName : uid.substring(0, 8) + '...';
    };

    // Get selected user label for dropdown
    const getSelectedUserLabel = () => {
        if (selectedUserId === 'all') return 'All Users';
        const user = users.find(u => u.uid === selectedUserId);
        return user ? `${user.displayName}` : 'Select User';
    };

    const getTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            'cover_letter_generation': '#4CAF50',
            'interview_prep_generation': '#2196F3',
            'resume_parsing': '#FF9800',
            'resume_optimized': '#9C27B0',
            'gap_analysis': '#E91E63',
            'ats_score_calculation': '#00BCD4',
            'bullet_enhancement': '#FF5722',
            'skill_incorporation': '#795548',
            'training_slideshow_generation': '#607D8B',
            'company_research': '#3F51B5',
            'token_purchase': '#4CAF50',
        };
        return colors[type] || '#757575';
    };

    const formatActivityType = (type: string) => {
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
                <Text style={{ marginTop: 16 }}>Loading analytics...</Text>
            </View>
        );
    }

    const renderHeader = () => (
        <>
            {/* Stats Cards */}
            <View style={styles.statsSection}>
                <Text variant="titleMedium" style={styles.sectionTitle}>Summary</Text>
                <View style={styles.statsGrid}>
                    <StatCard
                        icon="format-list-bulleted"
                        label="Activities"
                        value={stats.totalActivities.toString()}
                        color="#2196F3"
                    />
                    <StatCard
                        icon="fire"
                        label="Tokens Used"
                        value={stats.totalTokensUsed.toString()}
                        color="#F44336"
                    />
                    <StatCard
                        icon="account-group"
                        label="Active Users"
                        value={stats.uniqueUsers.toString()}
                        color="#4CAF50"
                    />
                    <StatCard
                        icon="chart-line"
                        label="Avg/Activity"
                        value={stats.avgTokensPerActivity}
                        color="#FF9800"
                    />
                </View>
            </View>

            {/* Top Activity Types */}
            {stats.topActivityTypes.length > 0 && (
                <View style={styles.topTypesSection}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Top Activity Types (by tokens)
                    </Text>
                    {stats.topActivityTypes.map(([type, data]) => (
                        <View key={type} style={styles.typeRow}>
                            <View style={styles.typeInfo}>
                                <View style={[styles.typeDot, { backgroundColor: getTypeColor(type) }]} />
                                <Text variant="bodyMedium" style={styles.typeName}>
                                    {formatActivityType(type)}
                                </Text>
                            </View>
                            <View style={styles.typeStats}>
                                <Text variant="labelSmall" style={styles.typeCount}>{data.count}x</Text>
                                <View style={styles.topTypeTokenTag}>
                                    <MaterialCommunityIcons name="fire" size={14} color="#D32F2F" />
                                    <Text style={styles.topTypeTokenText}>{data.tokens}</Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Activity List Header - Collapsible */}
            <TouchableOpacity
                style={styles.activityListSection}
                onPress={() => setActivityLogExpanded(!activityLogExpanded)}
                activeOpacity={0.7}
            >
                <View style={styles.listHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons
                            name={activityLogExpanded ? 'chevron-down' : 'chevron-right'}
                            size={24}
                            color="#666"
                        />
                        <Text variant="titleMedium" style={[styles.sectionTitle, { marginLeft: 8, marginBottom: 0 }]}>
                            Activity Log
                        </Text>
                    </View>
                    <Chip style={styles.recordCountChip} textStyle={{ fontSize: 12 }}>
                        {filteredActivities.length} records
                    </Chip>
                </View>
                {!activityLogExpanded && (
                    <Text variant="bodySmall" style={styles.expandHint}>
                        Tap to view all activities
                    </Text>
                )}
            </TouchableOpacity>
        </>
    );

    return (
        <View style={styles.container}>
            {/* Fixed Filters Section */}
            <View style={styles.filtersSection}>
                <Text variant="titleMedium" style={styles.sectionTitle}>Filters</Text>

                {/* User Filter */}
                <View style={styles.pickerContainer}>
                    <Text variant="labelMedium" style={styles.filterLabel}>Filter by User</Text>
                    <TouchableOpacity
                        style={styles.dropdownButton}
                        onPress={() => setUserMenuVisible(true)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.dropdownText}>{getSelectedUserLabel()}</Text>
                        <MaterialCommunityIcons name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>
                </View>

                {/* Date Range Filter */}
                <Text variant="labelMedium" style={[styles.filterLabel, { marginTop: 12 }]}>Date Range</Text>
                <SegmentedButtons
                    value={dateFilter}
                    onValueChange={(value) => setDateFilter(value as DateFilter)}
                    buttons={[
                        { value: '7d', label: '7 Days' },
                        { value: '30d', label: '30 Days' },
                        { value: '90d', label: '90 Days' },
                        { value: 'all', label: 'All Time' },
                    ]}
                    style={styles.segmentedButtons}
                />

                {/* Search */}
                <Searchbar
                    placeholder="Search activities..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchbar}
                />
            </View>

            {/* User Selection Modal */}
            <Modal
                visible={userMenuVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setUserMenuVisible(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setUserMenuVisible(false)}
                >
                    <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
                        <View style={styles.modalHeader}>
                            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Select User</Text>
                            <TouchableOpacity onPress={() => setUserMenuVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                        <Divider />
                        <ScrollView style={styles.modalScroll}>
                            <TouchableOpacity
                                style={styles.userOption}
                                onPress={() => {
                                    setSelectedUserId('all');
                                    setUserMenuVisible(false);
                                }}
                            >
                                <RadioButton
                                    value="all"
                                    status={selectedUserId === 'all' ? 'checked' : 'unchecked'}
                                    onPress={() => {
                                        setSelectedUserId('all');
                                        setUserMenuVisible(false);
                                    }}
                                />
                                <View style={styles.userOptionText}>
                                    <Text variant="bodyLarge">All Users</Text>
                                    <Text variant="bodySmall" style={{ color: '#666' }}>Show activities from everyone</Text>
                                </View>
                            </TouchableOpacity>
                            <Divider />
                            {users.map(user => (
                                <TouchableOpacity
                                    key={user.uid}
                                    style={styles.userOption}
                                    onPress={() => {
                                        setSelectedUserId(user.uid);
                                        setUserMenuVisible(false);
                                    }}
                                >
                                    <RadioButton
                                        value={user.uid}
                                        status={selectedUserId === user.uid ? 'checked' : 'unchecked'}
                                        onPress={() => {
                                            setSelectedUserId(user.uid);
                                            setUserMenuVisible(false);
                                        }}
                                    />
                                    <View style={styles.userOptionText}>
                                        <Text variant="bodyLarge">{user.displayName}</Text>
                                        <Text variant="bodySmall" style={{ color: '#666' }}>{user.email}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Main Content - Single FlatList with Header */}
            <FlatList
                data={activityLogExpanded ? filteredActivities : []}
                keyExtractor={(item) => item.activityId}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={renderHeader}
                renderItem={({ item }) => (
                    <Card style={styles.activityCard}>
                        <Card.Content>
                            <View style={styles.activityRow}>
                                <View style={{ flex: 1 }}>
                                    <Text variant="titleSmall" style={styles.activityTitle}>
                                        {item.description}
                                    </Text>
                                    <Text variant="bodySmall" style={styles.userLabel}>
                                        {getUserName(item.uid)}
                                    </Text>
                                    <View style={styles.chipRow}>
                                        <View style={[styles.activityTypeTag, { backgroundColor: getTypeColor(item.type) + '25' }]}>
                                            <Text style={[styles.activityTypeText, { color: getTypeColor(item.type) }]}>
                                                {formatActivityType(item.type)}
                                            </Text>
                                        </View>
                                        {item.tokensUsed > 0 && (
                                            <View style={styles.tokenTag}>
                                                <MaterialCommunityIcons name="fire" size={12} color="#D32F2F" />
                                                <Text style={styles.tokenTagText}>{item.tokensUsed}</Text>
                                            </View>
                                        )}
                                        {item.aiProvider && item.aiProvider !== 'none' && (
                                            <View style={styles.aiTag}>
                                                <MaterialCommunityIcons name="robot" size={12} color="#1976D2" />
                                                <Text style={styles.aiTagText}>{item.aiProvider.split('-')[0]}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <View style={styles.timestampContainer}>
                                    <Text variant="labelSmall" style={styles.timestamp}>
                                        {format(item.timestamp, 'MMM d')}
                                    </Text>
                                    <Text variant="labelSmall" style={styles.timestamp}>
                                        {format(item.timestamp, 'HH:mm')}
                                    </Text>
                                </View>
                            </View>
                        </Card.Content>
                    </Card>
                )}
                ListEmptyComponent={
                    activityLogExpanded ? (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="chart-box-outline" size={48} color="#ccc" />
                            <Text style={styles.emptyText}>No activities found</Text>
                            <Text variant="bodySmall" style={styles.emptySubtext}>
                                Try adjusting your filters
                            </Text>
                        </View>
                    ) : null
                }
            />
        </View>
    );
}

const StatCard = ({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) => (
    <Card style={styles.statCard}>
        <Card.Content style={styles.statCardContent}>
            <MaterialCommunityIcons name={icon as any} size={24} color={color} />
            <Text variant="headlineSmall" style={styles.statValue}>{value}</Text>
            <Text variant="labelSmall" style={styles.statLabel}>{label}</Text>
        </Card.Content>
    </Card>
);

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
    filtersSection: {
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 8,
    },
    sectionTitle: {
        fontWeight: 'bold',
        marginBottom: 12,
    },
    filterLabel: {
        color: '#666',
        marginBottom: 4,
    },
    pickerContainer: {
        marginBottom: 8,
    },
    dropdownButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        backgroundColor: '#fafafa',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    dropdownText: {
        fontSize: 16,
        color: '#333',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    modalScroll: {
        maxHeight: 400,
    },
    userOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    userOptionText: {
        flex: 1,
        marginLeft: 8,
    },
    segmentedButtons: {
        marginTop: 4,
    },
    searchbar: {
        marginTop: 12,
        elevation: 0,
        backgroundColor: '#fafafa',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    statsSection: {
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 8,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
    },
    statCard: {
        width: '48%',
        margin: '1%',
        backgroundColor: '#fff',
    },
    statCardContent: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    statValue: {
        fontWeight: 'bold',
        marginVertical: 4,
    },
    statLabel: {
        color: '#666',
    },
    topTypesSection: {
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 8,
    },
    typeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    typeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    typeDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 8,
    },
    typeName: {
        flex: 1,
    },
    typeStats: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    typeCount: {
        color: '#666',
        marginRight: 8,
    },
    topTypeTokenTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffebee',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 4,
    },
    topTypeTokenText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#D32F2F',
    },
    activityListSection: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: '#fff',
        marginTop: 8,
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    recordCountChip: {
        backgroundColor: '#e3f2fd',
    },
    expandHint: {
        color: '#888',
        marginTop: 8,
        marginLeft: 32,
    },
    listContent: {
        paddingBottom: 16,
    },
    activityCard: {
        marginBottom: 8,
        marginHorizontal: 16,
        backgroundColor: '#fff',
        elevation: 1,
    },
    activityRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    activityTitle: {
        fontWeight: 'bold',
        color: '#212121',
    },
    userLabel: {
        color: '#666',
        marginTop: 2,
    },
    chipRow: {
        flexDirection: 'row',
        marginTop: 8,
        flexWrap: 'wrap',
        gap: 6,
    },
    activityTypeTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    activityTypeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    tokenTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffebee',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        gap: 4,
    },
    tokenTagText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#D32F2F',
    },
    aiTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e3f2fd',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        gap: 4,
    },
    aiTagText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#1976D2',
    },
    timestampContainer: {
        alignItems: 'flex-end',
    },
    timestamp: {
        color: '#888',
    },
    emptyState: {
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        marginTop: 12,
        color: '#666',
        fontWeight: 'bold',
    },
    emptySubtext: {
        color: '#999',
        marginTop: 4,
    },
});
