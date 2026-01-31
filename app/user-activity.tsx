import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { useProfileStore } from '../src/store/profileStore';
import { UserActivity } from '../src/types/profile.types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';

export default function UserActivityScreen() {
    const { userProfile, activities, fetchActivities } = useProfileStore();
    const theme = useTheme();

    useFocusEffect(
        React.useCallback(() => {
            if (userProfile) {
                fetchActivities();
            }
        }, [userProfile?.uid])
    );

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

    const renderActivity = ({ item }: { item: UserActivity }) => (
        <Card style={styles.activityCard}>
            <View style={styles.activityItem}>
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
                            <View style={[styles.tokenBadge, { backgroundColor: theme.dark ? 'rgba(211, 47, 47, 0.15)' : '#ffebee' }]}>
                                <MaterialCommunityIcons name="fire" size={12} color={theme.dark ? '#FF8A80' : '#D32F2F'} />
                                <Text style={[styles.tokenBadgeText, { color: theme.dark ? '#FF8A80' : '#D32F2F' }]}>{item.tokensUsed} tokens</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </Card>
    );

    const renderHeader = () => {
        // theme is available from closure
        return (
            <View style={styles.header}>
                <Text variant="headlineSmall" style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Activity History</Text>
                <Text variant="bodySmall" style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {activities.length} activities
                </Text>
            </View>
        );
    };

    return (
        <FlatList
            data={activities}
            keyExtractor={(item) => item.activityId}
            renderItem={renderActivity}
            ListHeaderComponent={renderHeader}
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
                <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="history" size={48} color={theme.colors.outlineVariant} />
                    <Text variant="bodyLarge" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>No activities yet</Text>
                    <Text variant="bodySmall" style={[styles.emptySubtext, { color: theme.colors.outline }]}>
                        Your activity history will appear here
                    </Text>
                </View>
            }
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // backgroundColor: '#f5f5f5', -- Handled inline
    },
    header: {
        padding: 16,
        paddingBottom: 8,
    },
    headerTitle: {
        fontWeight: 'bold',
        // color: '#212121', -- Handled inline
    },
    headerSubtitle: {
        // color: '#666', -- Handled inline
        marginTop: 4,
    },
    listContent: {
        paddingBottom: 40,
    },
    activityCard: {
        marginHorizontal: 16,
        marginBottom: 8,
        // backgroundColor: '#fff', -- Handled by Card default
    },
    activityItem: {
        flexDirection: 'row',
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
        marginBottom: 6,
    },
    activityMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    activityTime: {
    },
    tokenBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        gap: 4,
    },
    tokenBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#D32F2F',
    },
    emptyState: {
        alignItems: 'center',
        padding: 60,
    },
    emptyText: {
        marginTop: 12,
        fontWeight: 'bold',
    },
    emptySubtext: {
        marginTop: 4,
        textAlign: 'center',
    },
});
