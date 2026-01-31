import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Card, Chip, Searchbar, SegmentedButtons, IconButton, useTheme } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { useProfileStore } from '../src/store/profileStore';
import { UserActivity, ACTIVITY_COSTS } from '../src/types/profile.types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';

type DateFilter = '7d' | '30d' | 'all';

export default function AnalyticsScreen() {
    const router = useRouter();
    const { userProfile, activities, fetchActivities } = useProfileStore();
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [showActivityHistory, setShowActivityHistory] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            if (userProfile) {
                fetchActivities();
            }
        }, [userProfile?.uid])
    );

    // Filter activities
    const filteredActivities = useMemo(() => {
        let filtered = [...activities];

        // Filter by date
        if (dateFilter !== 'all') {
            const days = dateFilter === '7d' ? 7 : 30;
            const cutoffDate = new Date();
            cutoffDate.setHours(0, 0, 0, 0); // Start of today
            cutoffDate.setDate(cutoffDate.getDate() - days);
            filtered = filtered.filter(a => new Date(a.timestamp) >= cutoffDate);
        }

        // Filter by search
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            filtered = filtered.filter(a =>
                a.description.toLowerCase().includes(lower) ||
                a.type.toLowerCase().includes(lower)
            );
        }

        return filtered;
    }, [activities, dateFilter, searchQuery]);

    // Calculate token breakdown by activity type
    const tokenBreakdown = useMemo(() => {
        const breakdown: Record<string, { count: number; tokens: number }> = {};

        filteredActivities.forEach(activity => {
            const type = activity.type;
            if (!breakdown[type]) {
                breakdown[type] = { count: 0, tokens: 0 };
            }
            breakdown[type].count++;
            breakdown[type].tokens += activity.tokensUsed || 0;
        });

        return Object.entries(breakdown)
            .sort((a, b) => b[1].tokens - a[1].tokens)
            .map(([type, data]) => ({
                type,
                ...data,
                costPerAction: ACTIVITY_COSTS[type as keyof typeof ACTIVITY_COSTS] || 0
            }));
    }, [filteredActivities]);

    // Summary stats
    const stats = useMemo(() => {
        const totalTokens = filteredActivities.reduce((sum, a) => sum + (a.tokensUsed || 0), 0);
        return {
            totalActivities: filteredActivities.length,
            totalTokensUsed: totalTokens,
        };
    }, [filteredActivities]);

    const formatActivityType = (type: string) => {
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const getActivityColor = (type: string): string => {
        const colors: Record<string, string> = {
            'resume_parsing': '#FF9800',
            'job_extraction': '#2196F3',
            'gap_analysis': '#E91E63',
            'ats_score_calculation': '#00BCD4',
            'bullet_enhancement': '#FF5722',
            'skill_incorporation': '#795548',
            'resume_optimized': '#4CAF50',
            'resume_reoptimization': '#8BC34A',
            'cover_letter_generation': '#9C27B0',
            'company_research': '#3F51B5',
            'interview_prep_generation': '#673AB7',
            'training_slideshow_generation': '#607D8B',
            'concept_explanation': '#009688',
            'token_purchase': '#4CAF50',
        };
        return colors[type] || '#757575';
    };

    const getActivityIcon = (type: string): string => {
        const icons: Record<string, string> = {
            'resume_parsing': 'file-document-outline',
            'job_extraction': 'briefcase-outline',
            'gap_analysis': 'chart-bar',
            'ats_score_calculation': 'percent',
            'bullet_enhancement': 'format-list-bulleted',
            'skill_incorporation': 'plus-circle-outline',
            'resume_optimized': 'check-circle-outline',
            'resume_reoptimization': 'refresh',
            'cover_letter_generation': 'email-outline',
            'company_research': 'domain',
            'interview_prep_generation': 'account-question',
            'training_slideshow_generation': 'presentation',
            'concept_explanation': 'lightbulb-outline',
            'skill_marked_learned': 'school-outline',
            'token_purchase': 'credit-card-outline',
            'pdf_export': 'file-pdf-box',
        };
        return icons[type] || 'circle-outline';
    };

    const renderActivityItem = (item: UserActivity) => (
        <View key={item.activityId} style={styles.activityItem}>
            <View style={[styles.activityIcon, { backgroundColor: getActivityColor(item.type) + '20' }]}>
                <MaterialCommunityIcons
                    name={getActivityIcon(item.type) as any}
                    size={20}
                    color={getActivityColor(item.type)}
                />
            </View>
            <View style={styles.activityContent}>
                <Text variant="bodyMedium" style={[styles.activityDescription, { color: theme.colors.onSurface }]}>
                    {item.description}
                </Text>
                <View style={styles.activityMeta}>
                    <Text variant="labelSmall" style={[styles.activityTime, { color: theme.colors.onSurfaceVariant }]}>
                        {format(new Date(item.timestamp), 'MMM d, yyyy HH:mm')}
                    </Text>
                    {item.tokensUsed > 0 && (
                        <View style={[styles.tokenBadgeSmall, { backgroundColor: theme.dark ? 'rgba(211, 47, 47, 0.15)' : '#ffebee' }]}>
                            <MaterialCommunityIcons name="fire" size={10} color={theme.dark ? '#FF8A80' : '#D32F2F'} />
                            <Text style={[styles.tokenBadgeSmallText, { color: theme.dark ? '#FF8A80' : '#D32F2F' }]}>{item.tokensUsed}</Text>
                        </View>
                    )}
                    {item.aiProvider && item.aiProvider !== 'none' && (
                        <View style={[styles.aiBadge, { backgroundColor: theme.colors.tertiaryContainer }]}>
                            <MaterialCommunityIcons name="robot" size={10} color={theme.colors.onTertiaryContainer} />
                            <Text style={[styles.aiBadgeText, { color: theme.colors.onTertiaryContainer }]}>AI</Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.listContent}>
            <View style={styles.header}>
                {/* Quick Summary */}
                <View style={styles.summaryRow}>
                    <Card style={styles.summaryCard}>
                        <Card.Content style={styles.summaryContent}>
                            <MaterialCommunityIcons name="lightning-bolt" size={24} color="#FF9800" />
                            <Text variant="headlineSmall" style={styles.summaryValue}>
                                {stats.totalActivities}
                            </Text>
                            <Text variant="labelSmall" style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>Activities</Text>
                        </Card.Content>
                    </Card>
                    <Card style={styles.summaryCard}>
                        <Card.Content style={styles.summaryContent}>
                            <MaterialCommunityIcons name="fire" size={24} color="#F44336" />
                            <Text variant="headlineSmall" style={styles.summaryValue}>
                                {stats.totalTokensUsed}
                            </Text>
                            <Text variant="labelSmall" style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>Tokens Used</Text>
                        </Card.Content>
                    </Card>
                </View>

                {/* Date Filter */}
                <SegmentedButtons
                    value={dateFilter}
                    onValueChange={(v) => setDateFilter(v as DateFilter)}
                    buttons={[
                        { value: '7d', label: 'Last 7 Days' },
                        { value: '30d', label: 'Last 30 Days' },
                        { value: 'all', label: 'All Time' },
                    ]}
                    style={styles.dateFilter}
                />

                {/* Search */}
                <Searchbar
                    placeholder="Search activities..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={[styles.searchbar, { backgroundColor: theme.colors.elevation.level2, borderColor: theme.colors.outlineVariant }]}
                />

                {/* Token Breakdown Toggle */}
                <TouchableOpacity
                    style={[styles.breakdownToggle, { backgroundColor: theme.colors.surface }]}
                    onPress={() => setShowBreakdown(!showBreakdown)}
                    activeOpacity={0.7}
                >
                    <View style={styles.breakdownToggleLeft}>
                        <MaterialCommunityIcons
                            name={showBreakdown ? 'chevron-down' : 'chevron-right'}
                            size={24}
                            color="#666"
                        />
                        <Text variant="titleMedium" style={styles.breakdownToggleText}>
                            Token Usage by Type
                        </Text>
                    </View>
                    <Chip style={[styles.breakdownChip, { backgroundColor: theme.colors.secondaryContainer }]} textStyle={{ fontSize: 11, color: theme.colors.onSecondaryContainer }}>
                        {tokenBreakdown.length} types
                    </Chip>
                </TouchableOpacity>

                {/* Token Breakdown List */}
                {showBreakdown && (
                    <Card style={styles.breakdownCard}>
                        <Card.Content>
                            {tokenBreakdown.length > 0 ? (
                                tokenBreakdown.map((item) => (
                                    <View key={item.type} style={[styles.breakdownItem, { borderBottomColor: theme.colors.outlineVariant }]}>
                                        <View style={styles.breakdownLeft}>
                                            <View style={[styles.breakdownDot, { backgroundColor: getActivityColor(item.type) }]} />
                                            <View style={{ flex: 1 }}>
                                                <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                                                    {formatActivityType(item.type)}
                                                </Text>
                                                <Text variant="labelSmall" style={{ color: '#888' }}>
                                                    {item.count}x @ {item.costPerAction} tokens
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={[styles.tokenBadge, { backgroundColor: theme.dark ? 'rgba(211, 47, 47, 0.15)' : '#ffebee' }]}>
                                            <MaterialCommunityIcons name="fire" size={14} color={theme.dark ? '#FF8A80' : '#D32F2F'} />
                                            <Text style={[styles.tokenBadgeText, { color: theme.dark ? '#FF8A80' : '#D32F2F' }]}>{item.tokens}</Text>
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <Text variant="bodyMedium" style={{ color: '#888', textAlign: 'center', padding: 16 }}>
                                    No activities in selected period
                                </Text>
                            )}
                        </Card.Content>
                    </Card>
                )}

                {/* Activity History Toggle */}
                <TouchableOpacity
                    style={[styles.activityHistoryToggle, { backgroundColor: theme.colors.surface }]}
                    onPress={() => setShowActivityHistory(!showActivityHistory)}
                    activeOpacity={0.7}
                >
                    <View style={styles.breakdownToggleLeft}>
                        <MaterialCommunityIcons
                            name={showActivityHistory ? 'chevron-down' : 'chevron-right'}
                            size={24}
                            color="#666"
                        />
                        <Text variant="titleMedium" style={styles.breakdownToggleText}>
                            Activity History
                        </Text>
                    </View>
                    <Chip style={[styles.breakdownChip, { backgroundColor: theme.colors.secondaryContainer }]} textStyle={{ fontSize: 11, color: theme.colors.onSecondaryContainer }}>
                        {filteredActivities.length} records
                    </Chip>
                </TouchableOpacity>

                {/* Activity History List */}
                {showActivityHistory && (
                    <Card style={styles.activityHistoryCard}>
                        <Card.Content style={{ padding: 0 }}>
                            {filteredActivities.length > 0 ? (
                                filteredActivities.map((item, index) => (
                                    <View key={item.activityId}>
                                        {renderActivityItem(item)}
                                        {index < filteredActivities.length - 1 && (
                                            <View style={[styles.separator, { backgroundColor: theme.colors.outlineVariant }]} />
                                        )}
                                    </View>
                                ))
                            ) : (
                                <View style={styles.emptyState}>
                                    <MaterialCommunityIcons name="history" size={48} color="#ccc" />
                                    <Text variant="bodyLarge" style={styles.emptyText}>No activities found</Text>
                                    <Text variant="bodySmall" style={styles.emptySubtext}>
                                        Your activity history will appear here
                                    </Text>
                                </View>
                            )}
                        </Card.Content>
                    </Card>
                )}
            </View>
        </ScrollView>

    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // backgroundColor: '#f5f5f5', -- Handled by ScrollView style prop override
    },
    header: {
        padding: 16,
    },
    summaryRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    summaryCard: {
        flex: 1,
        // backgroundColor: '#fff', -- Handled by Card default
    },
    summaryContent: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    summaryValue: {
        fontWeight: 'bold',
        marginVertical: 4,
    },
    summaryLabel: {
        // color: '#666', -- Handled inline
    },
    dateFilter: {
        marginBottom: 12,
    },
    searchbar: {
        marginBottom: 16,
        elevation: 0,
        // backgroundColor: '#fff', -- Handled inline
        borderWidth: 1,
        // borderColor: '#e0e0e0', -- Handled inline
    },
    breakdownToggle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        // backgroundColor: '#fff', -- Handled inline
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    breakdownToggleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    breakdownToggleText: {
        fontWeight: 'bold',
        marginLeft: 8,
    },
    breakdownChip: {
        // backgroundColor: '#e3f2fd', -- Handled inline
    },
    breakdownCard: {
        marginBottom: 16,
        // backgroundColor: '#fff', -- Handled by Card default
    },
    activityHistoryToggle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        // backgroundColor: '#fff', -- Handled inline
        padding: 12,
        borderRadius: 8,
        marginTop: 8,
        marginBottom: 8,
    },
    activityHistoryCard: {
        // backgroundColor: '#fff', -- Handled by Card default
        marginBottom: 16,
    },
    breakdownItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        // borderBottomColor: '#f0f0f0', -- Handled inline
    },
    breakdownLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    breakdownDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 12,
    },
    tokenBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    tokenBadgeText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#D32F2F',
    },
    listContent: {
        paddingBottom: 40,
    },
    activityItem: {
        flexDirection: 'row',
        // backgroundColor: '#fff', -- Handled inline
        padding: 12,
    },
    activityIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    activityContent: {
        flex: 1,
    },
    activityDescription: {
        marginBottom: 4,
    },
    activityMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    activityTime: {
    },
    tokenBadgeSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 2,
    },
    tokenBadgeSmallText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#D32F2F',
    },
    aiBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        // backgroundColor: '#e3f2fd', -- Handled inline
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 2,
    },
    aiBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        // color: '#1976D2', -- Handled inline
    },
    separator: {
        height: 1,
    },
    emptyState: {
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        marginTop: 12,
        fontWeight: 'bold',
    },
    emptySubtext: {
        marginTop: 4,
    },
});
