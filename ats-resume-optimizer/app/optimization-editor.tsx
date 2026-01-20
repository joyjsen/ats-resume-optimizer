import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useResumeStore } from '../src/store/resumeStore';

export default function OptimizationEditor() {
    const router = useRouter();
    const { currentAnalysis, setCurrentAnalysis } = useResumeStore();

    // For MVP, just allow editing the summary. 
    // In a real app, this would need a complex form for all fields.
    // Prefer DRAFT data if available
    const initialResume = currentAnalysis?.draftOptimizedResumeData || currentAnalysis?.optimizedResume;

    const [summary, setSummary] = useState(initialResume?.summary || '');
    const [experiences, setExperiences] = useState(initialResume?.experience || []);

    if (!initialResume) return null;

    const handleSave = () => {
        // Deep clone to avoid direct mutation issues
        // Use the same resume we initialized with
        const initialResume = currentAnalysis?.draftOptimizedResumeData || currentAnalysis?.optimizedResume;
        const updatedResume = JSON.parse(JSON.stringify(initialResume));

        updatedResume.summary = summary;
        updatedResume.experience = experiences;

        // If we were editing a draft, keep it as draft. If editing final, keep as final.
        // Actually, logic is: simply update the store with the modified object.
        // If we have a draft, we update draftOptimizedResumeData.
        // If we only have final, we update optimizedResume.

        const isDraft = !!currentAnalysis?.draftOptimizedResumeData;

        setCurrentAnalysis({
            ...currentAnalysis,
            [isDraft ? 'draftOptimizedResumeData' : 'optimizedResume']: updatedResume
        });

        router.back();
    };

    const updateExperienceBullet = (expIndex: number, bulletIndex: number, text: string) => {
        const newExperiences = [...experiences];
        newExperiences[expIndex].bullets[bulletIndex] = text;
        setExperiences(newExperiences);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
        >
            <ScrollView style={styles.container}>
                <Text variant="headlineSmall" style={{ marginBottom: 16 }}>Review & Edit Optimization</Text>

                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Professional Summary</Text>
                    <TextInput
                        mode="outlined"
                        multiline
                        numberOfLines={6}
                        value={summary}
                        onChangeText={setSummary}
                        style={styles.input}
                    />
                </View>

                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Experience</Text>
                    {experiences.map((exp, expIndex) => (
                        <View key={expIndex} style={styles.experienceBlock}>
                            <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>{exp.title} at {exp.company}</Text>
                            <Text variant="bodySmall" style={{ opacity: 0.7, marginBottom: 8 }}>{exp.startDate} - {exp.current ? 'Present' : exp.endDate}</Text>

                            {exp.bullets.map((bullet, bulletIndex) => (
                                <TextInput
                                    key={bulletIndex}
                                    mode="outlined"
                                    multiline
                                    value={bullet}
                                    onChangeText={(text) => updateExperienceBullet(expIndex, bulletIndex, text)}
                                    style={[styles.input, { fontSize: 13, minHeight: 60 }]}
                                    dense
                                />
                            ))}
                        </View>
                    ))}
                </View>

                <Button mode="contained" onPress={handleSave} style={{ marginBottom: 40 }}>
                    Save All Changes
                </Button>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        marginBottom: 8,
        color: '#2196F3',
        fontWeight: 'bold',
    },
    input: {
        backgroundColor: 'white',
        marginBottom: 8,
    },
    experienceBlock: {
        marginBottom: 16,
        paddingLeft: 8,
        borderLeftWidth: 2,
        borderLeftColor: '#e0e0e0',
    }
});
