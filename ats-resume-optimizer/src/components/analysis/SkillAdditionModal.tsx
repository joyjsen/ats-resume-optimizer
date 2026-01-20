import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Portal, Modal, Text, Button, Checkbox, Divider, useTheme } from 'react-native-paper';
import { ParsedResume } from '../../types/resume.types';

interface Props {
    visible: boolean;
    skill: string | null;
    resume: ParsedResume;
    onDismiss: () => void;
    onConfirm: (skill: string, sections: string[]) => void;
}

export const SkillAdditionModal = ({ visible, skill, resume, onDismiss, onConfirm }: Props) => {
    const theme = useTheme();
    const [selectedSections, setSelectedSections] = useState<string[]>([]);
    const [step, setStep] = useState<'confirm' | 'select'>('confirm');

    // Reset state when modal opens
    React.useEffect(() => {
        if (visible) {
            setStep('confirm');
            setSelectedSections([]);
        }
    }, [visible]);

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

    return (
        <Portal>
            <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.elevation.level3 }]}>
                {step === 'confirm' ? (
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
                            <Button mode="contained" onPress={() => setStep('select')} style={{ flex: 1 }}>
                                Yes, Continue
                            </Button>
                        </View>
                    </View>
                ) : (
                    <View style={{ maxHeight: 500 }}>
                        <Text variant="headlineSmall" style={styles.title}>Select Sections</Text>
                        <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                            Where should <Text style={{ fontWeight: 'bold' }}>{skill}</Text> be added?
                        </Text>

                        <ScrollView style={{ maxHeight: 300 }}>
                            {/* Summary */}
                            <Checkbox.Item
                                label="Professional Summary"
                                status={selectedSections.includes('summary') ? 'checked' : 'unchecked'}
                                onPress={() => toggleSection('summary')}
                            />
                            <Divider />

                            {/* Experience Items */}
                            {resume.experience.map((exp) => (
                                <Checkbox.Item
                                    key={exp.id}
                                    label={`${exp.company} - ${exp.title}`}
                                    status={selectedSections.includes(`experience_${exp.id}`) ? 'checked' : 'unchecked'}
                                    onPress={() => toggleSection(`experience_${exp.id}`)}
                                />
                            ))}
                            <Divider />

                            {/* Skills Section */}
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
                            <Button mode="text" onPress={() => setStep('confirm')} style={{ marginRight: 8 }}>
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
                )}
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
