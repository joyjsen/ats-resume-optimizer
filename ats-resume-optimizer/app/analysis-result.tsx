import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Button, Text, Card, ProgressBar, useTheme, Portal, Dialog, Paragraph } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useResumeStore } from '../src/store/resumeStore';
import { useTaskQueue } from '../src/context/TaskQueueContext';
import { ATSScoreCard } from '../src/components/analysis/ATSScoreCard';
import { SkillsComparison } from '../src/components/analysis/SkillsComparison';
import { BeforeAfterComparison } from '../src/components/optimization/BeforeAfterComparison';
import { SkillAdditionModal } from '../src/components/analysis/SkillAdditionModal';
import { SkillMatch } from '../src/types/analysis.types';

export default function AnalysisResultScreen() {
    const router = useRouter();
    const { currentAnalysis, setCurrentAnalysis } = useResumeStore();
    const [optimizing, setOptimizing] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [revertDialogVisible, setRevertDialogVisible] = React.useState(false);


    if (!currentAnalysis) {
        return (
            <View style={styles.container}>
                <Text>No analysis data found. Please go back.</Text>
                <Button onPress={() => router.back()}>Go Back</Button>
            </View>
        );
    }

    // Determine which resume/changes to show (Draft takes precedence)
    const isDraft = !!currentAnalysis.draftOptimizedResumeData;
    const optimizedResume = currentAnalysis.draftOptimizedResumeData || currentAnalysis.optimizedResume;
    const changes = currentAnalysis.draftChangesData || currentAnalysis.changes;

    // Store local unsaved state, initialized from draft presence
    const [isUnsaved, setIsUnsaved] = React.useState(isDraft);

    // Sync isUnsaved if currentAnalysis changes (e.g. re-fetch)
    React.useEffect(() => {
        setIsUnsaved(!!currentAnalysis.draftOptimizedResumeData);
    }, [currentAnalysis]);

    // Force refresh from server on mount to ensure we have the latest "Draft" state
    // (In case user navigated away and came back, effectively reloading the screen)
    React.useEffect(() => {
        if (currentAnalysis?.id) {
            const { historyService } = require('../src/services/firebase/historyService');
            console.log("Hydrating analysis data for ID:", currentAnalysis.id);
            historyService.getAnalysisById(currentAnalysis.id).then((freshData: any) => {
                if (freshData) {
                    // Check for draft (pending validation) OR final data
                    const hasDraft = !!freshData.draftOptimizedResumeData;
                    const hasFinal = !!freshData.optimizedResumeData;

                    console.log("Hydration Result - Draft:", hasDraft, " Final:", hasFinal);

                    if (hasDraft || hasFinal) {
                        setCurrentAnalysis({
                            ...freshData.analysisData,
                            id: freshData.id,
                            job: freshData.jobData,
                            resume: freshData.resumeData,
                            optimizedResume: freshData.optimizedResumeData,
                            changes: freshData.changesData,
                            optimizedMatchAnalysis: freshData.optimizedMatchAnalysis,
                            draftOptimizedResumeData: freshData.draftOptimizedResumeData,
                            draftChangesData: freshData.draftChangesData,
                            draftAtsScore: freshData.draftAtsScore,
                            draftMatchAnalysis: freshData.draftMatchAnalysis,
                            atsScore: freshData.atsScore // FIX: Hydrate ONLY the saved score. Do not mix with draft.
                        });
                        // State sync will happen via the other useEffect
                    }
                }
            });
        }
    }, [currentAnalysis?.id]);

    // Use draft metrics if available, OR optimized (saved) metrics, OR original
    // IMPORTANT: currentAnalysis.matchAnalysis (from analysisData) is ALWAYS the Original baseline.
    // Use draft metrics if available, OR optimized (saved) metrics, OR original
    // IMPORTANT: currentAnalysis.matchAnalysis (from analysisData) is ALWAYS the Original baseline.
    const calculateScore = (analysis: any) => {
        if (!analysis) return 0;
        const weights = { matched: 0.5, partial: 0.2, density: 0.2, exp: 0.2, fmt: 0.1 };

        const matches = analysis.matchedSkills || [];
        const partials = analysis.partialMatches || [];
        const missing = analysis.missingSkills || [];

        // Count critical/high
        const impMatched = matches.filter((s: any) => s.importance === 'critical' || s.importance === 'high').length;
        const impPartial = partials.filter((s: any) => s.importance === 'critical' || s.importance === 'high').length;
        const impMissing = missing.filter((s: any) => s.importance === 'critical' || s.importance === 'high').length;

        const total = impMatched + impPartial + impMissing;
        // Matched=1.0, Partial=0.5
        const skillScore = total > 0 ? ((impMatched * 1.0 + impPartial * 0.5) / total) * 100 : 0;

        const score = (skillScore * 0.5) +
            ((analysis.keywordDensity || 0) * 0.2) +
            ((analysis.experienceMatch?.match || 0) * 0.2);

        return Math.round(Math.min(100, Math.max(0, score)));
    };

    // Original Score (Baseline) Logic:
    // 1. If we are DRAFTING (unsaved changes), the baseline is the LAST SAVED PROMOTED SCORE (currentAnalysis.atsScore).
    //    We want to show the user the impact of their *current* edit session (e.g., 65 -> 70), not the ancient history.
    // 2. If we are VIEWING SAVED (no draft), the baseline is the ANCIENT ORIGINAL ANALYSIS (matchAnalysis).
    //    We want to show the user their total journey (e.g., 60 -> 65).
    const originalScore = React.useMemo(() => {
        // Check if we are in a draft state
        const isDraft = !!currentAnalysis.draftAtsScore;

        if (isDraft) {
            // Baseline = Last Saved
            return currentAnalysis.atsScore || 0;
        }

        // User Request: Hide comparison if not drafting (Clean view)
        return undefined;
    }, [currentAnalysis.matchAnalysis, currentAnalysis.draftAtsScore, currentAnalysis.atsScore]);

    const matchAnalysis = currentAnalysis.draftMatchAnalysis
        ?? currentAnalysis.optimizedMatchAnalysis
        ?? currentAnalysis.matchAnalysis;
    const atsScore = currentAnalysis.draftAtsScore ?? currentAnalysis.atsScore; // Restore atsScore

    const { resume, job } = currentAnalysis;

    console.log("AnalysisResultScreen Debug:", {
        hasDraftScore: !!currentAnalysis.draftAtsScore,
        hasDraftMatch: !!currentAnalysis.draftMatchAnalysis,
        originalMatchedCount: currentAnalysis.matchAnalysis.matchedSkills.length,
        currentMatchedCount: matchAnalysis.matchedSkills.length,
        isSameObject: matchAnalysis === currentAnalysis.matchAnalysis
    });

    const { activeTasks } = useTaskQueue();
    const [currentTaskId, setCurrentTaskId] = React.useState<string | null>(null);

    // Monitor active task
    React.useEffect(() => {
        // 1. Initial Check: If no currentTaskId, look for one in the queue
        if (!currentTaskId) {
            const existing = activeTasks.find(t =>
                (t.type === 'optimize_resume' || t.type === 'add_skill') &&
                t.payload.currentAnalysis?.id === currentAnalysis.id &&
                t.status !== 'failed' && t.status !== 'completed'
            );
            if (existing) {
                setCurrentTaskId(existing.id);
                setOptimizing(true);
            }
            return;
        }

        const task = activeTasks.find(t => t.id === currentTaskId);
        const { historyService } = require('../src/services/firebase/historyService');

        // 2. Task exists and is running
        if (task) {
            setOptimizing(true);

            if (task.status === 'completed') {
                // Task explicitly marked completed
                handleTaskCompletion(historyService);
            } else if (task.status === 'failed') {
                setOptimizing(false);
                setCurrentTaskId(null);
                const { Alert } = require('react-native');
                Alert.alert("Optimization Failed", task.error || "Unknown error");
            }
        }
        // 3. Task disappeared but we were optimizing? It might have finished and been cleared.
        else if (optimizing) {
            // Check if the analysis was updated in the background
            handleTaskCompletion(historyService);
        }

    }, [activeTasks, currentTaskId, currentAnalysis.id, optimizing]);

    const handleTaskCompletion = (historyService: any) => {
        console.log("Checking for completion... Analysis ID:", currentAnalysis.id);

        // Fetch just the single record
        historyService.getAnalysisById(currentAnalysis.id).then((updated: any) => {
            console.log("Found updated record:", updated ? "Yes" : "No");
            if (updated) {
                console.log("Draft Data Present:", !!updated.draftOptimizedResumeData);
                console.log("Final Data Present:", !!updated.optimizedResumeData);

                // Check for draft (pending validation) OR final data
                const hasDraft = !!updated.draftOptimizedResumeData;
                const hasFinal = !!updated.optimizedResumeData;

                if (hasDraft || hasFinal) {
                    setCurrentAnalysis({
                        ...updated.analysisData,
                        id: updated.id,
                        job: updated.jobData,
                        resume: updated.resumeData,
                        // Prefer draft if exists (so user sees the new result to validate), otherwise final
                        optimizedResume: updated.optimizedResumeData, // Keep final here for consistency
                        changes: updated.changesData,
                        optimizedMatchAnalysis: updated.optimizedMatchAnalysis,
                        draftOptimizedResumeData: updated.draftOptimizedResumeData, // Keep draft data separate
                        draftChangesData: updated.draftChangesData,
                        draftAtsScore: updated.draftAtsScore,
                        draftMatchAnalysis: updated.draftMatchAnalysis,
                        atsScore: updated.atsScore // FIX: Use the top-level Saved Score, not the stale one from analysisData
                    });

                    // If we have a draft, it is UNSAVED/UNVALIDATED.
                    setIsUnsaved(hasDraft);
                    setOptimizing(false);
                    setCurrentTaskId(null);
                    return; // Success
                }
            }

            // Safety check: If task is gone and we didn't update above (maybe save failed?), stop spinning
            if (!activeTasks.find(t => t.id === currentTaskId)) {
                console.warn("Task disappeared but no result found. resetting state.");
                setOptimizing(false);
                setCurrentTaskId(null);
                // Alert the user if we expected a result
                // Alert.alert("Notice", "Optimization finished but no changes were detected. Please try again.");
            }
        });
    };


    const handleOptimize = async () => {
        setOptimizing(true);
        try {
            const { taskService } = require('../src/services/firebase/taskService');

            // Check if already running for this analysis
            const existing = activeTasks.find(t =>
                t.type === 'optimize_resume' &&
                t.payload.currentAnalysis?.id === currentAnalysis.id &&
                t.status !== 'failed'
            );

            if (existing) {
                setCurrentTaskId(existing.id);
                return;
            }

            const taskId = await taskService.createTask('optimize_resume', {
                resume,
                job,
                currentAnalysis
            });

            setCurrentTaskId(taskId);

        } catch (error) {
            console.error(error);
            setOptimizing(false);
        }
    };

    // --- Interactive Skill Management ---
    const [skillModalVisible, setSkillModalVisible] = React.useState(false);
    const [selectedSkillToAdd, setSelectedSkillToAdd] = React.useState<string | null>(null);

    const handleSkillPress = (skillMatch: SkillMatch) => {
        if (optimizing) {
            const { Alert } = require('react-native');
            Alert.alert("Please Wait", "A skill addition or optimization is already in progress. Please wait for it to complete.");
            return;
        }

        // Gating: Require optimized resume before adding skills
        if (!optimizedResume) {
            const { Alert } = require('react-native');
            Alert.alert(
                "Optimize Resume First",
                "Please optimize your existing resume first before attempting to add any missing skills.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Optimize Now",
                        onPress: () => handleOptimize()
                    }
                ]
            );
            return;
        }

        // Only allow adding if it's missing or partial (though the UI component filters clickability)
        setSelectedSkillToAdd(skillMatch.skill);
        setSkillModalVisible(true);
    };

    const handleConfirmAddSkill = async (skill: string, sections: string[]) => {
        setSkillModalVisible(false);
        setOptimizing(true); // Re-use optimizing state for spinner

        try {
            const { taskService } = require('../src/services/firebase/taskService');

            // Pass the CURRENTLY displayed resume (could be already partially optimized/draft)
            // If optimizedResume exists (draft or final), use that. Otherwise use original 'resume'.
            const baseResume = currentAnalysis.draftOptimizedResumeData || currentAnalysis.optimizedResume || currentAnalysis.resume;

            const taskId = await taskService.createTask('add_skill', {
                skill,
                targetSections: sections,
                resume: baseResume,
                currentAnalysis: currentAnalysis // Pass full object so worker knows IDs and existing changes
            });

            setCurrentTaskId(taskId);

        } catch (error) {
            console.error(error);
            setOptimizing(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { historyService } = require('../src/services/firebase/historyService');

            if (currentAnalysis.id) {
                // Promote the draft to final
                const success = await historyService.promoteDraftToFinal(currentAnalysis.id);
                if (success) {
                    setIsUnsaved(false);
                    // Update local store immediately to reflect "Saved" state
                    // This prevents the button from reappearing if we stay on screen
                    setCurrentAnalysis({
                        ...currentAnalysis,
                        optimizedResume: currentAnalysis.draftOptimizedResumeData, // Move draft to final
                        changes: currentAnalysis.draftChangesData,
                        optimizedMatchAnalysis: currentAnalysis.draftMatchAnalysis, // Promote draft match to optimized
                        atsScore: currentAnalysis.draftAtsScore || currentAnalysis.atsScore, // Update score locally
                        matchAnalysis: currentAnalysis.matchAnalysis, // Keep baseline original!
                        draftOptimizedResumeData: undefined, // Clear draft
                        draftChangesData: undefined,
                        draftAtsScore: undefined,
                        draftMatchAnalysis: undefined
                    });
                } else {
                    // Handle failure or race condition
                }
            }

            // Per user request: Stay on screen or go back?
            // "should continue to show 'validate...' until i actually click on it"
            // "when i do not click it and go back... it is again showing rewrite" (bug)
            // Implicitly: clicking it should probably just update the state to "Saved".
            // User didn't say "go back".
            // Let's NOT dismissAll. Just validate and show "Optimized".
            // router.dismissAll(); 

        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = async () => {
        setSaving(true);
        try {
            const { historyService } = require('../src/services/firebase/historyService');
            if (currentAnalysis.id) {
                const success = await historyService.discardDraft(currentAnalysis.id);
                if (success) {
                    setIsUnsaved(false);
                    // Revert to original state
                    setCurrentAnalysis({
                        ...currentAnalysis,
                        draftOptimizedResumeData: undefined,
                        draftChangesData: undefined,
                        draftAtsScore: undefined,
                        draftMatchAnalysis: undefined,
                        // Re-hydrate the clean state (or just let the effect handle it, but immediate is better)
                        atsScore: currentAnalysis.atsScore, // Back to saved score
                        // FIX: Ensure we keep the ORIGINAL baseline, do not overwrite with optimizedMatchAnalysis
                        matchAnalysis: currentAnalysis.matchAnalysis
                    });
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <Text variant="headlineMedium" style={styles.title}>
                {optimizedResume ? "✅ Analysis & Optimization" : "📊 Analysis Result"}
            </Text>

            {optimizing && currentTaskId && (
                <Card style={{ marginBottom: 16, borderColor: '#2196F3', borderWidth: 1 }}>
                    <Card.Content>
                        <Text variant="titleSmall" style={{ fontWeight: 'bold', color: '#1976D2', marginBottom: 4 }}>
                            {activeTasks.find(t => t.id === currentTaskId)?.stage || 'Processing...'}
                        </Text>
                        <ProgressBar
                            progress={(activeTasks.find(t => t.id === currentTaskId)?.progress || 0) / 100}
                            color="#2196F3"
                            style={{ height: 8, borderRadius: 4 }}
                        />
                    </Card.Content>
                </Card>
            )}

            <ATSScoreCard score={atsScore} originalScore={originalScore} />

            {/* Show "New" skills if we have a draft match analysis that differs from original */}
            <SkillsComparison
                matchAnalysis={matchAnalysis}
                originalMatchAnalysis={currentAnalysis.matchAnalysis}
                changes={changes}
                onSkillPress={handleSkillPress}
            />

            {!optimizedResume && (
                <Card style={styles.card}>
                    <Card.Content>
                        <Text variant="titleMedium" style={{ marginBottom: 8 }}>Recommendation</Text>
                        <Text variant="bodyMedium">
                            {currentAnalysis.recommendation.reasoning}
                        </Text>

                        {!optimizing ? (
                            <Button
                                mode="contained"
                                onPress={handleOptimize}
                                style={{ marginTop: 16 }}
                            >
                                ✨ Rewrite & Optimize Resume
                            </Button>
                        ) : (
                            <View style={{ marginTop: 16 }}>
                                <Text variant="bodySmall" style={{ marginBottom: 8, textAlign: 'center' }}>
                                    {activeTasks.find(t => t.id === currentTaskId)?.stage || 'Optimizing...'}
                                </Text>
                                <ProgressBar
                                    progress={(activeTasks.find(t => t.id === currentTaskId)?.progress || 0) / 100}
                                    style={{ height: 8, borderRadius: 4 }}
                                />
                            </View>
                        )}
                    </Card.Content>
                </Card>
            )}

            {optimizedResume && changes && (
                <>
                    <Card style={styles.card}>
                        <Card.Content>
                            <Text variant="titleMedium" style={{ marginBottom: 12 }}>What We Optimized</Text>
                            <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                                We've enhanced your resume with {changes.length} improvements to boost your ATS score to {atsScore}%.
                            </Text>

                            {changes.map((change, index) => (
                                <View key={index} style={{ marginBottom: 12, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#4CAF50' }}>
                                    <Text variant="labelLarge" style={{ color: '#2E7D32' }}>
                                        {change.type.replace('_', ' ').toUpperCase()}
                                    </Text>
                                    <Text variant="bodySmall">{change.reason}</Text>
                                </View>
                            ))}
                        </Card.Content>
                    </Card>

                    {/* Comparison Baseline Logic:
                        - If viewing a Draft (Unsaved): Compare against the Last Saved Version (optimizedResume) 
                          so we only show the New Changes in this session.
                        - If viewing a Saved Result: Compare against the Original Upload (resume) 
                          so we show the total optimization impact.
                    */}
                    <BeforeAfterComparison
                        original={isUnsaved ? (currentAnalysis.optimizedResume || resume) : resume}
                        optimized={optimizedResume}
                        changes={changes}
                    />
                </>
            )}

            <View style={styles.actions}>
                {optimizedResume && (
                    <>
                        <Button
                            mode="outlined"
                            onPress={() => router.push('/optimization-editor')}
                            style={styles.button}
                        >
                            Review & Edit Changes
                        </Button>

                        <Button
                            mode="outlined"
                            onPress={() => router.push('/resume-preview')}
                            style={styles.button}
                        >
                            Preview Resume
                        </Button>



                        {/* ... rest of UI ... */}
                        {isUnsaved && (
                            <>
                                <Button
                                    mode="outlined"
                                    onPress={() => setRevertDialogVisible(true)}
                                    loading={saving}
                                    disabled={saving || optimizing}
                                    style={[styles.button, { marginTop: 12, borderColor: '#D32F2F', marginBottom: 8 }]}
                                    textColor="#D32F2F"
                                    icon="undo"
                                >
                                    Reject Changes & Revert
                                </Button>
                                {/* ... Validate button ... */}

                                <Button
                                    mode="contained"
                                    onPress={handleSave}
                                    loading={saving}
                                    disabled={saving || optimizing}
                                    style={[styles.button, { backgroundColor: '#4CAF50' }]}
                                    icon="check"
                                >
                                    Validate & Save to Dashboard
                                </Button>
                            </>
                        )}
                    </>
                )}
            </View>

            <SkillAdditionModal
                visible={skillModalVisible}
                skill={selectedSkillToAdd}
                resume={optimizedResume || resume} // Pass current visible resume for section selection context
                onDismiss={() => setSkillModalVisible(false)}
                onConfirm={handleConfirmAddSkill}
            />
            <Portal>
                <Dialog visible={revertDialogVisible} onDismiss={() => setRevertDialogVisible(false)} style={{ backgroundColor: '#FFF3E0' }}>
                    <Dialog.Title style={{ color: '#D32F2F', fontWeight: 'bold' }}>
                        ⚠️ Confirm Revert Changes
                    </Dialog.Title>
                    <Dialog.Content>
                        <Paragraph style={{ marginBottom: 12 }}>
                            All unsaved changes up until this point will be lost and you will need to re-optimize or add all the unsaved missing skills again .
                        </Paragraph>
                        <View style={{ backgroundColor: '#E3F2FD', padding: 12, borderRadius: 8, marginTop: 8 }}>
                            <Text variant="bodySmall" style={{ color: '#0D47A1' }}>
                                💡 <Text style={{ fontWeight: 'bold', color: '#0D47A1' }}>Tip:</Text> Please validate and save to dashboard if you are satisfied with the changes, before updating the resume with new skills.
                            </Text>
                        </View>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setRevertDialogVisible(false)}>Cancel</Button>
                        <Button
                            onPress={() => {
                                setRevertDialogVisible(false);
                                handleDiscard();
                            }}
                            textColor="#D32F2F"
                            labelStyle={{ fontWeight: 'bold' }}
                        >
                            Revert Changes
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    title: {
        marginBottom: 16,
    },
    card: {
        marginVertical: 12,
    },
    text: {
        marginTop: 8,
    },
    actions: {
        marginTop: 24,
        marginBottom: 32,
    },
    button: {
        marginBottom: 12,
    },
});
