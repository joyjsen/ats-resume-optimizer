import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, ProgressBar, useTheme, Avatar } from 'react-native-paper';

interface Props {
    score: number;
    originalScore?: number;
    threshold?: number;
}

export const ATSScoreCard = ({ score, originalScore, threshold = 75 }: Props) => {
    const theme = useTheme();

    const getRecommendation = (s: number) => {
        if (s > 75) {
            return {
                color: '#4CAF50', // Green
                icon: 'check-circle',
                message: "Strongly encouraged to apply",
                description: "You have a strong match with the job requirements and should proceed with confidence.",
                bg: '#E8F5E9'
            };
        }
        if (s > 50) {
            return {
                color: '#FF9800', // Amber/Orange
                icon: 'alert',
                message: "Encouraged to apply, better chances with skill upgrades",
                description: "You have a decent foundation but could improve your chances by adding missing skills.",
                bg: '#FFF3E0'
            };
        }
        return {
            color: '#F44336', // Red
            icon: 'book-open-variant',
            message: "Brush up on skills before applying",
            description: "Significant skill gaps exist; focus on skill development before applying.",
            bg: '#FFEBEE'
        };
    };

    const rec = getRecommendation(score);
    const diff = originalScore !== undefined ? score - originalScore : 0;

    return (
        <Card style={styles.card}>
            <Card.Content style={styles.content}>
                <View style={styles.header}>
                    <Text variant="titleMedium">ATS Compatibility Score</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                        {originalScore !== undefined && diff !== 0 && (
                            <Text variant="titleMedium" style={{ color: '#666', marginRight: 8, textDecorationLine: 'line-through' }}>
                                {originalScore}%
                            </Text>
                        )}
                        <Text variant="displayMedium" style={{ color: rec.color, fontWeight: 'bold' }}>{score}%</Text>
                        {originalScore !== undefined && diff > 0 && (
                            <Text variant="titleMedium" style={{ color: '#4CAF50', marginLeft: 8 }}>
                                (+{diff}) ⬆️
                            </Text>
                        )}
                    </View>
                </View>

                <ProgressBar progress={score / 100} color={rec.color} style={styles.progress} />

                <View style={[styles.recommendationBox, { backgroundColor: rec.bg, borderColor: rec.color }]}>
                    <Avatar.Icon size={32} icon={rec.icon} style={{ backgroundColor: rec.color }} color="white" />
                    <View style={{ flex: 1 }}>
                        <Text variant="titleSmall" style={{ color: rec.color, fontWeight: 'bold' }}>
                            {rec.message}
                        </Text>
                        <Text variant="bodySmall" style={{ color: '#444', marginTop: 2 }}>
                            {rec.description}
                        </Text>
                    </View>
                </View>
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        marginBottom: 16,
    },
    content: {
        gap: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progress: {
        height: 10,
        borderRadius: 5,
    },
    recommendationBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 12,
        borderLeftWidth: 4,
        marginTop: 8
    }
});
