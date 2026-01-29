import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Button, Chip, Divider, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useResumeStore } from '../../src/store/resumeStore';
import { ATSScoreCard } from '../../src/components/analysis/ATSScoreCard';
import { SkillsComparison } from '../../src/components/analysis/SkillsComparison';
import { BeforeAfterComparison } from '../../src/components/optimization/BeforeAfterComparison';

/**
 * Admin-only read-only view of a user's analysis
 * This keeps navigation within the admin Stack for proper back button behavior
 */
export default function AdminAnalysisViewScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { currentAnalysis } = useResumeStore();

    if (!currentAnalysis) {
        return (
            <View style={styles.centered}>
                <Text>No analysis data found.</Text>
                <Button onPress={() => router.back()} style={{ marginTop: 16 }}>Go Back</Button>
            </View>
        );
    }

    const { resume, job, matchAnalysis, atsScore } = currentAnalysis;
    const optimizedResume = currentAnalysis.draftOptimizedResumeData || currentAnalysis.optimizedResume;
    const changes = currentAnalysis.draftChangesData || currentAnalysis.changes;
    const displayScore = currentAnalysis.draftAtsScore ?? atsScore;

    return (
        <ScrollView style={styles.container}>
            {/* Admin Notice */}
            <Card style={styles.adminNotice}>
                <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, marginRight: 12 }}>👁️</Text>
                    <View style={{ flex: 1 }}>
                        <Text variant="titleSmall" style={{ fontWeight: 'bold', color: '#1565C0' }}>
                            Admin View Mode
                        </Text>
                        <Text variant="bodySmall" style={{ color: '#1976D2' }}>
                            Viewing user's analysis (read-only)
                        </Text>
                    </View>
                </Card.Content>
            </Card>

            {/* Job Info */}
            <Card style={styles.card}>
                <Card.Content>
                    <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>{job?.title || 'Unknown Job'}</Text>
                    <Text variant="bodyMedium" style={{ color: '#666', marginTop: 4 }}>{job?.company || 'Unknown Company'}</Text>
                </Card.Content>
            </Card>

            {/* ATS Score */}
            <ATSScoreCard score={displayScore} />

            {/* Skills Analysis */}
            {matchAnalysis && (
                <SkillsComparison
                    matchAnalysis={currentAnalysis.draftMatchAnalysis ?? currentAnalysis.optimizedMatchAnalysis ?? matchAnalysis}
                    originalMatchAnalysis={matchAnalysis}
                    changes={changes}
                    onSkillPress={() => {}} // Read-only, no action
                />
            )}

            {/* Optimization Status */}
            {optimizedResume ? (
                <Card style={[styles.card, { backgroundColor: '#E8F5E9' }]}>
                    <Card.Content>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ fontSize: 24, marginRight: 12 }}>✅</Text>
                            <View style={{ flex: 1 }}>
                                <Text variant="titleMedium" style={{ fontWeight: 'bold', color: '#2E7D32' }}>
                                    Resume Optimized
                                </Text>
                                <Text variant="bodySmall" style={{ color: '#388E3C' }}>
                                    {changes?.length || 0} improvements made
                                </Text>
                            </View>
                        </View>
                    </Card.Content>
                </Card>
            ) : (
                <Card style={[styles.card, { backgroundColor: '#FFF3E0' }]}>
                    <Card.Content>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ fontSize: 24, marginRight: 12 }}>📝</Text>
                            <View style={{ flex: 1 }}>
                                <Text variant="titleMedium" style={{ fontWeight: 'bold', color: '#E65100' }}>
                                    Not Optimized Yet
                                </Text>
                                <Text variant="bodySmall" style={{ color: '#F57C00' }}>
                                    User has not optimized this resume
                                </Text>
                            </View>
                        </View>
                    </Card.Content>
                </Card>
            )}

            {/* Changes Summary */}
            {changes && changes.length > 0 && (
                <Card style={styles.card}>
                    <Card.Content>
                        <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 12 }}>
                            Optimization Changes
                        </Text>
                        {changes.map((change: any, index: number) => (
                            <View key={index} style={styles.changeItem}>
                                <View style={styles.changeDot} />
                                <View style={{ flex: 1 }}>
                                    <Text variant="labelMedium" style={{ color: '#2E7D32', fontWeight: '600' }}>
                                        {change.type?.replace(/_/g, ' ').toUpperCase()}
                                    </Text>
                                    <Text variant="bodySmall" style={{ color: '#666' }}>
                                        {change.reason}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </Card.Content>
                </Card>
            )}

            {/* Before/After Comparison */}
            {optimizedResume && resume && (
                <BeforeAfterComparison
                    original={resume}
                    optimized={optimizedResume}
                    changes={changes || []}
                />
            )}

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f5f5f5',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    adminNotice: {
        marginBottom: 16,
        backgroundColor: '#E3F2FD',
        borderLeftWidth: 4,
        borderLeftColor: '#1976D2',
    },
    card: {
        marginBottom: 16,
        backgroundColor: '#fff',
    },
    changeItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
        paddingLeft: 8,
    },
    changeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4CAF50',
        marginRight: 12,
        marginTop: 6,
    },
});
