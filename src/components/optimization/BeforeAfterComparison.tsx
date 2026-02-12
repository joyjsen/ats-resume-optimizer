import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Card, Text, Divider, useTheme } from 'react-native-paper';
import { ParsedResume, OptimizationChange, Experience } from '../../types/resume.types';

interface Props {
    original: ParsedResume;
    optimized: ParsedResume;
    changes: OptimizationChange[];
}

export const BeforeAfterComparison = ({ original, optimized, changes }: Props) => {
    const theme = useTheme();

    // Helper: Normalize text for comparison (ignore case, punctuation, whitespace)
    const normalize = (text: string) => {
        return text?.toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ')    // Collapse whitespace
            .trim() || '';
    };

    // Helper to calculate added skills dynamically
    const addedSkillsList = React.useMemo(() => {
        const addedSet = new Set<string>();

        // Strategy 1: Explicit Log (What triggered the recent change)
        changes
            .filter(c => c.type === 'skill_addition' && c.skill)
            .forEach(c => addedSet.add(c.skill || ''));

        // Strategy 2: Diff (Historical / Full Comparison)
        // Now that we pass 'original' as the absolute baseline, this catches ALL skills added since start.
        if (optimized.skills && original.skills) {
            optimized.skills.forEach(s => {
                const existsInOriginal = original.skills.some(os => normalize(os.name) === normalize(s.name));
                if (!existsInOriginal) {
                    addedSet.add(s.name);
                }
            });
        }

        return Array.from(addedSet);
    }, [original.skills, optimized.skills, changes]);

    // Dynamically determine available sections based on changes AND actual data diffs
    // Only allow these three tabs - no individual position/role tabs
    const allowedTabs = ['summary', 'experience', 'skills'];

    const availableSections = React.useMemo(() => {
        const sections = new Set<string>();

        // 1. Check change logs (Explicit intent from AI) — map to allowed tabs only
        changes.forEach(c => {
            const type = c.type || '';
            if (type.includes('skill') || type.includes('keyword')) sections.add('skills');
            if (type.includes('summary') || type.includes('professional')) sections.add('summary');
            if (type.includes('experience') || type.includes('bullet') || type.includes('enhancement') || type.includes('rewrite')) sections.add('experience');
        });

        // 2. Check Data Diffs (Implicit reality) - Only add sections with ACTUAL changes
        if (addedSkillsList.length > 0) sections.add('skills');

        // Check if summary was actually modified
        if (optimized.summary && original.summary && normalize(optimized.summary) !== normalize(original.summary)) {
            sections.add('summary');
        }

        // Check if experience has actual modified bullets
        if (optimized.experience && original.experience) {
            const hasExperienceChanges = optimized.experience.some((optRole) => {
                let orgRole = original.experience?.find(e => e.id && e.id === optRole.id);
                if (!orgRole) {
                    orgRole = original.experience?.find(e =>
                        normalize(e.company) === normalize(optRole.company) &&
                        normalize(e.title) === normalize(optRole.title)
                    );
                }
                if (!orgRole) return false;

                const modifiedBullets = optRole.bullets?.filter(bullet => {
                    const nBullet = normalize(bullet);
                    return !orgRole?.bullets?.some(orgBullet => normalize(orgBullet) === nBullet);
                }) || [];

                return modifiedBullets.length > 0;
            });

            if (hasExperienceChanges) sections.add('experience');
        }

        // Filter to only allowed tabs, maintain order: Summary -> Experience -> Skills
        return allowedTabs.filter(tab => sections.has(tab));
    }, [changes, optimized, addedSkillsList, original, normalize]);

    const [section, setSection] = useState(availableSections[0] || 'summary');

    // Update section if available sections change and current is invalid
    React.useEffect(() => {
        if (!availableSections.includes(section) && availableSections.length > 0) {
            setSection(availableSections[0]);
        }
    }, [availableSections]);

    // Track expanded experience roles (by index for simplicity)
    const [expandedRoles, setExpandedRoles] = useState<Set<number>>(new Set());

    const toggleRole = (index: number) => {
        const next = new Set(expandedRoles);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        setExpandedRoles(next);
    };

    const renderSummaryComparison = () => (
        <View>
            <Text variant="titleSmall" style={styles.label}>Original Summary</Text>
            <Text style={styles.text}>{original.summary || 'None'}</Text>

            <Divider style={styles.divider} />

            <Text variant="titleSmall" style={[styles.label, { color: theme.colors.primary }]}>Optimized Summary</Text>
            <Text style={styles.text}>{optimized.summary}</Text>
        </View>
    );

    const renderSkillsComparison = () => {
        return (
            <View>
                <Text variant="titleSmall" style={styles.label}>Skills Updates</Text>

                {addedSkillsList.length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        {addedSkillsList.map((skill, i) => (
                            <View key={i} style={{ backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: '#4CAF50' }}>
                                <Text style={{ color: '#2E7D32', fontWeight: 'bold' }}>+ {skill}</Text>
                            </View>
                        ))}
                    </View>
                ) : (
                    <Text style={{ fontStyle: 'italic', color: '#666', marginTop: 4 }}>
                        No specific skills were added in this session.
                    </Text>
                )}

                <Divider style={styles.divider} />

                <Text variant="titleSmall" style={[styles.label, { marginTop: 8 }]}>Full Skill List ({optimized.skills.length})</Text>
                <Text style={styles.text}>
                    {optimized.skills.map(s => s.name).join(' • ')}
                </Text>
            </View>
        );
    };

    const experienceComparison = React.useMemo(() => {
        if (!optimized.experience || optimized.experience.length === 0) {
            return <Text>No experience data found.</Text>;
        }

        return (
            <View>
                {optimized.experience.map((optRole, index) => {
                    // Logic moved inside map, but the whole map result is memoized now.
                    // However, we need to handle expanded roles state which changes.
                    // Splitting into a child component would be cleaner, but for now we memoize the CALCULATION of changes.
                    // Alternatively, we memoize the list of roles and their 'hasChanges' status/modifiedBullets.
                    return null;
                })}
            </View>
        );
    }, [optimized.experience, original.experience, expandedRoles, theme.colors]); // expandedRoles dependency breaks memoization of the heavy lift.

    // Better Approach: Calculate the diffs ONCE when data changes.
    const experienceDiffs = React.useMemo(() => {
        if (!optimized.experience) return [];

        return optimized.experience.map((optRole, index) => {
            let orgRole = original.experience.find(e => e.id && e.id === optRole.id);

            if (!orgRole) {
                orgRole = original.experience.find(e =>
                    normalize(e.company) === normalize(optRole.company) &&
                    normalize(e.title) === normalize(optRole.title)
                );
            }

            if (!orgRole && original.experience.length === optimized.experience.length) {
                orgRole = original.experience[index];
            }

            const modifiedBullets = optRole.bullets.filter(bullet => {
                if (!orgRole || !orgRole.bullets) return true;
                const nBullet = normalize(bullet);
                return !orgRole.bullets.some(orgBullet => normalize(orgBullet) === nBullet);
            });

            return {
                optRole,
                hasChanges: modifiedBullets.length > 0,
                modifiedBullets
            };
        });
    }, [optimized.experience, original.experience]);

    const renderExperienceComparison = () => {
        if (!optimized.experience || optimized.experience.length === 0) {
            return <Text>No experience data found.</Text>;
        }

        return (
            <View>
                {experienceDiffs.map((diff, index) => {
                    const { optRole, hasChanges, modifiedBullets } = diff;
                    const isExpanded = expandedRoles.has(index);

                    return (
                        <View key={index} style={{ marginBottom: 12, borderWidth: 1, borderColor: theme.colors.outline, borderRadius: 8, overflow: 'hidden' }}>
                            <TouchableOpacity
                                onPress={() => toggleRole(index)}
                                style={{ padding: 12, backgroundColor: theme.colors.elevation.level1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                                        {optRole.title}
                                    </Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {optRole.company}
                                    </Text>
                                </View>
                                {hasChanges && (
                                    <View style={{ backgroundColor: theme.dark ? '#1B5E20' : '#E8F5E9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginRight: 8 }}>
                                        <Text style={{ color: theme.dark ? '#A5D6A7' : '#2E7D32', fontSize: 10, fontWeight: 'bold' }}>UPDATED</Text>
                                    </View>
                                )}
                                <Text style={{ fontSize: 18, color: theme.colors.onSurface }}>{isExpanded ? '−' : '+'}</Text>
                            </TouchableOpacity>

                            {isExpanded && (
                                <View style={{ padding: 12, paddingTop: 4 }}>
                                    {modifiedBullets.length > 0 ? (
                                        modifiedBullets.map((bullet, bIndex) => (
                                            <View key={bIndex} style={[styles.bulletRow, { backgroundColor: theme.dark ? '#333' : '#f0f0f0', borderRadius: 4 }]}>
                                                <Text style={{ lineHeight: 20, color: theme.colors.onSurface }}>
                                                    <Text style={{ fontWeight: 'bold', color: theme.dark ? '#81C784' : '#2E7D32' }}>• </Text>
                                                    {bullet}
                                                </Text>
                                            </View>
                                        ))
                                    ) : (
                                        <Text style={{ fontStyle: 'italic', color: theme.colors.onSurfaceDisabled, paddingVertical: 8 }}>
                                            No significant content changes detected in this role.
                                        </Text>
                                    )}
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderContent = () => {
        switch (section) {
            case 'summary': return renderSummaryComparison();
            case 'experience': return renderExperienceComparison();
            case 'skills': return renderSkillsComparison();
            default: return <Text>Comparison details for {section} are not yet available.</Text>;
        }
    };

    if (availableSections.length === 0) return null;

    return (
        <Card style={styles.card}>
            <Card.Content>
                <Text variant="titleMedium" style={styles.title}>Optimization Preview</Text>

                <View style={[styles.toggle, { flexDirection: 'row', borderRadius: 8, borderWidth: 1, borderColor: theme.colors.outline, overflow: 'hidden' }]}>
                    {availableSections.map((s, idx) => (
                        <TouchableOpacity
                            key={s}
                            onPress={() => setSection(s)}
                            style={{
                                flex: 1,
                                paddingVertical: 10,
                                paddingHorizontal: 16,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: section === s ? theme.colors.secondaryContainer : 'transparent',
                                borderRightWidth: idx < availableSections.length - 1 ? 1 : 0,
                                borderRightColor: theme.colors.outline,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 14,
                                    fontWeight: section === s ? 'bold' : '500',
                                    color: section === s ? theme.colors.onSecondaryContainer : theme.colors.onSurface,
                                }}
                                numberOfLines={1}
                            >
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {renderContent()}

                <View style={styles.legend}>
                    <View style={[styles.legendDot, { backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#4CAF50' }]} />
                    <Text variant="bodySmall">AI Enhanced Content</Text>
                </View>
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: { marginBottom: 16 },
    title: { marginBottom: 12 },
    toggle: { marginBottom: 16 },
    label: { marginBottom: 4, fontWeight: 'bold' },
    text: { opacity: 0.8, lineHeight: 20 },
    divider: { marginVertical: 12 },
    bulletRow: { marginVertical: 4, padding: 4 },
    highlight: { backgroundColor: '#f0f0f0', borderRadius: 4 }, // Ideally use theme color
    legend: { flexDirection: 'row', alignItems: 'center', marginTop: 16, justifyContent: 'flex-end' },
    legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
});
