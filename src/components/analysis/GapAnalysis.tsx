import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, List, Button, useTheme } from 'react-native-paper';
import { GapAnalysis as GapAnalysisType, Gap } from '../../types/analysis.types';

interface Props {
    gaps: GapAnalysisType;
}

export const GapAnalysis = ({ gaps }: Props) => {
    const theme = useTheme();

    const renderGap = (gap: Gap) => (
        <List.Item
            key={gap.skill}
            title={gap.skill}
            description={`${gap.importance.toUpperCase()} Priority • ${gap.estimatedLearningTime}`}
            left={props => <List.Icon {...props} icon="alert-rhombus" color={theme.colors.error} />}
            right={props => gap.hasTransferable ? <List.Icon {...props} icon="swap-horizontal" /> : null}
            style={styles.item}
        />
    );

    return (
        <Card style={styles.card}>
            <Card.Content>
                <Text variant="titleMedium" style={styles.title}>Critical Gaps to Close</Text>

                {gaps.criticalGaps.map(renderGap)}

                {gaps.criticalGaps.length === 0 && (
                    <Text variant="bodyMedium" style={styles.successText}>
                        No critical gaps found! You are well positioned.
                    </Text>
                )}
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: { marginBottom: 16 },
    title: { marginBottom: 8 },
    item: { padding: 0 },
    successText: { color: 'green', marginTop: 8 },
});
