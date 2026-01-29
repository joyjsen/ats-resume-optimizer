import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { List, Text, Avatar, useTheme, Button, Divider, Card } from 'react-native-paper';
import { UserActivity, ActivityType } from '../../types/profile.types';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ActivityTimelineProps {
    activities: UserActivity[];
    onViewAll: () => void;
}

const getActivityIcon = (type: ActivityType): string => {
    switch (type) {
        case 'resume_parsing': return 'file-search';
        case 'job_extraction': return 'clipboard-search';
        case 'gap_analysis': return 'file-compare';
        case 'ats_score_calculation': return 'calculator';
        case 'bullet_enhancement': return 'auto-fix';
        case 'skill_incorporation': return 'plus-box';
        case 'resume_reoptimization': return 'creation';
        case 'draft_score_prediction': return 'chart-bell-curve';
        case 'cover_letter_generation': return 'email-edit';
        case 'company_research': return 'office-building-marker';
        case 'interview_prep_generation': return 'account-question';
        case 'training_slideshow_generation': return 'presentation';
        case 'concept_explanation': return 'book-open-variant';
        case 'skill_marked_learned': return 'check-circle';
        case 'token_purchase': return 'plus-circle';
        case 'pdf_export': return 'file-pdf-box';
        default: return 'history';
    }
};

const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
};

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ activities, onViewAll }) => {
    const theme = useTheme();

    const renderItem = ({ item }: { item: UserActivity }) => (
        <List.Item
            title={item.description}
            description={`${formatRelativeTime(item.timestamp)} • ${item.tokensUsed} tokens`}
            left={props => (
                <View style={styles.iconContainer}>
                    <MaterialCommunityIcons
                        name={getActivityIcon(item.type) as any}
                        size={24}
                        color={theme.colors.primary}
                    />
                </View>
            )}
            right={props => (
                <View style={styles.statusContainer}>
                    <MaterialCommunityIcons
                        name={item.status === 'completed' ? 'check-circle' : 'alert-circle'}
                        size={16}
                        color={item.status === 'completed' ? '#4CAF50' : '#F44336'}
                    />
                </View>
            )}
            titleStyle={styles.title}
        />
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Recent Activity</Text>
                <Button onPress={onViewAll} compact>View All</Button>
            </View>

            <Card style={styles.card} mode="elevated" elevation={2}>
                <View style={styles.cardContent}>
                    <Card.Content style={{ padding: 0 }}>
                        {activities.length > 0 ? (
                            activities.map((item, index) => (
                                <React.Fragment key={item.activityId}>
                                    {renderItem({ item })}
                                    {index < activities.length - 1 && <Divider />}
                                </React.Fragment>
                            ))
                        ) : (
                            <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>No activities found.</Text>
                        )}
                    </Card.Content>
                </View>
            </Card>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    card: {
        marginBottom: 8,
        borderRadius: 8,
    },
    cardContent: {
        overflow: 'hidden',
        borderRadius: 8,
    },
    iconContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 40,
    },
    statusContainer: {
        justifyContent: 'center',
    },
    title: {
        fontSize: 14,
        fontWeight: '500',
    },
    emptyText: {
        textAlign: 'center',
        padding: 24,
        color: '#888',
    }
});
