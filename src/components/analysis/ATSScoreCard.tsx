import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Text, ProgressBar, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getATSScoreRecommendation } from '../../utils/scoreColors';

interface Props {
    score: number;
    originalScore?: number;
    threshold?: number;
}

export const ATSScoreCard = ({ score, originalScore, threshold = 75 }: Props) => {
    const theme = useTheme();
    const [isCollapsed, setIsCollapsed] = React.useState(false);

    const rec = getATSScoreRecommendation(score);
    const diff = originalScore !== undefined ? score - originalScore : 0;

    const expandedContent = (
        <View style={{ flexDirection: 'column', marginTop: 12, paddingBottom: 8 }}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
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

            <ProgressBar progress={score / 100} color={rec.color} style={[styles.progress, { marginBottom: 16 }]} />

            {/* Recommendation — using MaterialCommunityIcons so no Paper Avatar height issues */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                padding: 12,
                borderRadius: 8,
                borderLeftWidth: 4,
                borderColor: rec.color,
                backgroundColor: rec.color + '22', // 13% opacity tint = always visible in dark/light
                gap: 10,
            }}>
                <MaterialCommunityIcons name={rec.icon as any} size={22} color={rec.color} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                    <Text style={{ color: rec.color, fontWeight: 'bold', fontSize: 13 }}>
                        {rec.message}
                    </Text>
                    <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginTop: 4 }}>
                        {rec.description}
                    </Text>
                </View>
            </View>
        </View>
    );

    return (
        <View
            style={{
                backgroundColor: theme.colors.elevation.level2,
                borderRadius: 12,
                marginBottom: 16,
                padding: 16,
            }}
        >
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

            {Platform.OS === 'web' ? (
                // Web: use maxHeight+overflow so the parent card correctly computes its height
                <View
                    style={{
                        maxHeight: isCollapsed ? 0 : 9999,
                        overflow: 'hidden',
                    }}
                >
                    {expandedContent}
                </View>
            ) : (
                // Native: simple conditional rendering
                !isCollapsed && expandedContent
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progress: {
        height: 10,
        borderRadius: 5,
    },
});
