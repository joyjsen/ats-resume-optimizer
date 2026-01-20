import React from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Surface, Title, Divider, useTheme, Button } from 'react-native-paper';
import { useResumeStore } from '../src/store/resumeStore';
import { DocxGenerator } from '../src/services/docx/docxGenerator';

export default function ResumePreview() {
    const { currentAnalysis } = useResumeStore();
    const theme = useTheme();

    const optimizedResume = currentAnalysis.draftOptimizedResumeData || currentAnalysis.optimizedResume;

    if (!optimizedResume) {
        return (
            <View style={styles.container}>
                <Text>No optimized resume available to preview.</Text>
            </View>
        );
    }

    const handleDownload = async () => {
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
        <View style={{ flex: 1 }}>
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
                <Surface style={styles.paper} elevation={2}>
                    <View style={styles.header}>
                        <Title style={styles.name}>{optimizedResume.contactInfo.name}</Title>
                        <Text variant="bodySmall" style={styles.contact}>
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
                        {optimizedResume.experience.map((exp, index) => (
                            <View key={index} style={{ marginBottom: 16 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>{exp.title}</Text>
                                    <Text variant="bodySmall">{formatDate(exp.startDate, exp.endDate, exp.current)}</Text>
                                </View>
                                <Text variant="bodyMedium" style={{ fontStyle: 'italic', marginBottom: 4 }}>
                                    {exp.company}
                                </Text>
                                {exp.bullets.map((bullet, bIndex) => (
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
                            {optimizedResume.skills.map(s => s.name).join(' • ')}
                        </Text>
                    </Section>

                    {optimizedResume.education.length > 0 && (
                        <Section title="EDUCATION">
                            {optimizedResume.education.map((edu, index) => (
                                <View key={index} style={{ marginBottom: 8 }}>
                                    <Text variant="titleSmall">{edu.institution}</Text>
                                    <Text variant="bodySmall">{edu.degree} {edu.endDate ? `(${edu.endDate})` : ''}</Text>
                                </View>
                            ))}
                        </Section>
                    )}
                </Surface>
            </ScrollView>

            <View style={styles.fabContainer}>
                <Button
                    mode="contained"
                    icon="file-word"
                    onPress={handleDownload}
                    style={styles.fab}
                >
                    Download .DOCX
                </Button>
            </View>
        </View >
    );
}

const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <View style={styles.section}>
        <Text variant="titleSmall" style={styles.sectionTitle}>{title}</Text>
        <Divider style={{ marginBottom: 8 }} />
        {children}
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 16,
    },
    paper: {
        backgroundColor: 'white',
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
        color: '#666',
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
        color: '#333',
        marginBottom: 4,
    },
    fabContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    fab: {
        width: '100%',
    }
});
