import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, Chip, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MatchAnalysis, SkillMatch } from '../../types/analysis.types';
import { horizontalScale, verticalScale, moderateScale, scaleFont } from '../../utils/responsive';

interface Props {
    matchAnalysis: MatchAnalysis;
    originalMatchAnalysis?: MatchAnalysis; // To show "New Skills Acquired"
    changes?: any[]; // To identify specific user actions
    onSkillPress?: (skill: SkillMatch) => void;
}

export const SkillsComparison = ({ matchAnalysis, originalMatchAnalysis, changes, onSkillPress }: Props) => {
    const theme = useTheme();
    const [isCollapsed, setIsCollapsed] = React.useState(true);

    // STABLE MODE:
    // If we have originalMatchAnalysis AND changes, we construct the view by:
    // 1. Identifying explicitly added skills from 'changes'
    // 2. Rendering 'New Skills' based on those adds
    // 3. Rendering other categories from 'originalMatchAnalysis', filtering out the added skills
    // This prevents AI re-calc from jumping skills around.

    const manuallyAddedSkills = React.useMemo(() => {
        if (!changes) return [];
        const skillsFromChanges = changes
            .filter(c => c.type === 'add_skill' || c.type === 'missing_keyword' || c.type === 'skill_addition')
            .map(c => c.skill || c.keyword)
            .filter(Boolean);
        // Deduplicate skills (case-insensitive)
        const seen = new Set<string>();
        return skillsFromChanges.filter((skill: string) => {
            const lower = skill.toLowerCase();
            if (seen.has(lower)) return false;
            seen.add(lower);
            return true;
        });
    }, [changes]);

    const useStableMode = manuallyAddedSkills.length > 0 && !!originalMatchAnalysis;

    // View: New Skills
    const newSkills = React.useMemo(() => {
        if (useStableMode) {
            // stable mode: mapped directly from manual adds
            // we try to find the full skill object in the NEW analysis to get confidence/importance
            // if not found (unlikely), valid fallback
            return manuallyAddedSkills.map((skillName: any) => {
                const found = matchAnalysis.matchedSkills.find(s => s.skill.toLowerCase() === skillName.toLowerCase())
                    || matchAnalysis.partialMatches.find(s => s.skill.toLowerCase() === skillName.toLowerCase())
                    || { skill: skillName, importance: 'high', userHas: true, confidence: 100 } as SkillMatch;
                return { ...found, skill: skillName }; // Ensure name matches add action
            });
        }

        // Fallback or Legacy Mode (diff based)
        if (!originalMatchAnalysis) return [];

        return matchAnalysis.matchedSkills.filter(s => {
            const isMatch = originalMatchAnalysis.matchedSkills.find(orig => {
                const s1 = orig.skill.toLowerCase();
                const s2 = s.skill.toLowerCase();
                return s1 === s2 || s1.includes(s2) || s2.includes(s1);
            });
            return !isMatch;
        });
    }, [matchAnalysis, originalMatchAnalysis, manuallyAddedSkills, useStableMode]);

    // View: Matched (Original)
    const displayedMatched = React.useMemo(() => {
        if (useStableMode && originalMatchAnalysis) {
            return originalMatchAnalysis.matchedSkills;
        }
        return matchAnalysis.matchedSkills.filter(s => !newSkills.some(n => n.skill === s.skill));
    }, [useStableMode, originalMatchAnalysis, matchAnalysis, newSkills]);

    // View: Partial (Original - Added)
    const displayedPartial = React.useMemo(() => {
        if (useStableMode && originalMatchAnalysis) {
            return originalMatchAnalysis.partialMatches.filter(s =>
                !manuallyAddedSkills.some((added: any) => added.toLowerCase() === s.skill.toLowerCase())
            );
        }
        return matchAnalysis.partialMatches;
    }, [useStableMode, originalMatchAnalysis, matchAnalysis, manuallyAddedSkills]);

    // View: Missing (Original - Added)
    const displayedMissing = React.useMemo(() => {
        if (useStableMode && originalMatchAnalysis) {
            return originalMatchAnalysis.missingSkills.filter(s =>
                !manuallyAddedSkills.some((added: any) => added.toLowerCase() === s.skill.toLowerCase())
            );
        }
        return matchAnalysis.missingSkills;
    }, [useStableMode, originalMatchAnalysis, matchAnalysis, manuallyAddedSkills]);


    const renderSkillChip = (match: SkillMatch, color: string, interactive: boolean = false, isNew: boolean = false, index: number = 0) => (
        <Chip
            key={`${match.skill}-${index}`}
            style={[styles.chip, { backgroundColor: color, borderColor: isNew ? '#4CAF50' : 'transparent', borderWidth: isNew ? 2 : 0 }]} // Solid background
            textStyle={{ color: 'white', fontWeight: 'bold' }} // White text for contrast
            icon={isNew ? 'star' : (match.evidence ? 'check' : match.transferability ? 'swap-horizontal' : 'alert-circle-outline')}
            onPress={interactive && onSkillPress ? () => onSkillPress(match) : undefined}
            showSelectedOverlay={true}
        >
            {match.skill} {isNew ? "(NEW)" : ""}
        </Chip>
    );

    return (
        <Card style={styles.card}>
            <Card.Content>
                <TouchableOpacity
                    onPress={() => setIsCollapsed(!isCollapsed)}
                    style={styles.headerToggle}
                    activeOpacity={0.7}
                >
                    <Text variant="titleMedium" style={styles.title}>Skills Breakdown</Text>
                    <MaterialCommunityIcons
                        name={isCollapsed ? "chevron-down" : "chevron-up"}
                        size={24}
                        color={theme.colors.onSurfaceVariant}
                    />
                </TouchableOpacity>

                {!isCollapsed && (
                    <View style={{ marginTop: verticalScale(8) }}>
                        {matchAnalysis.executiveSummary && (
                            <View style={[styles.section, { backgroundColor: theme.colors.elevation.level1, padding: 12, borderRadius: 8 }]}>
                                <Text variant="labelSmall" style={{ color: theme.colors.primary, fontWeight: 'bold', marginBottom: 4 }}>EXECUTIVE SUMMARY</Text>
                                <Text variant="bodySmall" style={{ fontStyle: 'italic', lineHeight: 18 }}>{matchAnalysis.executiveSummary}</Text>
                            </View>
                        )}

                        {newSkills.length > 0 && (
                            <View style={styles.section}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    <MaterialCommunityIcons name="star-circle" size={16} color="#2E7D32" style={{ marginRight: 4 }} />
                                    <Text variant="bodyMedium" style={{ color: '#2E7D32', fontWeight: 'bold' }}>✨ New Skills Acquired</Text>
                                </View>
                                <View style={styles.chipRow}>
                                    {newSkills.map((s: SkillMatch, idx: number) => renderSkillChip(s, '#2E7D32', false, true, idx))}
                                </View>
                            </View>
                        )}

                        <View style={styles.section}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                <MaterialCommunityIcons name="check-decagram" size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
                                <Text variant="bodyMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>Strong Matches</Text>
                            </View>
                            <View style={styles.chipRow}>
                                {displayedMatched.map((s, idx) => renderSkillChip(s, theme.colors.primary, false, false, idx))}
                                {displayedMatched.length === 0 && newSkills.length === 0 && <Text variant="bodySmall">None</Text>}
                            </View>
                        </View>

                        <View style={styles.section}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                <MaterialCommunityIcons name="swap-horizontal-bold" size={16} color="#FF9800" style={{ marginRight: 4 }} />
                                <Text variant="bodyMedium" style={{ color: '#FF9800', fontWeight: 'bold' }}>Partial Matches (Transferable)</Text>
                            </View>
                            <Text variant="labelSmall" style={{ color: '#666', marginBottom: 4 }}>Tap to see how this transfers</Text>
                            <View style={styles.chipRow}>
                                {displayedPartial.map((s, idx) => renderSkillChip(s, '#FF9800', true, false, idx))}
                                {displayedPartial.length === 0 && <Text variant="bodySmall">None</Text>}
                            </View>
                        </View>

                        {/* If we have new detailed sections, show them with better separation */}
                        {matchAnalysis.weakMatches && matchAnalysis.weakMatches.length > 0 && (
                            <View style={styles.section}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#FB8C00" style={{ marginRight: 4 }} />
                                    <Text variant="bodyMedium" style={{ color: '#FB8C00', fontWeight: 'bold' }}>Weak Matches</Text>
                                </View>
                                <View style={styles.chipRow}>
                                    {matchAnalysis.weakMatches.map((m: any, idx: number) => (
                                        <Chip
                                            key={`weak-${idx}`}
                                            style={[styles.chip, { backgroundColor: '#FB8C00' }]}
                                            textStyle={{ color: 'white', fontWeight: 'bold' }}
                                            onPress={onSkillPress ? () => onSkillPress({
                                                skill: m.requirement || m.skill,
                                                importance: (m.importance || 'medium').toLowerCase() as any,
                                                confidence: m.confidenceScore || 0,
                                                recommendation: m.recommendation
                                            }) : undefined}
                                        >
                                            {m.requirement || m.skill}
                                        </Chip>
                                    ))}
                                </View>
                            </View>
                        )}

                        <View style={styles.section}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                <MaterialCommunityIcons name="close-circle-outline" size={16} color={theme.colors.error} style={{ marginRight: 4 }} />
                                <Text variant="bodyMedium" style={{ color: theme.colors.error, fontWeight: 'bold' }}>Critical Gaps & Missing Skills</Text>
                            </View>
                            <Text variant="labelSmall" style={{ color: '#666', marginBottom: 4 }}>Tap to add to resume</Text>
                            <View style={styles.chipRow}>
                                {displayedMissing.map((s, idx) => renderSkillChip(s, theme.colors.error, true, false, idx))}
                                {displayedMissing.length === 0 && (!matchAnalysis.noMatches || matchAnalysis.noMatches.length === 0) && <Text variant="bodySmall">None</Text>}
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
        marginBottom: verticalScale(16),
        borderRadius: moderateScale(12),
    },
    title: {
        fontSize: scaleFont(16),
        marginBottom: 0,
    },
    headerToggle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: verticalScale(4),
    },
    section: {
        marginBottom: verticalScale(16),
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: horizontalScale(8),
        marginTop: verticalScale(4),
    },
    chip: {
        marginVertical: verticalScale(4),
        height: verticalScale(32),
    },
});
