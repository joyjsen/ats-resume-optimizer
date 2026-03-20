import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native';
import { Button, Text, Card, ProgressBar, useTheme, Portal, Dialog, Paragraph, IconButton, Chip, ActivityIndicator } from 'react-native-paper';
import { moderateScale } from '../src/utils/responsive';

const isAndroid = Platform.OS === 'android';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { useResumeStore } from '../src/store/resumeStore';
import { useTaskQueue } from '../src/context/TaskQueueContext';
import { ATSScoreCard } from '../src/components/analysis/ATSScoreCard';
import { SkillsComparison } from '../src/components/analysis/SkillsComparison';
import { BeforeAfterComparison } from '../src/components/optimization/BeforeAfterComparison';
import { SkillAdditionModal } from '../src/components/analysis/SkillAdditionModal';
import { SkillMatch } from '../src/types/analysis.types';
import { notificationService } from '../src/services/firebase/notificationService';
import { ParsedResumeViewer } from '../src/components/upload/ParsedResumeViewer';
import { TokenBalance } from '../src/components/layout/TokenBalance';
import { verticalScale, horizontalScale } from '../src/utils/responsive';

import { useTokenCheck } from '../src/hooks/useTokenCheck';

export default function AnalysisResultScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const { currentAnalysis, setCurrentAnalysis } = useResumeStore();
    const { activeTasks } = useTaskQueue();
    const { id: paramId } = useLocalSearchParams<{ id: string }>();
    const [isAuthReady, setIsAuthReady] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [isInitialLoading, setIsInitialLoading] = React.useState(true);

    // Fallback: if params don't carry the ID (Android notification issue), use store ID
    const id = paramId || currentAnalysis?.id || undefined;
    console.log(`[AnalysisResult] Render. paramId=${paramId}, storeId=${currentAnalysis?.id}, resolvedId=${id}`);

    // 1. Wait for Auth Session to restore (Prevents Permission Denied on cold start)
    React.useEffect(() => {
        let unsubscribeAuth: any = undefined;

        const initAuth = async () => {
            try {
                const { getFirebaseAuth } = await import('../src/services/firebase/config');
                const auth = await getFirebaseAuth();

                // If already logged in, set ready immediately
                if (auth.currentUser) {
                    console.log("[AnalysisResult] Auth already ready (currentUser exists).");
                    setIsAuthReady(true);
                    return; // No need to subscribe if already ready
                }

                const { onAuthStateChanged } = await import('firebase/auth');

                unsubscribeAuth = onAuthStateChanged(auth, (user: any) => {
                    if (user) {
                        console.log("[AnalysisResult] Auth state ready via listener.");
                        setIsAuthReady(true);
                    } else {
                        console.warn("[AnalysisResult] Auth state changed: No user detected.");
                    }
                });
            } catch (error) {
                console.error("[AnalysisResult] Auth init failed:", error);
            }
        };

        if (!isAuthReady) {
            initAuth();
        }

        return () => {
            if (unsubscribeAuth) unsubscribeAuth();
        };
    }, []);

    const fetchAnalysis = React.useCallback(async () => {
        if (!id) return;
        console.log(`[AnalysisResult] fetchAnalysis triggered for ID: ${id}`);
        setError(null);
        setIsInitialLoading(true);
        try {
            const { historyService } = require('../src/services/firebase/historyService');
            const analysis = await historyService.getAnalysisById(id);
            if (analysis) {
                console.log(`[AnalysisResult] Successfully fetched analysis document: ${analysis.id}`);
                setCurrentAnalysis({
                    ...analysis.analysisData,
                    id: analysis.id,
                    job: analysis.jobData,
                    resume: analysis.resumeData,
                    optimizedResume: analysis.optimizedResumeData,
                    changes: analysis.changesData,
                    optimizedMatchAnalysis: analysis.optimizedMatchAnalysis,
                    draftOptimizedResumeData: analysis.draftOptimizedResumeData,
                    draftChangesData: analysis.draftChangesData,
                    draftAtsScore: analysis.draftAtsScore,
                    draftMatchAnalysis: analysis.draftMatchAnalysis,
                    atsScore: analysis.atsScore ?? analysis.analysisData?.atsScore ?? 0
                });
            } else {
                console.error(`[AnalysisResult] No document found for ID: ${id}`);
                setError(`Analysis not found (ID: ${id}). If this was from a notification, please try opening it from the Optimize tab.`);
            }
        } catch (err: any) {
            console.error(`[AnalysisResult] Load error for ID ${id}:`, err);
            setError(err.message || "Failed to load analysis.");
        } finally {
            setIsInitialLoading(false);
        }
    }, [id, setCurrentAnalysis]);

    // 2. Initial load from params if store is empty or mismatched
    React.useEffect(() => {
        if (!isAuthReady || !id) return;

        if (currentAnalysis && currentAnalysis.id === id) {
            console.log("[AnalysisResult] Data already in store, clearing initial loading.");
            setIsInitialLoading(false);
        } else {
            console.log("[AnalysisResult] Store mismatch or empty. Fetching analysis...");
            fetchAnalysis();
        }
    }, [isAuthReady, id, currentAnalysis?.id, fetchAnalysis]);

    // 3. Timeout fallback for the loading screen
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (isInitialLoading) {
                console.warn("[AnalysisResult] Loading timeout reached.");
                if (!isAuthReady) {
                    setError("Auth session taking longer than expected. Please ensure you are logged in.");
                } else if (!id) {
                    setError("Could not determine which analysis to load. Please go back and try again from the Optimize tab.");
                } else {
                    setError("The analysis is taking too long to load. Please try again.");
                }
            }
        }, 10000); // 10 seconds
        return () => clearTimeout(timer);
    }, [isInitialLoading, isAuthReady, id]);

    // Local state
    const [optimizing, setOptimizing] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [isUnsaved, setIsUnsaved] = React.useState(!!currentAnalysis?.draftOptimizedResumeData);
    const [currentTaskId, setCurrentTaskId] = React.useState<string | null>(null);
    const [revertDialogVisible, setRevertDialogVisible] = React.useState(false);
    const [skillModalVisible, setSkillModalVisible] = React.useState(false);
    const [selectedSkillToAdd, setSelectedSkillToAdd] = React.useState<string | null>(null);
    const [selectedSkillMatch, setSelectedSkillMatch] = React.useState<SkillMatch | null>(null);
    const [isAppraisalCollapsed, setIsAppraisalCollapsed] = React.useState(true);
    const [isOptimizedCollapsed, setIsOptimizedCollapsed] = React.useState(true);
    const [isViewerVisible, setIsViewerVisible] = React.useState(false);
    const completionHandledRef = React.useRef<string | null>(null);
    const analysisRef = React.useRef(currentAnalysis);
    const processingRef = React.useRef(false);

    // Derived state: is there an active task for this analysis? (survives navigation)
    const isActivelyProcessing = React.useMemo(() => {
        if (!currentAnalysis?.id || activeTasks.length === 0) return false;
        return activeTasks.some(t =>
            (t.type === 'optimize_resume' || t.type === 'add_skill') &&
            t.payload?.currentAnalysis?.id === currentAnalysis.id &&
            (t.status === 'queued' || t.status === 'processing')
        );
    }, [currentAnalysis?.id, activeTasks]);

    // Detect in-progress optimization task on mount/remount
    // This prevents the button from resetting to active when navigating away and back
    React.useEffect(() => {
        if (!currentAnalysis?.id || activeTasks.length === 0) return;

        const existingTask = activeTasks.find(t =>
            (t.type === 'optimize_resume' || t.type === 'add_skill') &&
            t.payload?.currentAnalysis?.id === currentAnalysis.id &&
            (t.status === 'queued' || t.status === 'processing')
        );

        if (existingTask && !optimizing) {
            console.log(`[AnalysisResult] Found in-progress task ${existingTask.id} on mount. Restoring optimizing state.`);
            setOptimizing(true);
            setCurrentTaskId(existingTask.id);
        }
    }, [currentAnalysis?.id, activeTasks]);

    // Keep ref updated for the listener
    React.useEffect(() => {
        analysisRef.current = currentAnalysis;
    }, [currentAnalysis]);

    const { checkTokens } = useTokenCheck();

    // Real-time subscription to analysis changes (Instant Sync)
    React.useEffect(() => {
        if (!isAuthReady || !currentAnalysis?.id) return;

        // Safety: If the store ID doesn't match the URL ID, don't subscribe yet.
        // This prevents subscribing to "stale" store data while hydration is pending.
        if (id && currentAnalysis.id !== id) {
            console.log("[AnalysisResult] Store ID and URL ID mismatch. Skipping subscription until sync.");
            return;
        }

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

                // FIX: Only clear optimizing state via timestamp if we also have NEW optimization data
                // A timestamp change alone doesn't mean optimization is done — it could be from task creation
                const currentUpdatedAt = (analysisRef.current as any)?.updatedAt;
                const updatedUpdatedAt = (updated as any)?.updatedAt;

                if (updatedUpdatedAt && currentUpdatedAt) {
                    const currentMillis = typeof currentUpdatedAt.toMillis === 'function' ? currentUpdatedAt.toMillis() : new Date(currentUpdatedAt).getTime();
                    const updatedMillis = typeof updatedUpdatedAt.toMillis === 'function' ? updatedUpdatedAt.toMillis() : new Date(updatedUpdatedAt).getTime();

                    if (updatedMillis > currentMillis && (updated.draftOptimizedResumeData || updated.optimizedResumeData)) {
                        console.log("[AnalysisResult] Detect update with optimization data. Clearing optimizing state.");
                        setOptimizing(false);
                        setCurrentTaskId(null);
                        processingRef.current = false;
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
    }, [isAuthReady, currentAnalysis?.id, id]);

    // Cleanup active task if we see it finish via context (Just for spinner state management)
    const optimizingClearedRef = React.useRef(false);
    React.useEffect(() => {
        if (!currentTaskId) {
            // If optimizing is still true but no task ID and no active tasks,
            // use a grace period to allow the task queue to pick up the task
            if (optimizing && activeTasks.length === 0) {
                if (!optimizingClearedRef.current) {
                    optimizingClearedRef.current = true;
                    // Grace period: wait 5 seconds before clearing — task queue may just be starting
                    const timer = setTimeout(() => {
                        // Re-check: still no task after waiting?
                        if (!currentTaskId && activeTasks.length === 0) {
                            setOptimizing(false);
                        }
                        optimizingClearedRef.current = false;
                    }, 5000);
                    return () => { clearTimeout(timer); optimizingClearedRef.current = false; };
                }
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

    // CRITICAL FIX: Ensure navigation gestures remain enabled and provide explicit back button
    React.useLayoutEffect(() => {
        navigation.setOptions({
            gestureEnabled: true,
            headerBackVisible: false, // Hide default to use our explicit one
            headerLeft: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: moderateScale(isAndroid ? 4 : 8) }}>
                    <IconButton
                        icon="arrow-left"
                        onPress={() => {
                            console.log("[AnalysisResult] Explicit Back Press");
                            if (router.canGoBack()) {
                                router.back();
                            } else {
                                // Cold start from notification: no back stack exists.
                                // Use replace to properly initialize the tab navigator.
                                router.replace('/(tabs)/home' as any);
                            }
                        }}
                        size={moderateScale(24)}
                        style={{ margin: 0 }}
                    />
                    <TokenBalance />
                </View>
            ),
        });
    }, [navigation, currentAnalysis?.id, optimizing, isUnsaved]);

    const theme = useTheme();

    // Derived State and Safety Check
    if (!isAuthReady || isInitialLoading || !currentAnalysis || (id && currentAnalysis.id !== id)) {
        // Determine a helpful status message
        const loadingStatus = !isAuthReady
            ? 'Restoring your session...'
            : !id
                ? 'Preparing analysis data...'
                : 'Loading analysis results...';

        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: theme.colors.background }}>
                {!error ? (
                    <>
                        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginBottom: 24 }} />
                        <Text variant="titleMedium" style={{ marginBottom: 8, fontWeight: 'bold' }}>Loading Analysis</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{loadingStatus}</Text>
                    </>
                ) : (
                    <>
                        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} style={{ marginBottom: 16 }} />
                        <Text variant="titleMedium" style={{ color: theme.colors.error, marginBottom: 8, textAlign: 'center' }}>Something went wrong</Text>
                        <Text variant="bodyMedium" style={{ marginBottom: 24, textAlign: 'center' }}>{error}</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <Button mode="outlined" onPress={() => {
                                if (router.canGoBack()) {
                                    router.back();
                                } else {
                                    router.replace('/(tabs)/home' as any);
                                }
                            }}>
                                Go Back
                            </Button>
                            {id && (
                                <Button mode="contained" onPress={fetchAnalysis}>
                                    Retry
                                </Button>
                            )}
                        </View>
                    </>
                )}
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

    const handleSkillPress = (skillMatch: SkillMatch) => {
        if (optimizing) {
            const { Alert } = require('react-native');
            Alert.alert("Please Wait", "A skill addition or optimization is already in progress. Please wait for it to complete.");
            return;
        }

        setSelectedSkillToAdd(skillMatch.skill);
        setSelectedSkillMatch(skillMatch);
        setSkillModalVisible(true);
    };

    const handleConfirmAddSkill = async (skill: string, sections: string[]) => {
        if (!checkTokens(15, () => setSkillModalVisible(false))) return;

        setSkillModalVisible(false);
        setOptimizing(true); // Re-use optimizing state for spinner

        try {
            const { taskService } = require('../src/services/firebase/taskService');
            // 1. DUPLICATE CHECK: Prevent starting a new task if one is already running (Ref check for immediate block)
            if (processingRef.current) {
                console.log("[handleConfirmAddSkill] Blocked duplicate task creation via Ref lock.");
                return;
            }
            processingRef.current = true;

            // 1b. DUPLICATE CHECK: Prevent starting a new task if one is already running (Queue check)
            const existingTask = activeTasks.find(t =>
                (t.type === 'add_skill' || t.type === 'optimize_resume') &&
                t.status !== 'failed' &&
                t.status !== 'completed' &&
                t.status !== 'cancelled'
            );

            if (existingTask) {
                console.log("[handleConfirmAddSkill] Blocked duplicate task creation. Existing:", existingTask.id);
                setOptimizing(true);
                setCurrentTaskId(existingTask.id);
                processingRef.current = false; // Release lock if we just found an existing one
                return;
            }

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
                processingRef.current = false; // Release lock on token error
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
            processingRef.current = false; // Release lock — task is now created and tracked by currentTaskId

        } catch (error: any) {
            console.error(error);
            setOptimizing(false);
            processingRef.current = false; // Release lock
            const { Alert } = require('react-native');
            Alert.alert("Task Error", error.message || "Failed to start skill addition process.");
        }
    };

    const handleSave = async () => {
        setSaving(true);

        // Safety timeout - if save takes longer than 15 seconds, force reset
        const safetyTimeout = setTimeout(() => {
            console.warn("[handleSave] Safety timeout triggered - forcing save state reset");
            setSaving(false);
            const { Alert } = require('react-native');
            Alert.alert("Save Timeout", "The save operation took too long. Your changes may have been saved - please check the Applications tab.");
        }, 15000);

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

                    // Trigger a local push notification for the save
                    try {
                        const { notificationService } = require('../src/services/firebase/notificationService');
                        await notificationService.scheduleLocalNotification(
                            "Resume Validated & Saved",
                            `Your optimized resume for ${currentAnalysis.job.title} has been saved to your dashboard.`,
                            {
                                route: '/analysis-result',
                                params: { id: currentAnalysis.id }
                            }
                        );
                    } catch (pushError) {
                        console.warn("Failed to trigger validation push notification:", pushError);
                    }

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
                    const { Alert } = require('react-native');
                    Alert.alert("Save Failed", "Could not save changes. Please try again.");
                }
            }

        } catch (error: any) {
            console.error("[handleSave] Error:", error);
            const { Alert } = require('react-native');
            Alert.alert("Save Error", error.message || "An unexpected error occurred while saving.");
        } finally {
            clearTimeout(safetyTimeout);
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
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
            >
                <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 16, color: theme.colors.onSurface }}>
                    {optimizedResume ? "✅ Analysis & Optimization" : "📊 Initial Optimization"}
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

                {matchAnalysis.verdictSummary && (
                    <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level2, borderColor: theme.colors.primary, borderWidth: 1 }]}>
                        <Card.Content>
                            <TouchableOpacity
                                onPress={() => setIsAppraisalCollapsed(!isAppraisalCollapsed)}
                                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isAppraisalCollapsed ? 0 : 8 }}
                                activeOpacity={0.7}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 20, marginRight: 8 }}>📋</Text>
                                    <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.colors.primary }}>Appraisal Assessment</Text>
                                </View>
                                <MaterialCommunityIcons
                                    name={isAppraisalCollapsed ? "chevron-down" : "chevron-up"}
                                    size={24}
                                    color={theme.colors.primary}
                                />
                            </TouchableOpacity>

                            {!isAppraisalCollapsed && (
                                <>
                                    <Text variant="bodyMedium" style={{ fontStyle: 'italic', lineHeight: 22 }}>
                                        "{matchAnalysis.executiveSummary || matchAnalysis.verdictSummary}"
                                    </Text>

                                    {matchAnalysis.readinessVerdict && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
                                            <Chip
                                                style={{ backgroundColor: theme.colors.primaryContainer }}
                                                textStyle={{ color: theme.colors.onPrimaryContainer, fontWeight: 'bold', fontSize: 11 }}
                                            >
                                                VERDICT: {matchAnalysis.readinessVerdict.replace('_', ' ').toUpperCase()}
                                            </Chip>
                                            <View style={{ backgroundColor: theme.colors.surfaceVariant, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                                                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                                    ATS Score: {atsScore}%
                                                </Text>
                                            </View>
                                        </View>
                                    )}

                                    {matchAnalysis.experienceMatch && (
                                        <View style={{ marginTop: 16, backgroundColor: theme.colors.elevation.level3, padding: 12, borderRadius: 8 }}>
                                            <Text variant="labelMedium" style={{ fontWeight: 'bold', marginBottom: 8, color: theme.colors.primary }}>Experience Alignment</Text>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Job Requirement:</Text>
                                                <Text variant="bodySmall" style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>{matchAnalysis.experienceMatch.requiredYears || 'Not specified'}</Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Your Profile:</Text>
                                                <Text variant="bodySmall" style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>{matchAnalysis.experienceMatch.candidateYears || 'Calculated'}</Text>
                                            </View>
                                            {matchAnalysis.experienceMatch.seniorityAlignment && (
                                                <View style={{ marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant }}>
                                                    <Text variant="labelSmall" style={{ color: theme.colors.secondary, lineHeight: 16 }}>
                                                        💡 <Text style={{ fontWeight: 'bold' }}>Seniority Check:</Text> {matchAnalysis.experienceMatch.seniorityAlignment}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </>
                            )}
                        </Card.Content>
                    </Card>
                )}

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
                        handleSkillPress(skill);
                    }}
                />

                {!optimizedResume && (
                    <Card style={styles.card}>
                        <Card.Content>
                            <Text variant="titleMedium" style={{ marginBottom: 8 }}>Recommendation</Text>
                            <Text variant="bodyMedium">
                                {currentAnalysis.recommendation?.reasoning || "Analysis successfully completed. Proceed to optimization."}
                            </Text>

                            {!optimizing ? (
                                <>
                                    <Button
                                        mode="outlined"
                                        onPress={() => setIsViewerVisible(true)}
                                        style={{ marginBottom: 16, borderColor: theme.colors.primary }}
                                        icon="file-document-outline"
                                    >
                                        Preview Original Resume
                                    </Button>

                                    <View style={{ marginTop: 16, position: 'relative' }}>
                                        <Button
                                            mode="contained"
                                            onPress={handleOptimize}
                                            disabled={currentAnalysis.isLocked || optimizing}
                                        >
                                            {currentAnalysis.isLocked ? "Optimizer Locked" : "✨ Rewrite & Optimize Resume"}
                                        </Button>
                                        <IconButton
                                            icon="information-outline"
                                            size={moderateScale(20)}
                                            iconColor="orange"
                                            style={{
                                                position: 'absolute',
                                                top: moderateScale(-4),
                                                right: moderateScale(0),
                                                zIndex: 1
                                            }}
                                            onPress={() => Alert.alert("Cost Information", "Each Rewrite & Optimize Resume costs 15 tokens")}
                                        />
                                    </View>
                                    {currentAnalysis.recommendation?.action === 'upskill' && (
                                        <Button
                                            mode="outlined"
                                            onPress={() => router.push({ pathname: '/upskilling-path', params: { id: currentAnalysis.id } } as any)}
                                            style={{ marginTop: 8 }}
                                            icon="school"
                                        >
                                            View Detailed Learning Path
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <Button
                                        mode="contained"
                                        disabled={true}
                                        loading={true}
                                        style={{ marginTop: 16 }}
                                    >
                                        Optimizing...
                                    </Button>
                                    <View style={{ marginTop: 8 }}>
                                        <Text variant="bodySmall" style={{ textAlign: 'center', color: theme.colors.primary }}>
                                            {activeTasks.find(t => t.id === currentTaskId)?.stage || 'Processing in background...'}
                                        </Text>
                                    </View>
                                </>
                            )}
                        </Card.Content>
                    </Card>
                )}

                {
                    optimizedResume && changes && (
                        <>
                            {changes && changes.length > 0 && (
                                <Card style={styles.card}>
                                    <Card.Content>
                                        <TouchableOpacity
                                            onPress={() => setIsOptimizedCollapsed(!isOptimizedCollapsed)}
                                            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isOptimizedCollapsed ? 0 : 8 }}
                                            activeOpacity={0.7}
                                        >
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1, marginRight: 8 }}>
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
                                            <MaterialCommunityIcons
                                                name={isOptimizedCollapsed ? "chevron-down" : "chevron-up"}
                                                size={24}
                                                color={theme.colors.onSurfaceVariant}
                                            />
                                        </TouchableOpacity>

                                        {!isOptimizedCollapsed && (
                                            <>
                                                <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                                                    We've enhanced your resume with {changes.length} improvement{changes.length !== 1 ? 's' : ''} to boost your ATS score to {atsScore}%.
                                                </Text>

                                                {changes.map((change, index) => (
                                                    <View key={`${change.type}-${index}`} style={{ marginBottom: 12, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#4CAF50' }}>
                                                        <View>
                                                            <Text variant="labelLarge" style={{ color: '#2E7D32' }}>
                                                                {change.type
                                                                    ? change.type
                                                                        .replace(/_/g, ' ')
                                                                        .replace(/([a-z])([A-Z])/g, '$1 $2')
                                                                        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
                                                                        .replace(/(REWRITE|ADDITION|IMPROVEMENT|REMOVAL|UPDATE|INTEGRATION)$/i, ' $1')
                                                                        .trim()
                                                                        .toUpperCase()
                                                                    : 'CHANGE'}
                                                            </Text>
                                                            {change.section && (
                                                                <Text variant="labelSmall" style={{ color: '#666', backgroundColor: '#f0f0f0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 }}>
                                                                    {change.section}
                                                                </Text>
                                                            )}
                                                        </View>
                                                        <Text variant="bodySmall" style={{ marginTop: 4 }}>{change.reason}</Text>
                                                    </View>
                                                ))}
                                            </>
                                        )}
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
                                isUnsaved={isUnsaved}
                            />
                        </>
                    )
                }

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
                                        disabled={saving || optimizing || isActivelyProcessing}
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
                                        disabled={saving || optimizing || isActivelyProcessing}
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

            </ScrollView >

            <SkillAdditionModal
                visible={skillModalVisible}
                skill={selectedSkillToAdd}
                skillMatch={selectedSkillMatch}
                resume={optimizedResume || resume}
                onDismiss={() => {
                    setSkillModalVisible(false);
                    setSelectedSkillMatch(null);
                }}
                onConfirm={handleConfirmAddSkill}
                onOptimize={handleOptimize}
                isOptimized={!!optimizedResume}
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

            {/* Resume Viewer Modal */}
            <ParsedResumeViewer
                visible={isViewerVisible}
                onClose={() => setIsViewerVisible(false)}
                parsedData={currentAnalysis?.resume}
                rawText={currentAnalysis?.resume?.text || ''}
            />
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: horizontalScale(16),
        paddingBottom: verticalScale(16),
    },
    title: {
        marginBottom: verticalScale(16),
    },
    card: {
        marginVertical: verticalScale(8),
    },
    text: {
        marginTop: verticalScale(4),
    },
    actions: {
        marginTop: verticalScale(16),
        paddingBottom: verticalScale(8),
    },
    button: {
        marginBottom: verticalScale(10),
    },
});
