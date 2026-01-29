import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Portal, Modal, Text, Button, Checkbox, Divider, useTheme, IconButton } from 'react-native-paper';
import { DatePickerModal, registerTranslation, en } from 'react-native-paper-dates';
import { format } from 'date-fns';

registerTranslation('en', en);
import { ParsedResume } from '../../types/resume.types';
import { learningService } from '../../services/firebase/learningService';
import { auth } from '../../services/firebase/config';
import { useRouter } from 'expo-router';
import { LearningEntry } from '../../types/learning.types';
import { activityService } from '../../services/firebase/activityService';

interface Props {
    visible: boolean;
    skill: string | null;
    resume: ParsedResume;
    onDismiss: () => void;
    onConfirm: (skill: string, sections: string[]) => void;
    jobTitle?: string;
    companyName?: string;
}

import { useTokenCheck } from '../../hooks/useTokenCheck';

export const SkillAdditionModal = ({ visible, skill, resume, onDismiss, onConfirm, jobTitle: propsJobTitle, companyName: propsCompanyName }: Props) => {
    const theme = useTheme();
    const [selectedSections, setSelectedSections] = useState<string[]>([]);
    const [step, setStep] = useState<'confirm' | 'warning' | 'path_selection' | 'self_date' | 'already_saved' | 'training_in_progress' | 'select'>('confirm');
    const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [existingLearning, setExistingLearning] = useState<LearningEntry | null>(null);
    const [loading, setLoading] = useState(false);
    const [optInAI, setOptInAI] = useState(false);
    const router = useRouter();
    const { checkTokens } = useTokenCheck();

    // Reset state when modal opens
    React.useEffect(() => {
        if (visible && skill) {
            setStep('confirm');
            setSelectedSections([]);
            setDisclaimerAccepted(false);
            setSelectedDate(new Date());
            setShowDatePicker(false);
            setExistingLearning(null);
            setOptInAI(false);

            // Check for existing learning in this context
            if (!auth.currentUser) return;
            const userId = auth.currentUser.uid;
            const jTitle = propsJobTitle || (resume.experience && resume.experience.length > 0 ? resume.experience[0].title : 'Unknown Role');
            const cName = propsCompanyName || (resume.experience && resume.experience.length > 0 ? resume.experience[0].company : 'Unknown Company');

            setLoading(true);
            learningService.findExistingEntry(userId, skill, jTitle, cName).then(existing => {
                if (existing) {
                    setExistingLearning(existing);
                    if (existing.status === 'completed') {
                        setStep('already_saved');
                    } else {
                        setStep('training_in_progress');
                    }
                }
            }).finally(() => setLoading(false));
        }
    }, [visible, skill, propsJobTitle, propsCompanyName]);

    if (!skill) return null;

    const toggleSection = (sectionId: string) => {
        if (selectedSections.includes(sectionId)) {
            setSelectedSections(selectedSections.filter(id => id !== sectionId));
        } else {
            setSelectedSections([...selectedSections, sectionId]);
        }
    };

    const handleConfirm = () => {
        onConfirm(skill, selectedSections);
    };

    const renderContent = () => {
        switch (step) {
            case 'confirm':
                return (
                    <View>
                        <Text variant="headlineSmall" style={styles.title}>Add Skill to Resume?</Text>
                        <Text variant="bodyMedium" style={{ marginBottom: 24 }}>
                            Would you like to add <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{skill}</Text> to your resume?
                        </Text>
                        <Text variant="bodySmall" style={{ color: '#666', marginBottom: 24 }}>
                            This will trigger a targeted optimization to strictly integrate this skill into relevant sections.
                        </Text>

                        <View style={styles.actions}>
                            <Button mode="outlined" onPress={onDismiss} style={{ flex: 1, marginRight: 8 }}>
                                Cancel
                            </Button>
                            <Button mode="contained" onPress={() => setStep('warning')} style={{ flex: 1 }}>
                                Yes, Continue
                            </Button>
                        </View>
                    </View>
                );
            case 'warning':
                return (
                    <View>
                        <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.error }]}>
                            ⚠️ Important: Responsibility
                        </Text>
                        <Text variant="bodyMedium" style={{ marginBottom: 12 }}>
                            You are adding skills to your resume at your own discretion.
                        </Text>
                        <View style={{ backgroundColor: '#FFEBEE', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                            <Text variant="bodySmall" style={{ color: '#D32F2F' }}>
                                We are not responsible for validating whether you possess these skills. It is the prospective employer's responsibility to validate the skills presented during the interview process.
                            </Text>
                            <Text variant="bodySmall" style={{ color: '#D32F2F', marginTop: 8, fontWeight: 'bold' }}>
                                By proceeding, you acknowledge that you should only add skills you genuinely possess or are actively developing.
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                            <Checkbox.Android
                                status={disclaimerAccepted ? 'checked' : 'unchecked'}
                                onPress={() => setDisclaimerAccepted(!disclaimerAccepted)}
                                color={theme.colors.error}
                                uncheckedColor={theme.colors.onSurface}
                            />
                            <Text
                                onPress={() => setDisclaimerAccepted(!disclaimerAccepted)}
                                variant="bodyMedium"
                                style={{ flex: 1, marginLeft: 8 }}
                            >
                                I confirm I possess or am developing this skill
                            </Text>
                        </View>

                        <View style={styles.actions}>
                            <Button mode="outlined" onPress={onDismiss} style={{ flex: 1, marginRight: 8 }}>
                                Cancel
                            </Button>
                            <Button
                                mode="contained"
                                onPress={() => setStep('path_selection')}
                                style={{ flex: 1, backgroundColor: theme.colors.error }}
                                disabled={!disclaimerAccepted}
                            >
                                Accept
                            </Button>
                        </View>
                    </View>
                );
            case 'already_saved':
                return (
                    <View>
                        <Text variant="headlineSmall" style={styles.title}>Skill Already Recorded</Text>
                        <View style={{
                            backgroundColor: theme.dark ? '#2E7D32' : '#E8F5E9',
                            padding: 16,
                            borderRadius: 8,
                            marginBottom: 24,
                            flexDirection: 'row',
                            alignItems: 'center'
                        }}>
                            <IconButton
                                icon="check-decagram"
                                iconColor={theme.dark ? '#E8F5E9' : '#2E7D32'}
                                size={24}
                                style={{ margin: 0, marginRight: 12 }}
                            />
                            <Text variant="bodyMedium" style={{ color: theme.dark ? '#E8F5E9' : '#2E7D32', flex: 1 }}>
                                <Text style={{ fontWeight: 'bold' }}>{skill}</Text> is already in your Learning Hub for this position.
                            </Text>
                        </View>

                        <Text variant="bodyMedium" style={{ marginBottom: 24 }}>
                            Since you've already recorded this skill, you can proceed directly to adding it to your resume.
                        </Text>

                        {existingLearning?.path === 'self' && (
                            <View style={{
                                backgroundColor: theme.dark ? theme.colors.elevation.level2 : '#F5F5F5',
                                padding: 16,
                                borderRadius: 8,
                                marginBottom: 24
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Checkbox.Android
                                        status={optInAI ? 'checked' : 'unchecked'}
                                        onPress={() => setOptInAI(!optInAI)}
                                        color={theme.colors.primary}
                                    />
                                    <Text
                                        variant="bodyMedium"
                                        style={{ flex: 1, marginLeft: 8 }}
                                        onPress={() => setOptInAI(!optInAI)}
                                    >
                                        Interested in learning in-depth on this topic via our AI-assisted learning?
                                    </Text>
                                </View>
                            </View>
                        )}

                        <View style={styles.actions}>
                            <Button mode="outlined" onPress={onDismiss} style={{ flex: 1, marginRight: 8 }}>
                                Close
                            </Button>
                            <Button
                                mode="contained"
                                loading={loading}
                                onPress={async () => {
                                    if (optInAI && existingLearning) {
                                        setLoading(true);
                                        try {
                                            await learningService.updateEntry(existingLearning.id, {
                                                path: 'ai',
                                                status: 'todo'
                                            });
                                            onDismiss();
                                            router.push('/(tabs)/learning');
                                        } catch (error) {
                                            console.error("Failed to upgrade to AI learning:", error);
                                            setStep('select');
                                        } finally {
                                            setLoading(false);
                                        }
                                    } else {
                                        setStep('select');
                                    }
                                }}
                                style={{ flex: 1 }}
                            >
                                {optInAI ? 'Upgrade & Learn' : 'Continue'}
                            </Button>
                        </View>
                    </View>
                );
            case 'training_in_progress':
                return (
                    <View>
                        <Text variant="headlineSmall" style={styles.title}>Training In Progress</Text>
                        <View style={{
                            backgroundColor: theme.dark ? '#1565C0' : '#E3F2FD',
                            padding: 16,
                            borderRadius: 8,
                            marginBottom: 24,
                            flexDirection: 'row',
                            alignItems: 'center'
                        }}>
                            <IconButton
                                icon="progress-clock"
                                iconColor={theme.dark ? '#E3F2FD' : '#1976D2'}
                                size={24}
                                style={{ margin: 0, marginRight: 12 }}
                            />
                            <Text variant="bodyMedium" style={{ color: theme.dark ? '#E3F2FD' : '#1976D2', flex: 1 }}>
                                <Text style={{ fontWeight: 'bold' }}>{skill}</Text> training is currently in progress.
                            </Text>
                        </View>
                        <Text variant="bodyMedium" style={{ marginBottom: 24 }}>
                            Would you like to continue your learning journey or skip directly to resume integration?
                        </Text>
                        <View style={styles.actions}>
                            <Button mode="outlined" onPress={() => setStep('select')} style={{ flex: 1, marginRight: 8 }}>
                                Skip Learning
                            </Button>
                            <Button
                                mode="contained"
                                onPress={() => {
                                    onDismiss();
                                    router.push('/(tabs)/learning');
                                }}
                                style={{ flex: 1 }}
                            >
                                Continue Learning
                            </Button>
                        </View>
                    </View>
                );
            case 'path_selection':
                return (
                    <View>
                        <Text variant="headlineSmall" style={styles.title}>Learning Path</Text>
                        <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                            How did you (or will you) acquire the skill <Text style={{ fontWeight: 'bold' }}>{skill}</Text>?
                        </Text>

                        {existingLearning && (
                            <View style={{ backgroundColor: theme.colors.primaryContainer, padding: 12, borderRadius: 8, marginBottom: 16 }}>
                                <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer }}>
                                    ✅ You already achieved this skill on {existingLearning.completionDate?.toLocaleDateString()} via {existingLearning.path === 'ai' ? 'AI-Assisted' : 'Self'} Learning.
                                </Text>
                            </View>
                        )}

                        <Button
                            mode="outlined"
                            onPress={() => setStep('self_date')}
                            style={{ marginBottom: 12 }}
                            icon="account-edit-outline"
                            disabled={!!existingLearning}
                        >
                            Self-Learning (I already have it)
                        </Button>

                        <Button
                            mode="contained"
                            loading={loading}
                            onPress={async () => {
                                if (!auth.currentUser) return;
                                if (!checkTokens(30, onDismiss)) return;  // Pass onDismiss to close modal first
                                const userId = auth.currentUser.uid;
                                setLoading(true);
                                try {
                                    const firstExperience = resume.experience && resume.experience.length > 0 ? resume.experience[0] : null;
                                    await learningService.addEntry({
                                        userId,
                                        skillName: skill!,
                                        jobTitle: propsJobTitle || firstExperience?.title || 'Unknown Role',
                                        companyName: propsCompanyName || firstExperience?.company || 'Unknown Company',
                                        path: 'ai',
                                        status: 'todo'
                                    });

                                    // LOG ACTIVITY
                                    await activityService.logActivity({
                                        type: 'training_slideshow_generation',
                                        description: `Started AI learning path for "${skill}"`,
                                        resourceId: skill!,
                                        resourceName: skill!,
                                        aiProvider: 'openai-gpt4o-mini'
                                    }).catch(e => console.log("Silent activity log fail:", e));

                                    onDismiss();
                                    router.push('/(tabs)/learning');
                                } catch (error) {
                                    console.error("Failed to add AI learning entry:", error);
                                    const { Alert } = require('react-native');
                                    Alert.alert("Notice", "We couldn't track this entry, but we'll take you to the Learning Hub.");
                                    onDismiss();
                                    router.push('/(tabs)/learning');
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            disabled={loading || !!existingLearning}
                            style={{ marginBottom: 12 }}
                            icon="robot-outline"
                        >
                            AI-Assisted Learning (Teach me)
                        </Button>

                        <Text variant="labelSmall" style={{ color: '#666', marginBottom: 16, textAlign: 'center' }}>
                            You can directly add to resume if you prefer, but tracking helps your profile.
                        </Text>

                        <View style={styles.actions}>
                            <Button mode="text" onPress={() => setStep('select')} style={{ flex: 1 }}>
                                Skip to Resume Integration
                            </Button>
                        </View>
                    </View >
                );
            case 'self_date':
                return (
                    <View>
                        <Text variant="headlineSmall" style={styles.title}>Self-Learning</Text>
                        <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                            When did you achieve proficiency in <Text style={{ fontWeight: 'bold' }}>{skill}</Text>?
                        </Text>

                        <Button
                            mode="outlined"
                            onPress={() => setShowDatePicker(true)}
                            icon="calendar"
                            style={{ marginBottom: 24, paddingVertical: 8 }}
                        >
                            {selectedDate ? format(selectedDate, 'PPP') : 'Select Date'}
                        </Button>

                        <DatePickerModal
                            locale="en"
                            mode="single"
                            visible={showDatePicker}
                            onDismiss={() => setShowDatePicker(false)}
                            date={selectedDate}
                            onConfirm={(params) => {
                                setShowDatePicker(false);
                                if (params.date) setSelectedDate(params.date);
                            }}
                            validRange={{
                                endDate: new Date()
                            }}
                        />

                        <View style={styles.actions}>
                            <Button mode="outlined" onPress={() => setStep('path_selection')} style={{ flex: 1, marginRight: 8 }}>
                                Back
                            </Button>
                            <Button
                                mode="contained"
                                loading={loading}
                                onPress={async () => {
                                    if (!auth.currentUser) return;
                                    const userId = auth.currentUser.uid;
                                    setLoading(true);
                                    try {
                                        const firstExperience = resume.experience && resume.experience.length > 0 ? resume.experience[0] : null;

                                        await learningService.addEntry({
                                            userId,
                                            skillName: skill!,
                                            jobTitle: propsJobTitle || firstExperience?.title || 'Unknown Role',
                                            companyName: propsCompanyName || firstExperience?.company || 'Unknown Company',
                                            path: 'self',
                                            status: 'completed',
                                            completionDate: selectedDate
                                        });

                                        // LOG ACTIVITY
                                        await activityService.logActivity({
                                            type: 'skill_marked_learned',
                                            description: `Marked skill "${skill}" as learned (Self-taught)`,
                                            resourceId: skill!,
                                            resourceName: skill!
                                        }).catch(e => console.log("Silent activity log fail:", e));

                                        setStep('select');
                                    } catch (error) {
                                        console.error("Failed to record learning:", error);
                                        const { Alert } = require('react-native');
                                        Alert.alert("Notice", "We couldn't save this to your Learning Hub, but you can still add it to your resume.");
                                        setStep('select');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading}
                                style={{ flex: 1 }}
                            >
                                Record & Continue
                            </Button>
                        </View>
                    </View>
                );
            case 'select':
                return (
                    <View style={{ maxHeight: 500 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text variant="headlineSmall" style={styles.title}>Select Sections</Text>
                            <IconButton
                                icon="close"
                                size={24}
                                onPress={onDismiss}
                                style={{ margin: -8 }}
                            />
                        </View>
                        <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                            Where should <Text style={{ fontWeight: 'bold' }}>{skill}</Text> be added?
                        </Text>

                        <ScrollView style={{ maxHeight: 300 }}>
                            <Checkbox.Item
                                label="Professional Summary"
                                status={selectedSections.includes('summary') ? 'checked' : 'unchecked'}
                                onPress={() => toggleSection('summary')}
                            />
                            <Divider />

                            {resume.experience.map((exp) => (
                                <Checkbox.Item
                                    key={exp.id}
                                    label={`${exp.company} - ${exp.title}`}
                                    status={selectedSections.includes(`experience_${exp.id}`) ? 'checked' : 'unchecked'}
                                    onPress={() => toggleSection(`experience_${exp.id}`)}
                                />
                            ))}
                            <Divider />

                            <Checkbox.Item
                                label="Skills Section (List)"
                                status={selectedSections.includes('skills_list') ? 'checked' : 'unchecked'}
                                onPress={() => toggleSection('skills_list')}
                            />
                        </ScrollView>

                        <Text variant="labelSmall" style={{ color: '#666', marginTop: 12, fontStyle: 'italic' }}>
                            The AI will write contextual bullet points for experience roles or rewrite the summary.
                        </Text>

                        <View style={styles.actions}>
                            <Button mode="text" onPress={() => setStep(existingLearning ? (existingLearning.status === 'completed' ? 'already_saved' : 'training_in_progress') : 'path_selection')} style={{ marginRight: 8 }}>
                                Back
                            </Button>
                            <Button
                                mode="contained"
                                onPress={handleConfirm}
                                disabled={selectedSections.length === 0}
                                style={{ flex: 1 }}
                            >
                                Add to Selected
                            </Button>
                        </View>
                    </View>
                );
        }
    };

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onDismiss}
                contentContainerStyle={[
                    styles.modal,
                    { backgroundColor: theme.colors.elevation.level3 }
                ]}
            >
                {renderContent()}
            </Modal>
        </Portal>
    );
};

const styles = StyleSheet.create({
    modal: {
        margin: 20,
        padding: 24,
        borderRadius: 8,
    },
    title: {
        marginBottom: 16,
    },
    actions: {
        flexDirection: 'row',
        marginTop: 24,
        justifyContent: 'flex-end',
    }
});
