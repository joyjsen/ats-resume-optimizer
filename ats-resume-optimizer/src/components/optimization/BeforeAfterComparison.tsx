import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Card, Text, SegmentedButtons, Divider, useTheme } from 'react-native-paper';
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
    // Priority: Check 'changes' log for explicit additions. If empty, fall back to Diff.
    const addedSkillsList = React.useMemo(() => {
        // Strategy 1: Explicit Log (Most Accurate as per user request)
        const explicitSkills = changes
            .filter(c => c.type === 'skill_addition' && c.skill)
            .map(c => c.skill || '');

        if (explicitSkills.length > 0) {
            // De-duplicate
            return Array.from(new Set(explicitSkills));
        }

        // Strategy 2: Diff (Fallback for full optimizations)
        if (!optimized.skills || !original.skills) return [];
        return optimized.skills
            .filter(s => !original.skills.some(os => normalize(os.name) === normalize(s.name)))
            .map(s => s.name);
    }, [original.skills, optimized.skills, changes]);

    // Dynamically determine available sections based on changes AND actual data diffs
    const availableSections = React.useMemo(() => {
        const sections = new Set<string>();

        // 1. Check change logs (Explicit intent)
        changes.forEach(c => {
            if (c.section) sections.add(c.section.toLowerCase());
            // Map specific types to sections if section name is missing/generic
            if (c.type.includes('skill')) sections.add('skills');
            if (c.type.includes('summary')) sections.add('summary');
            if (c.type.includes('experience') || c.type.includes('bullet')) sections.add('experience');
        });

        // 2. Check Data Diffs (Implicit reality)
        if (addedSkillsList.length > 0) sections.add('skills');

        // Ensure core sections exist if data is present
        if (optimized.summary) sections.add('summary');
        if (optimized.experience?.length > 0) sections.add('experience');
        if (optimized.skills?.length > 0) sections.add('skills');

        // Sort: Summary -> Experience -> Skills -> Others
        const order = ['summary', 'experience', 'skills'];
        return Array.from(sections).sort((a, b) => {
            const idxA = order.indexOf(a);
            const idxB = order.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [changes, optimized, addedSkillsList]);

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

    const renderExperienceComparison = () => {
        if (!optimized.experience || optimized.experience.length === 0) {
            return <Text>No experience data found.</Text>;
        }

        return (
            <View>
                {optimized.experience.map((optRole, index) => {
                    const isExpanded = expandedRoles.has(index);

                    // Find matching original role (Improved Matcher)
                    // 1. Try ID
                    // 2. Try Exact Title/Company
                    // 3. Try Normalized Title/Company
                    // 4. Try looser Company containment (if "Google Inc" vs "Google")
                    let orgRole = original.experience.find(e => e.id && e.id === optRole.id);

                    if (!orgRole) {
                        orgRole = original.experience.find(e =>
                            normalize(e.company) === normalize(optRole.company) &&
                            normalize(e.title) === normalize(optRole.title)
                        );
                    }

                    // Fallback: If company is same and titles are close? 
                    // Or if not found, rely on index IF and ONLY IF the arrays are same length (risky but better than nothing)
                    if (!orgRole && original.experience.length === optimized.experience.length) {
                        orgRole = original.experience[index];
                    }

                    // Find modified/new bullets by Fuzzy Diffing
                    const modifiedBullets = optRole.bullets.filter(bullet => {
                        // If we couldn't find the original role, we shouldn't mark everything as new out of caution,
                        // UNLESS we are sure it's a new role. But "Optimization" rarely adds roles.
                        // If no orgRole found, let's assume it IS a new role for now, but this might be the source of "everything updated" bug.
                        // FIX: If we can't find orgRole, it's safer to show NO changes than ALL changes for an existing role.
                        // But if the User ADDED a role, we want to show it.
                        // Compromise: normalized matching is robust enough. If failed, it's virtually new.

                        if (!orgRole || !orgRole.bullets) return true;

                        // Check for approximate match
                        const nBullet = normalize(bullet);
                        return !orgRole.bullets.some(orgBullet => normalize(orgBullet) === nBullet);
                    });

                    const hasChanges = modifiedBullets.length > 0;

                    return (
                        <View key={index} style={{ marginBottom: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 8, overflow: 'hidden' }}>
                            <TouchableOpacity
                                onPress={() => toggleRole(index)}
                                style={{ padding: 12, backgroundColor: '#FAFAFA', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                                        {optRole.title}
                                    </Text>
                                    <Text variant="bodySmall" style={{ color: '#666' }}>
                                        {optRole.company}
                                    </Text>
                                </View>
                                {hasChanges && (
                                    <View style={{ backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginRight: 8 }}>
                                        <Text style={{ color: '#2E7D32', fontSize: 10, fontWeight: 'bold' }}>UPDATED</Text>
                                    </View>
                                )}
                                <Text style={{ fontSize: 18, color: '#999' }}>{isExpanded ? '−' : '+'}</Text>
                            </TouchableOpacity>

                            {isExpanded && (
                                <View style={{ padding: 12, paddingTop: 4 }}>
                                    {modifiedBullets.length > 0 ? (
                                        modifiedBullets.map((bullet, bIndex) => (
                                            <View key={bIndex} style={[styles.bulletRow, styles.highlight]}>
                                                <Text style={{ lineHeight: 20 }}>
                                                    <Text style={{ fontWeight: 'bold', color: '#2E7D32' }}>• </Text>
                                                    {bullet}
                                                </Text>
                                            </View>
                                        ))
                                    ) : (
                                        <Text style={{ fontStyle: 'italic', color: '#666', paddingVertical: 8 }}>
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

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toggle}>
                    <SegmentedButtons
                        value={section}
                        onValueChange={setSection}
                        buttons={availableSections.map(s => ({
                            value: s,
                            label: s.charAt(0).toUpperCase() + s.slice(1)
                        }))}
                        density="medium"
                    />
                </ScrollView>

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
