import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { TextInput, Button, Text, useTheme, Portal, Dialog } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useResumeStore } from '../src/store/resumeStore';
import { useProfileStore } from '../src/store/profileStore';
import { resumeOptimizerService } from '../src/services/ai/resumeOptimizer';
import { activityService } from '../src/services/firebase/activityService';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function OptimizationEditor() {
    const router = useRouter();
    const { currentAnalysis, setCurrentAnalysis } = useResumeStore();
    const { userProfile, refreshProfile, fetchUserStats, subscribeToProfile } = useProfileStore();
    const theme = useTheme();

    // Prefer DRAFT data if available
    const initialResume = currentAnalysis?.draftOptimizedResumeData || currentAnalysis?.optimizedResume;

    const [summary, setSummary] = useState(initialResume?.summary || '');
    const [experiences, setExperiences] = useState(initialResume?.experience || []);
    const [enhancingField, setEnhancingField] = useState<string | null>(null);
    const [saveDialogVisible, setSaveDialogVisible] = useState(false);

    // Subscribe to real-time profile updates for token balance
    useEffect(() => {
        if (userProfile?.uid) {
            const unsubscribe = subscribeToProfile(userProfile.uid);
            return () => unsubscribe();
        }
    }, [userProfile?.uid]);

    if (!initialResume) return null;

    const handleSave = () => {
        const initialResume = currentAnalysis?.draftOptimizedResumeData || currentAnalysis?.optimizedResume;
        const updatedResume = JSON.parse(JSON.stringify(initialResume));

        updatedResume.summary = summary;
        updatedResume.experience = experiences;

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

    const handleEnhance = async (text: string, section: string, updateFn: (newText: string) => void, fieldId: string) => {
        if (!text || text.trim().length < 10) {
            Alert.alert("Content Required", "Please enter some text first so the AI can enhance it.");
            return;
        }

        if ((userProfile?.tokenBalance || 0) < 2) {
            Alert.alert("Insufficient Tokens", "AI enhancement costs 2 tokens. Please top up your balance.");
            return;
        }

        setEnhancingField(fieldId);
        try {
            const enhancedText = await resumeOptimizerService.enhanceText(
                text,
                {
                    title: currentAnalysis?.job?.title || 'Target Role',
                    company: currentAnalysis?.job?.company || 'Company',
                    requirements: currentAnalysis?.job?.requirements || {}
                },
                section
            );

            // Deduct tokens and log activity
            await activityService.logActivity({
                type: 'ai_updated_section',
                description: `AI enhanced ${section}`,
                tokensUsed: 2,
                aiProvider: 'openai-gpt4o-mini'
            });

            // Update UI
            updateFn(enhancedText);

            // Refresh local stats for immediate effect
            await fetchUserStats();

            // Show save warning dialog
            setSaveDialogVisible(true);

        } catch (error: any) {
            console.error("Enhancement failed:", error);
            Alert.alert("Enhancement Failed", error.message || "Failed to enhance text. Please try again.");
        } finally {
            setEnhancingField(null);
        }
    };

    return (
        <Portal.Host>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>Review & Edit</Text>
                        <View style={styles.tokenBadge}>
                            <MaterialCommunityIcons name="fire" size={16} color="#F44336" />
                            <Text style={styles.tokenText}>{userProfile?.tokenBalance || 0}</Text>
                        </View>
                    </View>

                    {/* Summary Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text variant="titleMedium" style={{ ...styles.sectionTitle, color: theme.colors.primary }}>Professional Summary</Text>
                            <Button
                                mode="text"
                                compact
                                onPress={() => {
                                    console.log("Enhancing summary...");
                                    handleEnhance(summary, "Professional Summary", setSummary, 'summary');
                                }}
                                disabled={enhancingField === 'summary'}
                                textColor={theme.colors.secondary}
                                icon={() => enhancingField === 'summary' ? <ActivityIndicator size={14} color={theme.colors.secondary} /> : <MaterialCommunityIcons name="pencil" size={16} color={theme.colors.secondary} />}
                            >
                                AI
                            </Button>
                        </View>
                        <TextInput
                            mode="outlined"
                            multiline
                            numberOfLines={6}
                            value={summary}
                            onChangeText={setSummary}
                            style={[styles.input, { backgroundColor: theme.colors.surface }]}
                            textColor={theme.colors.onSurface}
                            outlineColor={theme.colors.outline}
                        />
                    </View>

                    {/* Experience Section */}
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={{ ...styles.sectionTitle, color: theme.colors.primary, marginBottom: 12 }}>Experience</Text>
                        {experiences.map((exp, expIndex) => (
                            <View key={expIndex} style={[styles.experienceBlock, { borderColor: theme.colors.outlineVariant }]}>
                                <Text variant="titleSmall" style={{ fontWeight: 'bold', color: theme.colors.onBackground }}>{exp.title} at {exp.company}</Text>
                                <Text variant="bodySmall" style={{ opacity: 0.7, marginBottom: 12, color: theme.colors.onSurfaceVariant }}>{exp.startDate} - {exp.current ? 'Present' : exp.endDate}</Text>

                                {exp.bullets.map((bullet, bulletIndex) => {
                                    const fieldId = `exp_${expIndex}_${bulletIndex}`;
                                    return (
                                        <View key={bulletIndex} style={{ marginBottom: 12 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: -10, zIndex: 1 }}>
                                                <Button
                                                    mode="text"
                                                    compact
                                                    style={{ height: 30 }}
                                                    labelStyle={{ fontSize: 10 }}
                                                    onPress={() => {
                                                        console.log(`Enhancing bullet ${fieldId}...`);
                                                        handleEnhance(bullet, `Experience Bullet (${exp.title})`, (newText) => updateExperienceBullet(expIndex, bulletIndex, newText), fieldId);
                                                    }}
                                                    disabled={enhancingField === fieldId}
                                                    textColor={theme.colors.secondary}
                                                    icon={() => enhancingField === fieldId ? <ActivityIndicator size={10} color={theme.colors.secondary} /> : <MaterialCommunityIcons name="pencil" size={12} color={theme.colors.secondary} />}
                                                >
                                                    AI
                                                </Button>
                                            </View>
                                            <TextInput
                                                mode="outlined"
                                                multiline
                                                value={bullet}
                                                onChangeText={(text) => updateExperienceBullet(expIndex, bulletIndex, text)}
                                                style={[styles.input, { fontSize: 13, minHeight: 60, backgroundColor: theme.colors.surface }]}
                                                textColor={theme.colors.onSurface}
                                                outlineColor={theme.colors.outline}
                                                dense
                                            />
                                        </View>
                                    );
                                })}
                            </View>
                        ))}
                    </View>

                    <Button mode="contained" onPress={handleSave} style={{ marginBottom: 40, marginTop: 10 }}>
                        Save All Changes
                    </Button>
                </ScrollView>

                <Portal>
                    <Dialog visible={saveDialogVisible} onDismiss={() => setSaveDialogVisible(false)}>
                        <Dialog.Title>Update Complete</Dialog.Title>
                        <Dialog.Content>
                            <Text variant="bodyMedium">
                                The AI has successfully enhanced your text.
                            </Text>
                            <View style={{ marginTop: 12, padding: 12, backgroundColor: 'rgba(186, 26, 26, 0.1)', borderRadius: 8 }}>
                                <Text variant="labelLarge" style={{ color: theme.colors.error, fontWeight: 'bold' }}>⚠️ WARNING</Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurface, marginTop: 4 }}>
                                    Please click "SAVE ALL CHANGES" at the bottom of the editor to permanently keep these updates. If you leave this screen without saving, your changes will be lost.
                                </Text>
                            </View>
                        </Dialog.Content>
                        <Dialog.Actions>
                            <Button onPress={() => setSaveDialogVisible(false)}>Keep Reviewing</Button>
                            <Button
                                mode="contained"
                                onPress={() => {
                                    setSaveDialogVisible(false);
                                    handleSave();
                                }}
                            >
                                Save Changes
                            </Button>
                        </Dialog.Actions>
                    </Dialog>
                </Portal>
            </KeyboardAvoidingView>
        </Portal.Host>
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
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    sectionTitle: {
        fontWeight: 'bold',
    },
    input: {
        marginBottom: 8,
    },
    experienceBlock: {
        marginBottom: 16,
        paddingLeft: 8,
        borderLeftWidth: 2,
    },
    tokenBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(244, 67, 54, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    tokenText: {
        fontWeight: 'bold',
        color: '#F44336',
        fontSize: 12,
    }
});
