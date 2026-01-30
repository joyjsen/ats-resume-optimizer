import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Button, Text, Card, ProgressBar, useTheme, Portal, Dialog, Paragraph } from 'react-native-paper';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { useResumeStore } from '../src/store/resumeStore';
import { useTaskQueue } from '../src/context/TaskQueueContext';
import { ATSScoreCard } from '../src/components/analysis/ATSScoreCard';
import { SkillsComparison } from '../src/components/analysis/SkillsComparison';
import { BeforeAfterComparison } from '../src/components/optimization/BeforeAfterComparison';
import { SkillAdditionModal } from '../src/components/analysis/SkillAdditionModal';
import { SkillMatch } from '../src/types/analysis.types';
import { notificationService } from '../src/services/firebase/notificationService';

import { useTokenCheck } from '../src/hooks/useTokenCheck';

export default function AnalysisResultScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const { currentAnalysis, setCurrentAnalysis } = useResumeStore();
    const { activeTasks } = useTaskQueue();

    // Local state
    const [optimizing, setOptimizing] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [isUnsaved, setIsUnsaved] = React.useState(!!currentAnalysis?.draftOptimizedResumeData);
    const [currentTaskId, setCurrentTaskId] = React.useState<string | null>(null);
    const [revertDialogVisible, setRevertDialogVisible] = React.useState(false);
    const completionHandledRef = React.useRef<string | null>(null);
    const analysisRef = React.useRef(currentAnalysis);

    // Keep ref updated for the listener
    React.useEffect(() => {
        analysisRef.current = currentAnalysis;
    }, [currentAnalysis]);

    // Derived State and Safety Check
    if (!currentAnalysis) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                <Text style={{ marginBottom: 16 }}>No analysis data found.</Text>
                <Button mode="contained" onPress={() => router.replace('/(tabs)/analyze')}>
                    Go to Analyze
                </Button>
            </View>
        );
    }

    const { job, resume } = currentAnalysis;

    // Determine what to show (Draft vs Final vs Original)
    const optimizedResume = currentAnalysis.draftOptimizedResumeData || currentAnalysis.optimizedResume;
    const changes = currentAnalysis.draftChangesData || currentAnalysis.changes;
    const atsScore = currentAnalysis.draftAtsScore || currentAnalysis.atsScore;
    const matchAnalysis = currentAnalysis.draftMatchAnalysis || currentAnalysis.optimizedMatchAnalysis || currentAnalysis.matchAnalysis;

    // Ideally we track original score separately, but fallback to current if not available
    const originalScore = currentAnalysis.atsScore;

    // Real-time subscription to analysis changes (Instant Sync)
    React.useEffect(() => {
        if (!currentAnalysis?.id) return;

        const { historyService } = require('../src/services/firebase/historyService');
        console.log(`[AnalysisResult] Subscribing to analysis: ${currentAnalysis.id}`);

        const unsubscribe = historyService.subscribeToAnalysis(currentAnalysis.id, (updated: any) => {
            if (updated) {
                // Check if we have new optimization data that we didn't have before
                const hasNewOptimization = updated.draftOptimizedResumeData && !analysisRef.current?.draftOptimizedResumeData;
                const hasFinalizedOptimization = updated.optimizedResumeData && !analysisRef.current?.optimizedResume;

                if (hasNewOptimization || hasFinalizedOptimization) {
                    console.log("[AnalysisResult] Received real-time update with optimization data!");
                    setOptimizing(false);
                    setCurrentTaskId(null);
                }

                // FIX: Ensure optimizing state is cleared even if draft already existed (sequential additions)
                const currentUpdatedAt = (analysisRef.current as any)?.updatedAt;
                const updatedUpdatedAt = (updated as any)?.updatedAt;

                if (updatedUpdatedAt && currentUpdatedAt) {
                    const currentMillis = typeof currentUpdatedAt.toMillis === 'function' ? currentUpdatedAt.toMillis() : new Date(currentUpdatedAt).getTime();
                    const updatedMillis = typeof updatedUpdatedAt.toMillis === 'function' ? updatedUpdatedAt.toMillis() : new Date(updatedUpdatedAt).getTime();

                    if (updatedMillis > currentMillis) {
                        console.log("[AnalysisResult] Detect update via timestamp change. Clearing optimizing state.");
                        setOptimizing(false);
                        setCurrentTaskId(null);
                    }
                }

                // Always sync the latest state from DB to Store
                setCurrentAnalysis({
                    ...updated.analysisData,
                    id: updated.id,
                    job: updated.jobData,
                    resume: updated.resumeData,
                    optimizedResume: updated.optimizedResumeData,
                    changes: updated.changesData,
                    optimizedMatchAnalysis: updated.optimizedMatchAnalysis,
                    draftOptimizedResumeData: updated.draftOptimizedResumeData,
                    draftChangesData: updated.draftChangesData,
                    draftAtsScore: updated.draftAtsScore,
                    draftMatchAnalysis: updated.draftMatchAnalysis,
                    atsScore: updated.atsScore
                });
                setIsUnsaved(!!updated.draftOptimizedResumeData);
            }
        });

        return () => {
            console.log("[AnalysisResult] Unsubscribing");
            unsubscribe();
        };
    }, [currentAnalysis?.id]);

    // Cleanup active task if we see it finish via context (Just for spinner state management)
    React.useEffect(() => {
        if (!currentTaskId) {
            // If optimizing is still true but task is gone, clear it
            if (optimizing && activeTasks.length === 0) {
                setOptimizing(false);
            }
            return;
        }
        const task = activeTasks.find(t => t.id === currentTaskId);
        if (!task) {
            // Task disappeared (finished successfully or cancelled elsewhere)
            console.log("[AnalysisResult] Task disappeared from activeTasks. Clearing optimizing state.");
            setOptimizing(false);
            setCurrentTaskId(null);
        } else if (task.status === 'failed') {
            setOptimizing(false);
            setCurrentTaskId(null);
            const { Alert } = require('react-native');
            Alert.alert("Optimization Failed", "The process encountered an error. Please try again.");
        } else if (task.status === 'completed') {
            // Redundant second check just in case subscription is slow
            setOptimizing(false);
            setCurrentTaskId(null);
        }
    }, [activeTasks, currentTaskId, optimizing]);

    // CRITICAL FIX: Ensure navigation gestures remain enabled after updates
    React.useEffect(() => {
        // Force enable back button and gestures after any state change
        navigation.setOptions({
            gestureEnabled: true,
            headerBackVisible: true,
        });

        // Cleanup function to ensure we don't leave any navigation blockers
        return () => {
            navigation.setOptions({
                gestureEnabled: true,
            });
        };
    }, [navigation, currentAnalysis?.id, optimizing, isUnsaved]); // Re-run when key states change

    const { checkTokens } = useTokenCheck();

    const handleOptimize = async () => {
        if (!checkTokens(15)) return;
        setOptimizing(true);

        try {
            const { taskService } = require('../src/services/firebase/taskService');
            const { activityService } = require('../src/services/firebase/activityService');

            // 1. DEDUCT TOKENS FIRST - This ensures the user is charged before any AI work begins
            try {
                await activityService.logActivity({
                    type: 'resume_optimized',
                    description: `Initial Optimization for ${job.title} at ${job.company}`,
                    resourceId: currentAnalysis.id,
                });
                console.log("[AnalysisResult] Tokens deducted successfully BEFORE task creation");
            } catch (deductError: any) {
                console.error("[AnalysisResult] Token deduction failed:", deductError);
                setOptimizing(false);
                const { Alert } = require('react-native');
                Alert.alert("Token Error", deductError.message || "Failed to deduct tokens. Please try again.");
                return;
            }

            // 2. CREATE TASK ONLY AFTER SUCCESSFUL DEDUCTION
            // Check if already running for this analysis
            const existing = activeTasks.find(t =>
                t.type === 'optimize_resume' &&
                t.payload.currentAnalysis?.id === currentAnalysis.id &&
                t.status !== 'failed' &&
                t.status !== 'completed' &&
                t.status !== 'cancelled'
            );

            if (existing) {
                console.log("[handleOptimize] Found existing task:", existing.id);
                setCurrentTaskId(existing.id);
                return;
            }

            const taskId = await taskService.createTask('optimize_resume', {
                resume,
                job,
                currentAnalysis
            });

            console.log("[handleOptimize] Created new task:", taskId);
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
        if (!checkTokens(15, () => setSkillModalVisible(false))) return;

        setSkillModalVisible(false);
        setOptimizing(true); // Re-use optimizing state for spinner

        try {
            const { taskService } = require('../src/services/firebase/taskService');
            const { activityService } = require('../src/services/firebase/activityService');

            // 1. DEDUCT TOKENS FIRST
            try {
                await activityService.logActivity({
                    type: 'skill_incorporation',
                    description: `Incorporated skill "${skill}" into resume for ${job?.title || "job"}`,
                    resourceId: currentAnalysis.id,
                });
                console.log("[AnalysisResult] Skill addition tokens deducted successfully BEFORE task creation");
            } catch (deductError: any) {
                console.error("[AnalysisResult] Skill addition token deduction failed:", deductError);
                setOptimizing(false);
                const { Alert } = require('react-native');
                Alert.alert("Token Error", deductError.message || "Failed to deduct tokens. Please try again.");
                return;
            }

            // 2. CREATE TASK AFTER DEDUCTION
            // Pass the CURRENTLY displayed resume (could be already partially optimized/draft)
            // If optimizedResume exists (draft or final), use that. Otherwise use original 'resume'.
            const baseResume = currentAnalysis.draftOptimizedResumeData || currentAnalysis.optimizedResume || currentAnalysis.resume;

            const taskId = await taskService.createTask('add_skill', {
                skill,
                targetSections: sections,
                resume: baseResume,
                currentAnalysis: currentAnalysis // Pass full object so worker knows IDs and existing changes
            });

            console.log("[handleConfirmAddSkill] Created new task:", taskId);
            setCurrentTaskId(taskId);

        } catch (error: any) {
            console.error(error);
            setOptimizing(false);
            const { Alert } = require('react-native');
            Alert.alert("Task Error", error.message || "Failed to start skill addition process.");
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { historyService } = require('../src/services/firebase/historyService');

            if (currentAnalysis.id) {
                // Determine if this is the FIRST optimization (Baseline check)
                const isInitialOptimization = !currentAnalysis.optimizedResume;

                // Promote the draft to final
                const success = await historyService.promoteDraftToFinal(currentAnalysis.id);
                if (success) {
                    setIsUnsaved(false);

                    // LOG ACTIVITY - Use skipTokenDeduction because tokens were already deducted at the start of generation
                    const { activityService } = require('../src/services/firebase/activityService');
                    await activityService.logActivity({
                        type: isInitialOptimization ? 'resume_optimized' : 'resume_reoptimization',
                        description: isInitialOptimization
                            ? `Initial optimization for ${currentAnalysis.job.title}`
                            : `Refined & re-optimized resume for ${currentAnalysis.job.title}`,
                        resourceId: currentAnalysis.id,
                        resourceName: currentAnalysis.job.title,
                        skipTokenDeduction: true
                    }).catch((e: any) => console.error("Validation activity log failed:", e));

                    // Trigger Push Notification via Ghost Task
                    try {
                        const { taskService } = require('../src/services/firebase/taskService');
                        const taskId = await taskService.createTask('resume_validation', {
                            analysisId: currentAnalysis.id,
                            jobTitle: currentAnalysis.job.title
                        });
                        await taskService.completeTask(taskId, currentAnalysis.id);
                    } catch (pushError) {
                        console.warn("Failed to trigger validation push notification:", pushError);
                    }

                    // Send local push notification for validation completion - REMOVED (Duplicate)
                    /*
                    await notificationService.notifyValidationComplete(
                        currentAnalysis.job.title,
                        currentAnalysis.id
                    ).catch((e: any) => console.warn("Validation notification failed:", e));
                    */

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

    const theme = useTheme();

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <ScrollView style={styles.container}>
                <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onBackground }]}>
                    {optimizedResume ? "✅ Analysis & Optimization" : "📊 Analysis Result"}
                </Text>

                {optimizing && currentTaskId && (
                    <Card style={{ marginBottom: 16, borderColor: theme.colors.primary, borderWidth: 1 }}>
                        <Card.Content>
                            <Text variant="titleSmall" style={{ fontWeight: 'bold', color: theme.colors.primary, marginBottom: 4 }}>
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

                {currentAnalysis.isLocked && (
                    <Card style={{ marginBottom: 16, backgroundColor: theme.colors.elevation.level2, borderColor: theme.colors.primary, borderWidth: 1 }}>
                        <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ fontSize: 24, marginRight: 12 }}>🔒</Text>
                            <View style={{ flex: 1 }}>
                                <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                                    Application Submitted
                                </Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                    This resume is locked because you have submitted your application. You cannot make further changes.
                                </Text>
                            </View>
                        </Card.Content>
                    </Card>
                )}

                <ATSScoreCard score={atsScore} originalScore={originalScore} />

                {/* Show "New" skills if we have a draft match analysis that differs from original */}
                <SkillsComparison
                    matchAnalysis={matchAnalysis}
                    originalMatchAnalysis={currentAnalysis.matchAnalysis}
                    changes={changes}
                    onSkillPress={(skill) => {
                        if (currentAnalysis.isLocked) {
                            const { Alert } = require('react-native');
                            Alert.alert("Resume Locked", "You cannot add skills after submitting your application.");
                            return;
                        }
                        // Block skill addition if there's unsaved optimization
                        const hasUnsavedOptimization = currentAnalysis.draftOptimizedResumeData && !currentAnalysis.optimizedResume;
                        if (hasUnsavedOptimization) {
                            const { Alert } = require('react-native');
                            Alert.alert(
                                "Unsaved Optimization",
                                "Please validate and save your optimized resume before adding skills. This ensures the baseline ATS score is properly set for accurate skill addition calculations."
                            );
                            return;
                        }
                        handleSkillPress(skill);
                    }}
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
                                    disabled={currentAnalysis.isLocked}
                                >
                                    {currentAnalysis.isLocked ? "Optimizer Locked" : "✨ Rewrite & Optimize Resume"}
                                </Button>
                            ) : (
                                <View style={{ marginTop: 16 }}>
                                    <Text variant="bodySmall" style={{ marginBottom: 8, textAlign: 'center', color: theme.colors.primary }}>
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
                        {changes && changes.length > 0 && (
                            <Card style={styles.card}>
                                <Card.Content>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Text variant="titleMedium">What We Optimized</Text>
                                        <Text variant="bodySmall" style={{ color: '#666' }}>
                                            {(currentAnalysis as any).updatedAt
                                                ? new Date((currentAnalysis as any).updatedAt).toLocaleString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                    hour12: true
                                                })
                                                : ''}
                                        </Text>
                                    </View>
                                    <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                                        We've enhanced your resume with {changes.length} improvement{changes.length !== 1 ? 's' : ''} to boost your ATS score to {atsScore}%.
                                    </Text>

                                    {changes.map((change, index) => (
                                        <View key={index} style={{ marginBottom: 12, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#4CAF50' }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text variant="labelLarge" style={{ color: '#2E7D32' }}>
                                                    {change.type
                                                        ? change.type
                                                            .replace(/([A-Z])/g, ' $1') // Add space before capital letters
                                                            .replace(/_/g, ' ')         // Replace underscores with spaces
                                                            .trim()
                                                            .toUpperCase()
                                                        : 'CHANGE'}
                                                </Text>
                                                {change.section && (
                                                    <Text variant="labelSmall" style={{ color: '#666', backgroundColor: '#f0f0f0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                        {change.section}
                                                    </Text>
                                                )}
                                            </View>
                                            <Text variant="bodySmall">{change.reason}</Text>
                                        </View>
                                    ))}
                                </Card.Content>
                            </Card>
                        )}

                        {/* Comparison Baseline Logic:
                        - Compare against the previously SAVED resume version.
                        - If there's a saved optimizedResume, use that as baseline (shows only new changes).
                        - Otherwise fall back to original resume (shows all changes since start).
                        This ensures the preview shows ONLY what changed in the current operation.
                    */}
                        <BeforeAfterComparison
                            original={currentAnalysis.optimizedResume || currentAnalysis.resume || resume}
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

            </ScrollView>
            <SkillAdditionModal
                visible={skillModalVisible}
                skill={selectedSkillToAdd}
                resume={optimizedResume || resume} // Pass current visible resume for section selection context
                onDismiss={() => setSkillModalVisible(false)}
                onConfirm={handleConfirmAddSkill}
                jobTitle={currentAnalysis.job.title}
                companyName={currentAnalysis.job.company}
            />
            <Portal>
                <Dialog visible={revertDialogVisible} onDismiss={() => setRevertDialogVisible(false)} style={{ backgroundColor: theme.colors.elevation.level3 }}>
                    <Dialog.Title style={{ color: theme.colors.error, fontWeight: 'bold' }}>
                        ⚠️ Confirm Revert Changes
                    </Dialog.Title>
                    <Dialog.Content>
                        <Paragraph style={{ marginBottom: 12 }}>
                            All unsaved changes up until this point will be lost and you will need to re-optimize or add all the unsaved missing skills again .

                            ⚠️ Tokens have already been deducted for this analysis and they will NOT be refunded if you reject the changes. You will need to use new tokens to re-do this activity.
                        </Paragraph>
                        <View style={{ backgroundColor: theme.colors.elevation.level1, padding: 12, borderRadius: 8, marginTop: 8 }}>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                💡 <Text style={{ fontWeight: 'bold', color: theme.colors.onSurfaceVariant }}>Tip:</Text> Please validate and save to dashboard if you are satisfied with the changes, before updating the resume with new skills.
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
        </View>
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
