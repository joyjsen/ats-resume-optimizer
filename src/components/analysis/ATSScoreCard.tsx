import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, ProgressBar, useTheme, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getATSScoreRecommendation } from '../../utils/scoreColors';

interface Props {
    score: number;
    originalScore?: number;
    threshold?: number;
}

export const ATSScoreCard = ({ score, originalScore, threshold = 75 }: Props) => {
    const theme = useTheme();
    const [isCollapsed, setIsCollapsed] = React.useState(true);

    const rec = getATSScoreRecommendation(score);
    const diff = originalScore !== undefined ? score - originalScore : 0;

    return (
        <Card style={styles.card}>
            <Card.Content style={styles.content}>
                <TouchableOpacity
                    onPress={() => setIsCollapsed(!isCollapsed)}
                    style={styles.header}
                    activeOpacity={0.7}
                >
                    <Text variant="titleMedium">ATS Compatibility Score</Text>
                    <MaterialCommunityIcons
                        name={isCollapsed ? "chevron-down" : "chevron-up"}
                        size={24}
                        color={theme.colors.onSurfaceVariant}
                    />
                </TouchableOpacity>

                {!isCollapsed && (
                    <View style={{ gap: 12 }}>
                        <View style={{ alignItems: 'center', marginVertical: 4 }}>
                            <Text style={{ color: rec.color, fontWeight: 'bold', fontSize: 18 }}>{score}%</Text>
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
                            <Avatar.Icon size={32} icon={rec.icon} style={{ backgroundColor: rec.color, marginTop: 2 }} color="white" />
                            <View style={{ flex: 1, paddingRight: 4 }}>
                                <Text
                                    variant="titleSmall"
                                    style={{ color: rec.color, fontWeight: 'bold' }}
                                >
                                    {rec.message}
                                </Text>
                                <Text
                                    variant="bodySmall"
                                    style={{ color: '#444', marginTop: 2, flexWrap: 'wrap' }}
                                >
                                    {rec.description}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}
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
        alignItems: 'flex-start', // Changed from center to allow multiline growth
        padding: 12,
        borderRadius: 8,
        gap: 12,
        borderLeftWidth: 4,
        marginTop: 8
    }
});
