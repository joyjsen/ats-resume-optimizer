import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, ProgressBar, useTheme } from 'react-native-paper';
// import { ScoreGauge } from '../common/ScoreGauge'; // Placeholder if needed

interface Props {
    score: number;
    originalScore?: number;
    threshold?: number;
}

export const ATSScoreCard = ({ score, originalScore, threshold = 75 }: Props) => {
    const theme = useTheme();

    const getColor = (s: number) => {
        if (s >= 85) return theme.colors.primary; // Greenish usually but using primary
        if (s >= 75) return '#4CAF50';
        if (s >= 50) return '#FFC107'; // Yellow/Amber
        return theme.colors.error;
    };

    const color = getColor(score);
    const isPassing = score >= threshold;
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
                        <Text variant="displayMedium" style={{ color }}>{score}%</Text>
                        {originalScore !== undefined && diff > 0 && (
                            <Text variant="titleMedium" style={{ color: '#4CAF50', marginLeft: 8 }}>
                                (+{diff}) ⬆️
                            </Text>
                        )}
                    </View>
                </View>

                <ProgressBar progress={score / 100} color={color} style={styles.progress} />

                <Text variant="bodyMedium" style={styles.status}>
                    {isPassing
                        ? '🚀 Qualification Threshold Met'
                        : '⚠️ Below Qualification Threshold'}
                </Text>
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
    status: {
        fontWeight: 'bold',
        textAlign: 'center',
    },
});
