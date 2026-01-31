import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { UserActivity } from '../../types/profile.types';

interface QuickStatsProps {
    activities: UserActivity[];
    stats?: {
        resumesAnalyzed: number;
        resumesOptimized: number;
        resumesReoptimized: number;
        prepGuides: number;
        skillsLearned: number;
        coverLetters: number;
    } | null;
    onStatPress?: (statType: string) => void;
}

export const QuickStats: React.FC<QuickStatsProps> = ({ activities, stats: passedStats, onStatPress }) => {
    const theme = useTheme();

    // Use passed stats if available, otherwise fallback to activity-based calculation
    const stats = passedStats || {
        resumesAnalyzed: activities.filter(a => ['resume_parsing', 'gap_analysis', 'ats_score_calculation'].includes(a.type)).length,
        resumesOptimized: activities.filter(a => ['bullet_enhancement', 'skill_incorporation'].includes(a.type)).length,
        resumesReoptimized: activities.filter(a => a.type === 'resume_reoptimization').length,
        prepGuides: activities.filter(a => a.type === 'interview_prep_generation').length,
        skillsLearned: activities.filter(a => ['skill_marked_learned', 'training_slideshow_generation', 'concept_explanation'].includes(a.type)).length,
        coverLetters: activities.filter(a => a.type === 'cover_letter_generation').length,
    };

    const StatItem = ({ label, value, icon, color, onPress }: { label: string, value: number, icon: string, color: string, onPress: () => void }) => (
        <Card style={styles.statCard} onPress={onPress}>
            <View style={styles.statContent}>
                <MaterialCommunityIcons name={icon as any} size={28} color={color} />
                <Text variant="headlineSmall" style={styles.statValue}>{value}</Text>
                <Text variant="labelSmall" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
            </View>
        </Card>
    );

    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <StatItem
                    label="Resumes Analyzed"
                    value={stats.resumesAnalyzed}
                    icon="file-search"
                    color="#2196F3"
                    onPress={() => onStatPress?.('resumes_analyzed')}
                />
                <StatItem
                    label="Resumes Optimized"
                    value={stats.resumesOptimized}
                    icon="creation"
                    color="#9C27B0"
                    onPress={() => onStatPress?.('optimized_resumes')}
                />
            </View>
            <View style={styles.row}>
                <StatItem
                    label="Resumes Re-Optimized"
                    value={stats.resumesReoptimized}
                    icon="auto-fix"
                    color="#673AB7"
                    onPress={() => onStatPress?.('reoptimized_resumes')}
                />
                <StatItem
                    label="Prep Guides"
                    value={stats.prepGuides}
                    icon="briefcase-check"
                    color="#4CAF50"
                    onPress={() => onStatPress?.('prep_guides')}
                />
            </View>
            <View style={styles.row}>
                <StatItem
                    label="Skills Learned"
                    value={stats.skillsLearned}
                    icon="school"
                    color="#FF9800"
                    onPress={() => onStatPress?.('skills_learned')}
                />
                <StatItem
                    label="Cover Letters"
                    value={stats.coverLetters}
                    icon="file-document-edit"
                    color="#FF5722"
                    onPress={() => onStatPress?.('cover_letters')}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 8,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statCard: {
        flex: 1,
        margin: 8,
        // backgroundColor: '#fff', -- Handled by Card default
    },
    statContent: {
        padding: 16,
        alignItems: 'center',
    },
    statValue: {
        fontWeight: 'bold',
        marginVertical: 4,
    },
    statLabel: {
        // color: '#666', -- Handled inline
        textAlign: 'center',
    }
});
