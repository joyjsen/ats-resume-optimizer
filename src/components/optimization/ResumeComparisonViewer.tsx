import React, { useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Modal, Platform, Dimensions } from 'react-native';
import { Text, Button, IconButton, useTheme, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ParsedResume, OptimizationChange } from '../../types/resume.types';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
    visible: boolean;
    onClose: () => void;
    original: ParsedResume;
    optimized: ParsedResume;
    changes: OptimizationChange[];
}

// Normalize text for comparison (ignore case, punctuation, whitespace)
const normalize = (text: string) =>
    text?.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim() || '';

export const ResumeComparisonViewer = ({ visible, onClose, original, optimized, changes }: Props) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<'original' | 'optimized'>('optimized');

    // --- Diff computations (memoized) ---

    const summaryChanged = useMemo(() => {
        if (!original?.summary || !optimized?.summary) return false;
        return normalize(original.summary) !== normalize(optimized.summary);
    }, [original?.summary, optimized?.summary]);

    const addedSkills = useMemo(() => {
        if (!optimized?.skills || !original?.skills) return [];
        return optimized.skills.filter(
            s => !original.skills.some(os => normalize(os.name) === normalize(s.name))
        );
    }, [original?.skills, optimized?.skills]);

    const addedSkillNames = useMemo(
        () => new Set(addedSkills.map(s => normalize(s.name))),
        [addedSkills]
    );

    // For each experience role, find modified bullets
    const experienceDiffs = useMemo(() => {
        if (!optimized?.experience) return [];
        return optimized.experience.map((optRole, index) => {
            let orgRole = original?.experience?.find(e => e.id && e.id === optRole.id);
            if (!orgRole) {
                orgRole = original?.experience?.find(e =>
                    normalize(e.company) === normalize(optRole.company) &&
                    normalize(e.title) === normalize(optRole.title)
                );
            }
            if (!orgRole && original?.experience?.length === optimized.experience.length) {
                orgRole = original.experience[index];
            }

            const modifiedBulletIndices = new Set<number>();
            const allBullets = optRole.bullets || optRole.bulletPoints || [];
            allBullets.forEach((bullet, i) => {
                if (!orgRole) { modifiedBulletIndices.add(i); return; }
                const orgBullets = orgRole.bullets || orgRole.bulletPoints || [];
                if (orgBullets.length === 0) { modifiedBulletIndices.add(i); return; }
                const nBullet = normalize(bullet);
                if (!orgBullets.some(ob => normalize(ob) === nBullet)) {
                    modifiedBulletIndices.add(i);
                }
            });

            return { role: optRole, orgRole, modifiedBulletIndices, hasChanges: modifiedBulletIndices.size > 0 };
        });
    }, [original?.experience, optimized?.experience]);

    const totalChanges = useMemo(() => {
        let count = summaryChanged ? 1 : 0;
        count += addedSkills.length;
        experienceDiffs.forEach(d => { count += d.modifiedBulletIndices.size; });
        return count;
    }, [summaryChanged, addedSkills, experienceDiffs]);

    // --- Formatters ---
    const formatDate = (start?: string, end?: string, current?: boolean) => {
        if (!start) return '';
        return `${start} - ${current ? 'Present' : end || 'Present'}`;
    };

    // --- Renderers ---
    const renderResume = (resume: ParsedResume, isOptimized: boolean) => {
        if (!resume) return <Text>No resume data available.</Text>;

        return (
            <View style={[styles.paper, { backgroundColor: theme.colors.surface }]}>
                {/* Contact Info */}
                <View style={styles.contactHeader}>
                    <Text style={[styles.name, { color: theme.colors.onSurface }]}>
                        {resume.contactInfo?.name || 'Name Not Found'}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                        {[resume.contactInfo?.email, resume.contactInfo?.phone, resume.contactInfo?.location]
                            .filter(Boolean).join(' | ')}
                    </Text>
                    {resume.contactInfo?.linkedin && (
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                            {resume.contactInfo.linkedin}
                        </Text>
                    )}
                </View>

                <Divider style={{ marginBottom: 16 }} />

                {/* Summary */}
                {resume.summary && (
                    <View style={[
                        styles.section,
                        isOptimized && summaryChanged && {
                            borderLeftWidth: 4,
                            borderLeftColor: '#4CAF50',
                            backgroundColor: theme.dark ? '#1B3A1B' : '#F1F8E9',
                            borderRadius: 6,
                            paddingLeft: 12,
                            paddingVertical: 8,
                            paddingRight: 8,
                        },
                    ]}>
                        <Text style={styles.sectionTitle}>PROFESSIONAL SUMMARY</Text>
                        <Divider style={{ marginBottom: 8 }} />
                        <Text variant="bodyMedium" style={{ lineHeight: 22 }}>{resume.summary}</Text>
                        {isOptimized && summaryChanged && (
                            <View style={styles.changeBadge}>
                                <MaterialCommunityIcons name="pencil" size={12} color={theme.dark ? '#81C784' : '#2E7D32'} />
                                <Text style={[styles.changeBadgeText, { color: theme.dark ? '#81C784' : '#2E7D32' }]}>Modified</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Experience */}
                {resume.experience && resume.experience.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>EXPERIENCE</Text>
                        <Divider style={{ marginBottom: 8 }} />
                        {resume.experience.map((exp, expIdx) => {
                            const diff = isOptimized ? experienceDiffs[expIdx] : null;
                            const bullets = exp.bullets || exp.bulletPoints || [];

                            return (
                                <View key={expIdx} style={{ marginBottom: 16 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                                        <Text variant="titleSmall" style={{ fontWeight: 'bold', flex: 1 }}>
                                            {exp.title}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {formatDate(exp.startDate, exp.endDate, exp.current)}
                                        </Text>
                                    </View>
                                    <Text variant="bodyMedium" style={{ fontStyle: 'italic', marginBottom: 6, color: theme.colors.onSurfaceVariant }}>
                                        {exp.company}{exp.location ? ` — ${exp.location}` : ''}
                                    </Text>
                                    {bullets.map((bullet, bIdx) => {
                                        const isModified = diff?.modifiedBulletIndices.has(bIdx);
                                        return (
                                            <View
                                                key={bIdx}
                                                style={[
                                                    styles.bulletRow,
                                                    isOptimized && isModified && {
                                                        backgroundColor: theme.dark ? '#1B3A1B' : '#E8F5E9',
                                                        borderLeftWidth: 3,
                                                        borderLeftColor: '#4CAF50',
                                                        paddingLeft: 8,
                                                    },
                                                ]}
                                            >
                                                <Text style={{ marginRight: 6, color: isOptimized && isModified ? (theme.dark ? '#81C784' : '#2E7D32') : theme.colors.onSurface }}>•</Text>
                                                <Text variant="bodyMedium" style={{ flex: 1, lineHeight: 20 }}>{bullet}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Skills */}
                {resume.skills && resume.skills.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>SKILLS</Text>
                        <Divider style={{ marginBottom: 8 }} />
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {resume.skills.map((skill, idx) => {
                                const isNew = isOptimized && addedSkillNames.has(normalize(skill.name));
                                return (
                                    <View
                                        key={idx}
                                        style={[
                                            styles.skillChip,
                                            { backgroundColor: theme.colors.secondaryContainer },
                                            isNew && { backgroundColor: theme.dark ? '#1B3A1B' : '#E8F5E9', borderWidth: 1, borderColor: '#4CAF50' },
                                        ]}
                                    >
                                        <Text style={[
                                            { color: theme.colors.onSecondaryContainer, fontSize: 13 },
                                            isNew && { color: theme.dark ? '#81C784' : '#2E7D32', fontWeight: 'bold' },
                                        ]}>
                                            {isNew ? `✨ ${skill.name}` : skill.name}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Education */}
                {resume.education && resume.education.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>EDUCATION</Text>
                        <Divider style={{ marginBottom: 8 }} />
                        {resume.education.map((edu, idx) => (
                            <View key={idx} style={{ marginBottom: 8 }}>
                                <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>
                                    {edu.degree}{edu.field ? ` in ${edu.field}` : ''}
                                </Text>
                                <Text variant="bodySmall">{edu.institution}</Text>
                                {(edu.startDate || edu.endDate) && (
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {edu.startDate || ''}{edu.endDate ? ` - ${edu.endDate}` : ''}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {/* Certifications */}
                {resume.certifications && resume.certifications.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>CERTIFICATIONS</Text>
                        <Divider style={{ marginBottom: 8 }} />
                        {resume.certifications.map((cert, idx) => (
                            <View key={idx} style={{ marginBottom: 4 }}>
                                <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>{cert.name}</Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                    {cert.issuer}{cert.date ? ` • ${cert.date}` : ''}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Projects */}
                {resume.projects && resume.projects.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>PROJECTS</Text>
                        <Divider style={{ marginBottom: 8 }} />
                        {resume.projects.map((proj, idx) => (
                            <View key={idx} style={{ marginBottom: 12 }}>
                                <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>{proj.name}</Text>
                                <Text variant="bodySmall">{proj.description}</Text>
                                {proj.technologies && proj.technologies.length > 0 && (
                                    <Text variant="bodySmall" style={{ color: theme.colors.primary, marginTop: 2 }}>
                                        {proj.technologies.join(' • ')}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outlineVariant }]}>
                    <View style={{ flex: 1 }}>
                        <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Resume Comparison</Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                            {totalChanges} change{totalChanges !== 1 ? 's' : ''} highlighted
                        </Text>
                    </View>
                    <IconButton icon="close" onPress={onClose} />
                </View>

                {/* Tab Toggle */}
                <View style={[styles.tabContainer, { borderBottomColor: theme.colors.outlineVariant }]}>
                    <Button
                        mode={activeTab === 'original' ? 'contained' : 'outlined'}
                        onPress={() => setActiveTab('original')}
                        style={{ flex: 1, marginRight: 4 }}
                        compact
                        icon="file-document-outline"
                    >
                        Original
                    </Button>
                    <Button
                        mode={activeTab === 'optimized' ? 'contained' : 'outlined'}
                        onPress={() => setActiveTab('optimized')}
                        style={{ flex: 1, marginLeft: 4 }}
                        compact
                        icon="file-check"
                        buttonColor={activeTab === 'optimized' ? theme.colors.primary : undefined}
                    >
                        Optimized
                    </Button>
                </View>

                {/* Content */}
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {activeTab === 'original'
                        ? renderResume(original, false)
                        : renderResume(optimized, true)
                    }
                </ScrollView>

                {/* Legend + Close */}
                <View style={[styles.footer, {
                    backgroundColor: theme.colors.surface,
                    borderTopColor: theme.colors.outlineVariant,
                    paddingBottom: Math.max(insets.bottom, 16) + 8,
                }]}>
                    {activeTab === 'optimized' && (
                        <View style={styles.legend}>
                            <View style={[styles.legendDot, { backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#4CAF50' }]} />
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>AI Enhanced Content</Text>
                        </View>
                    )}
                    <Button mode="contained" onPress={onClose} style={{ marginTop: 8 }}>
                        Close
                    </Button>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        paddingTop: 20,
        borderBottomWidth: 1,
    },
    tabContainer: {
        flexDirection: 'row',
        padding: 12,
        borderBottomWidth: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    paper: {
        padding: 20,
        borderRadius: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    contactHeader: {
        alignItems: 'center',
        marginBottom: 12,
    },
    name: {
        fontWeight: 'bold',
        fontSize: 22,
        textTransform: 'uppercase',
        textAlign: 'center',
        marginBottom: 4,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontWeight: 'bold',
        letterSpacing: 1.5,
        fontSize: 13,
        marginBottom: 4,
        color: '#555',
    },
    highlightedSection: {
        borderLeftWidth: 4,
        borderLeftColor: '#4CAF50',
        backgroundColor: '#F1F8E9',
        borderRadius: 6,
        paddingLeft: 12,
        paddingVertical: 8,
        paddingRight: 8,
    },
    bulletRow: {
        flexDirection: 'row',
        marginBottom: 4,
        paddingVertical: 2,
        paddingHorizontal: 4,
        borderRadius: 4,
    },
    highlightedBullet: {
        backgroundColor: '#E8F5E9',
        borderLeftWidth: 3,
        borderLeftColor: '#4CAF50',
        paddingLeft: 8,
    },
    skillChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 16,
    },
    changeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    changeBadgeText: {
        fontSize: 11,
        color: '#2E7D32',
        fontWeight: '600',
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
    },
    legend: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 6,
    },
});
