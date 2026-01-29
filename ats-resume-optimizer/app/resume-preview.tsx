import React from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Surface, Title, Divider, useTheme, Button } from 'react-native-paper';
import { useResumeStore } from '../src/store/resumeStore';
import { DocxGenerator } from '../src/services/docx/docxGenerator';

export default function ResumePreview() {
    const { currentAnalysis } = useResumeStore();
    const theme = useTheme();

    if (!currentAnalysis) {
        return (
            <View style={styles.container}>
                <Text>No analysis selected.</Text>
            </View>
        );
    }

    const optimizedResume = currentAnalysis.draftOptimizedResumeData || currentAnalysis.optimizedResume;

    if (!optimizedResume) {
        return (
            <View style={styles.container}>
                <Text>No optimized resume available to preview.</Text>
            </View>
        );
    }

    // Gating Logic
    // Gating Logic
    const { activeTasks } = require('../src/context/TaskQueueContext').useTaskQueue();
    // Check if we are strictly in a "Loading/Processing" state for THIS analysis
    const isUpdating = activeTasks.some((t: any) =>
        t.payload?.currentAnalysis?.id === currentAnalysis.id &&
        (t.type === 'optimize_resume' || t.type === 'add_skill') &&
        (t.status === 'pending' || t.status === 'processing') // Only block if actually processing
    );

    // If we have ANY optimized data (Draft or Final), we should be able to preview and download it.
    // The "isUpdating" just acts as a UI indicator.
    // However, the user explicitly requested to DISABLE download unless it is in the "Optimized" (Final) state.
    // Drafts (pending validation) should NOT be downloadable.

    const isDraft = !!currentAnalysis.draftOptimizedResumeData;

    // Allow download ONLY if we have data, it is NOT a draft, and not updating
    const canDownload = !!optimizedResume && !isDraft && !isUpdating;

    const handleDownload = async () => {
        if (!canDownload) return;
        try {
            await DocxGenerator.generateAndShare(optimizedResume);
        } catch (error) {
            console.error(error);
            Alert.alert('Export Failed', 'Could not generate DOCX file.');
        }
    };

    const formatDate = (start?: string, end?: string, current?: boolean) => {
        if (!start) return '';
        const range = `${start} - ${current ? 'Present' : end || 'Present'}`;
        return range;
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={{ paddingBottom: 100 }}>
                {/* ... existing render ... */}
                {/* Resume Paper - Adaptive Background for functionality, but keeps paper look if desired */}
                <Surface style={[styles.paper, { backgroundColor: theme.colors.surface }]} elevation={2}>
                    <View style={styles.header}>
                        <Title style={[styles.name, { color: theme.colors.onSurface }]}>{optimizedResume.contactInfo.name}</Title>
                        <Text variant="bodySmall" style={[styles.contact, { color: theme.colors.onSurfaceVariant }]}>
                            {optimizedResume.contactInfo.email} | {optimizedResume.contactInfo.phone}
                        </Text>
                        {optimizedResume.contactInfo.linkedin && (
                            <Text variant="bodySmall" style={styles.contact}>{optimizedResume.contactInfo.linkedin}</Text>
                        )}
                    </View>

                    <Divider style={styles.divider} />

                    <Section title="PROFESSIONAL SUMMARY">
                        <Text variant="bodyMedium" style={{ lineHeight: 20 }}>{optimizedResume.summary}</Text>
                    </Section>

                    <Section title="EXPERIENCE">
                        {optimizedResume.experience.map((exp: any, index: number) => (
                            <View key={index} style={{ marginBottom: 16 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>{exp.title}</Text>
                                    <Text variant="bodySmall">{formatDate(exp.startDate, exp.endDate, exp.current)}</Text>
                                </View>
                                <Text variant="bodyMedium" style={{ fontStyle: 'italic', marginBottom: 4 }}>
                                    {exp.company}
                                </Text>
                                {exp.bullets.map((bullet: string, bIndex: number) => (
                                    <View key={bIndex} style={{ flexDirection: 'row', marginBottom: 4 }}>
                                        <Text style={{ marginRight: 6 }}>•</Text>
                                        <Text variant="bodyMedium" style={{ flex: 1, lineHeight: 20 }}>{bullet}</Text>
                                    </View>
                                ))}
                            </View>
                        ))}
                    </Section>

                    <Section title="SKILLS">
                        <Text variant="bodyMedium" style={{ lineHeight: 20 }}>
                            {optimizedResume.skills.map((s: any) => s.name).join(' • ')}
                        </Text>
                    </Section>

                    {optimizedResume.education.length > 0 && (
                        <Section title="EDUCATION">
                            {optimizedResume.education.map((edu: any, index: number) => (
                                <View key={index} style={{ marginBottom: 8 }}>
                                    <Text variant="titleSmall">{edu.institution}</Text>
                                    <Text variant="bodySmall">{edu.degree} {edu.endDate ? `(${edu.endDate})` : ''}</Text>
                                </View>
                            ))}
                        </Section>
                    )}
                </Surface>
            </ScrollView>

            <View style={[styles.fabContainer, { backgroundColor: theme.colors.elevation.level2, borderTopColor: theme.colors.outline }]}>
                {!canDownload && (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 8 }}>
                        {isUpdating ? "Resume is currently updating..." : "Please validate and save changes to download."}
                    </Text>
                )}
                <Button
                    mode="contained"
                    icon="file-word"
                    onPress={handleDownload}
                    disabled={!canDownload}
                    style={[styles.fab, !canDownload && { opacity: 0.6 }]}
                >
                    {isUpdating ? "Updating Resume..." : "Download .DOCX"}
                </Button>
            </View>
        </View >
    );
}

const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <View style={styles.section}>
        <Text variant="titleSmall" style={[styles.sectionTitle, { color: useTheme().colors.onSurface }]}>{title}</Text>
        <Divider style={{ marginBottom: 8 }} />
        {children}
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // backgroundColor: '#f5f5f5',
        padding: 16,
    },
    paper: {
        backgroundColor: 'white', // Default for printing/document feel
        padding: 24,
        borderRadius: 4,
    },
    header: {
        alignItems: 'center',
        marginBottom: 16,
    },
    name: {
        fontWeight: 'bold',
        fontSize: 24,
        textTransform: 'uppercase',
    },
    contact: {
        // color: '#666', -- Handled by theme in component
    },
    divider: {
        marginBottom: 24,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontWeight: 'bold',
        letterSpacing: 1,
        // color: '#333', -- Handled by theme in component
        marginBottom: 4,
    },
    fabContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        // backgroundColor: 'rgba(255,255,255,0.9)',
        borderTopWidth: 1,
        // borderTopColor: '#e0e0e0',
    },
    fab: {
        width: '100%',
    }
});
