import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { TextInput, Button, Text, useTheme, Portal, Dialog, Surface, IconButton } from 'react-native-paper';
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

    const [contactInfo, setContactInfo] = useState(initialResume?.contactInfo || { name: '', email: '', phone: '' });
    const [summary, setSummary] = useState(initialResume?.summary || '');
    const [experiences, setExperiences] = useState(initialResume?.experience || []);
    const [education, setEducation] = useState(initialResume?.education || []);
    const [skillsString, setSkillsString] = useState((initialResume?.skills || []).map((s: any) => s.name).join(', '));

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

        updatedResume.contactInfo = contactInfo;
        updatedResume.summary = summary;
        updatedResume.experience = experiences;
        updatedResume.education = education;
        updatedResume.skills = skillsString.split(',').map(s => ({ name: s.trim() })).filter(s => s.name.length > 0);

        const isDraft = !!currentAnalysis?.draftOptimizedResumeData;

        setCurrentAnalysis({
            ...currentAnalysis,
            [isDraft ? 'draftOptimizedResumeData' : 'optimizedResume']: updatedResume
        });

        router.back();
    };

    const updateExperienceField = (index: number, field: string, value: any) => {
        const newExperiences = [...experiences];
        newExperiences[index] = { ...newExperiences[index], [field]: value };
        setExperiences(newExperiences);
    };

    const updateExperienceBullet = (expIndex: number, bulletIndex: number, text: string) => {
        const newExperiences = [...experiences];
        if (!newExperiences[expIndex].bullets) newExperiences[expIndex].bullets = [];
        const newBullets = [...newExperiences[expIndex].bullets];
        newBullets[bulletIndex] = text;
        newExperiences[expIndex] = { ...newExperiences[expIndex], bullets: newBullets };
        setExperiences(newExperiences);
    };

    const addExperienceBullet = (expIndex: number) => {
        const newExperiences = [...experiences];
        if (!newExperiences[expIndex].bullets) newExperiences[expIndex].bullets = [];
        const newBullets = [...newExperiences[expIndex].bullets, ""];
        newExperiences[expIndex] = { ...newExperiences[expIndex], bullets: newBullets };
        setExperiences(newExperiences);
    };

    const removeExperienceBullet = (expIndex: number, bulletIndex: number) => {
        Alert.alert(
            "Delete Section",
            "Are you sure you want to delete this section?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        const newExperiences = [...experiences];
                        const newBullets = [...newExperiences[expIndex].bullets];
                        newBullets.splice(bulletIndex, 1);
                        newExperiences[expIndex] = { ...newExperiences[expIndex], bullets: newBullets };
                        setExperiences(newExperiences);
                    }
                }
            ]
        );
    };

    const updateEducationField = (index: number, field: string, value: any) => {
        const newEducation = [...education];
        newEducation[index] = { ...newEducation[index], [field]: value };
        setEducation(newEducation);
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
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>Review & Edit</Text>
                        <View style={styles.tokenBadge}>
                            <MaterialCommunityIcons name="fire" size={16} color="#F44336" />
                            <Text style={styles.tokenText}>{userProfile?.tokenBalance || 0}</Text>
                        </View>
                    </View>
                    <Text variant="bodySmall" style={{ color: theme.colors.primary, marginBottom: 16 }}>
                        Each section can be either manually edited or you can click on the "AI" button to update each section using AI. Each AI assisted section update will cost 2 tokens.
                    </Text>

                    {/* Contact Info Section */}
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={{ ...styles.sectionTitle, color: theme.colors.primary, marginBottom: 8 }}>Contact Info</Text>
                        <TextInput
                            label="Full Name"
                            mode="outlined"
                            value={contactInfo.name}
                            onChangeText={(val) => setContactInfo({ ...contactInfo, name: val })}
                            style={styles.input}
                            dense
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TextInput
                                label="Email"
                                mode="outlined"
                                value={contactInfo.email}
                                onChangeText={(val) => setContactInfo({ ...contactInfo, email: val })}
                                style={[styles.input, { flex: 1 }]}
                                dense
                            />
                            <TextInput
                                label="Phone"
                                mode="outlined"
                                value={contactInfo.phone}
                                onChangeText={(val) => setContactInfo({ ...contactInfo, phone: val })}
                                style={[styles.input, { flex: 1 }]}
                                dense
                            />
                        </View>
                    </View>

                    {/* Summary Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text variant="titleMedium" style={{ ...styles.sectionTitle, color: theme.colors.primary }}>Professional Summary</Text>
                            <Button
                                mode="text"
                                compact
                                onPress={() => handleEnhance(summary, "Professional Summary", setSummary, 'summary')}
                                disabled={enhancingField === 'summary'}
                                textColor={theme.colors.primary}
                                icon={() => enhancingField === 'summary' ? <ActivityIndicator size={14} color={theme.colors.primary} /> : <MaterialCommunityIcons name="pencil" size={16} color={theme.colors.primary} />}
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
                        />
                    </View>

                    {/* Experience Section */}
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={{ ...styles.sectionTitle, color: theme.colors.primary, marginBottom: 12 }}>Experience</Text>
                        {experiences.map((exp, expIndex) => (
                            <Surface key={expIndex} style={[styles.experienceBlock, { borderColor: theme.colors.outlineVariant, marginBottom: 24, padding: 12, borderRadius: 8, elevation: 1 }]}>
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                                    <TextInput
                                        label="Title"
                                        mode="outlined"
                                        value={exp.title}
                                        onChangeText={(v) => updateExperienceField(expIndex, 'title', v)}
                                        style={{ flex: 1 }}
                                        dense
                                    />
                                    <TextInput
                                        label="Company"
                                        mode="outlined"
                                        value={exp.company}
                                        onChangeText={(v) => updateExperienceField(expIndex, 'company', v)}
                                        style={{ flex: 1 }}
                                        dense
                                    />
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                    <TextInput
                                        label="Start"
                                        mode="outlined"
                                        value={exp.startDate}
                                        onChangeText={(v) => updateExperienceField(expIndex, 'startDate', v)}
                                        style={{ flex: 1 }}
                                        dense
                                    />
                                    <TextInput
                                        label="End / Present"
                                        mode="outlined"
                                        value={exp.current ? 'Present' : exp.endDate}
                                        onChangeText={(v) => updateExperienceField(expIndex, 'endDate', v)}
                                        style={{ flex: 1 }}
                                        dense
                                    />
                                </View>

                                {(exp.bullets || []).map((bullet, bulletIndex) => {
                                    const fieldId = `exp_${expIndex}_${bulletIndex}`;
                                    return (
                                        <View key={bulletIndex} style={{ marginBottom: 16 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: -10, zIndex: 1 }}>
                                                <IconButton
                                                    icon="delete-outline"
                                                    size={16}
                                                    onPress={() => removeExperienceBullet(expIndex, bulletIndex)}
                                                    iconColor={theme.colors.error}
                                                />
                                                <Button
                                                    mode="text"
                                                    compact
                                                    labelStyle={{ fontSize: 10 }}
                                                    onPress={() => handleEnhance(bullet, `Experience Bullet (${exp.title})`, (newText) => updateExperienceBullet(expIndex, bulletIndex, newText), fieldId)}
                                                    disabled={enhancingField === fieldId}
                                                    textColor={theme.colors.primary}
                                                    icon={() => enhancingField === fieldId ? <ActivityIndicator size={10} color={theme.colors.primary} /> : <MaterialCommunityIcons name="pencil" size={12} color={theme.colors.primary} />}
                                                >
                                                    AI
                                                </Button>
                                            </View>
                                            <TextInput
                                                mode="outlined"
                                                multiline
                                                value={bullet}
                                                onChangeText={(text) => updateExperienceBullet(expIndex, bulletIndex, text)}
                                                style={[styles.input, { fontSize: 13, minHeight: 60 }]}
                                                dense
                                            />
                                        </View>
                                    );
                                })}
                                <Button mode="outlined" compact onPress={() => addExperienceBullet(expIndex)} style={{ marginTop: 8 }} icon="plus">Add Bullet</Button>
                            </Surface>
                        ))}
                    </View>

                    {/* Skills Section */}
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={{ ...styles.sectionTitle, color: theme.colors.primary, marginBottom: 8 }}>Skills (comma separated)</Text>
                        <TextInput
                            mode="outlined"
                            multiline
                            value={skillsString}
                            onChangeText={setSkillsString}
                            placeholder="e.g. Python, React, Project Management"
                        />
                    </View>

                    {/* Education Section */}
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={{ ...styles.sectionTitle, color: theme.colors.primary, marginBottom: 8 }}>Education</Text>
                        {education.map((edu, eduIndex) => (
                            <View key={eduIndex} style={{ marginBottom: 16, padding: 8, borderLeftWidth: 2, borderLeftColor: theme.colors.outline }}>
                                <TextInput
                                    label="Institution"
                                    mode="outlined"
                                    value={edu.institution}
                                    onChangeText={(v) => updateEducationField(eduIndex, 'institution', v)}
                                    style={styles.input}
                                    dense
                                />
                                <TextInput
                                    label="Degree"
                                    mode="outlined"
                                    value={edu.degree}
                                    onChangeText={(v) => updateEducationField(eduIndex, 'degree', v)}
                                    style={styles.input}
                                    dense
                                />
                            </View>
                        ))}
                    </View>

                    <Button mode="contained" onPress={handleSave} style={{ marginBottom: 40, marginTop: 10 }} contentStyle={{ paddingVertical: 8 }}>
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
                                    Please click "SAVE ALL CHANGES" at the bottom of the editor to permanently keep these updates.
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
