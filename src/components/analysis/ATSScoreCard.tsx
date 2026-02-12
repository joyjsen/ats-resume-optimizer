import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, ProgressBar, useTheme, Avatar } from 'react-native-paper';
import { getATSScoreRecommendation } from '../../utils/scoreColors';

interface Props {
    score: number;
    originalScore?: number;
    threshold?: number;
}

export const ATSScoreCard = ({ score, originalScore, threshold = 75 }: Props) => {
    const theme = useTheme();

    const rec = getATSScoreRecommendation(score);
    const diff = originalScore !== undefined ? score - originalScore : 0;

    return (
        <Card style={styles.card}>
            <Card.Content style={styles.content}>
                <View style={styles.header}>
                    <Text variant="titleMedium">ATS Compatibility Score</Text>
                </View>
                <View style={{ alignItems: 'center', marginVertical: 4 }}>
                    <Text variant="displayMedium" style={{ color: rec.color, fontWeight: 'bold' }}>{score}%</Text>
                    {originalScore !== undefined && diff !== 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <Text variant="titleSmall" style={{ color: '#999', textDecorationLine: 'line-through', marginRight: 10 }}>
                                {originalScore}%
                            </Text>
                            <Text variant="titleMedium" style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                                +{diff}% ⬆️
                            </Text>
                        </View>
                    )}
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
