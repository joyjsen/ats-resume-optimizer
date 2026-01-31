import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Button, Text, Card, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useResumeStore } from '../src/store/resumeStore';
import { useLearningStore } from '../src/store/learningStore';
import { ATSScoreCard } from '../src/components/analysis/ATSScoreCard';
import { UpskillRoadmap } from '../src/components/learning/UpskillRoadmap';
import { GapAnalysis } from '../src/components/analysis/GapAnalysis';

export default function UpskillingPathScreen() {
    const router = useRouter();
    const { currentAnalysis } = useResumeStore();
    const { addLearningPath } = useLearningStore();
    const [saved, setSaved] = useState(false);

    if (!currentAnalysis) {
        return (
            <View style={styles.container}>
                <Text>No analysis data found.</Text>
                <Button onPress={() => router.back()}>Go Back</Button>
            </View>
        );
    }

    // If user is actually ready but somehow ended up here, or logic requires it
    const { atsScore, gaps, recommendation } = currentAnalysis;

    const handleSavePath = () => {
        if (recommendation.upskillPath) {
            addLearningPath({
                ...recommendation.upskillPath,
                id: Date.now().toString(),
                jobTitle: currentAnalysis.job.title,
                company: currentAnalysis.job.company,
                startedAt: new Date(),
                targetDate: calculateTargetDate(recommendation.upskillPath.totalDuration),
                progress: 0,
                status: 'not_started',
            });
            setSaved(true);
            Alert.alert(
                'Learning Path Saved!',
                'We\'ll send you reminders and track your progress.'
            );
        }
    };

    const handleFindAlternatives = () => {
        // Navigate to job search (placeholder)
        Alert.alert("Coming Soon", "Values alternative jobs search would be here.");
    };

    return (
        <ScrollView style={styles.container}>
            <Text variant="headlineMedium" style={styles.title}>
                ⚠️ Not Quite Ready Yet
            </Text>

            <ATSScoreCard score={atsScore} threshold={75} />

            <Card style={styles.card}>
                <Card.Content>
                    <Text variant="titleMedium">Our Recommendation</Text>
                    <Text variant="bodyMedium" style={styles.text}>
                        {recommendation.reasoning}
                    </Text>
                </Card.Content>
            </Card>

            <GapAnalysis gaps={gaps} />

            {recommendation.action === 'upskill' && recommendation.upskillPath && (
                <>
                    <View style={styles.pathHeader}>
                        <Text variant="titleLarge">Your Learning Path</Text>
                        <View style={styles.chips}>
                            <Chip icon="clock-outline">
                                {recommendation.upskillPath.totalDuration}
                            </Chip>
                            <Chip icon="currency-usd">
                                {recommendation.upskillPath.estimatedCost === 0 ? 'Free' : '$' + recommendation.upskillPath.estimatedCost}
                            </Chip>
                        </View>
                    </View>

                    <UpskillRoadmap upskillPath={recommendation.upskillPath} />

                    <View style={styles.actions}>
                        <Button
                            mode="contained"
                            onPress={handleSavePath}
                            disabled={saved}
                            style={styles.button}
                        >
                            {saved ? '✓ Learning Path Saved' : 'Start Learning Path'}
                        </Button>
                    </View>
                </>
            )}

            {recommendation.alternativeJobs && recommendation.alternativeJobs.length > 0 && (
                <>
                    <Text variant="titleMedium" style={styles.alternativeTitle}>
                        Better Matches For You
                    </Text>
                    <Text variant="bodyMedium" style={styles.alternativeSubtitle}>
                        These roles align better with your current skills:
                    </Text>

                    {recommendation.alternativeJobs.map((job, index) => (
                        <Card key={index} style={styles.jobCard}>
                            <Card.Content>
                                <Text variant="titleMedium">{job.title}</Text>
                                <Text variant="bodySmall" style={styles.jobScore}>
                                    Estimated ATS Score: {job.estimatedScore}%
                                </Text>
                                <Text variant="bodyMedium" style={styles.jobReason}>
                                    {job.reason}
                                </Text>
                            </Card.Content>
                        </Card>
                    ))}

                    <Button
                        mode="outlined"
                        onPress={handleFindAlternatives}
                        style={styles.button}
                    >
                        Find Similar Jobs
                    </Button>
                </>
            )}
        </ScrollView>
    );
}

function calculateTargetDate(duration: string): Date {
    const date = new Date();
    const months = duration.includes('month')
        ? parseInt(duration) || 3
        : 1;
    date.setMonth(date.getMonth() + months);
    return date;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    title: {
        marginBottom: 16,
    },
    card: {
        marginVertical: 12,
    },
    text: {
        marginTop: 8,
    },
    pathHeader: {
        marginTop: 24,
        marginBottom: 16,
    },
    chips: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 8,
    },
    actions: {
        marginVertical: 24,
    },
    button: {
        marginBottom: 12,
    },
    alternativeTitle: {
        marginTop: 32,
        marginBottom: 8,
    },
    alternativeSubtitle: {
        marginBottom: 16,
        opacity: 0.7,
    },
    jobCard: {
        marginBottom: 12,
    },
    jobScore: {
        color: '#4CAF50',
        marginTop: 4,
    },
    jobReason: {
        marginTop: 8,
    },
});
