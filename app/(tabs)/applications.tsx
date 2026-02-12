import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, ScrollView, Keyboard, Platform, AppState } from 'react-native';
import { Text, Button, Searchbar, SegmentedButtons, FAB, useTheme, ActivityIndicator, Portal, Dialog, TextInput, ProgressBar, Card, Chip, Divider, IconButton } from 'react-native-paper';
import { useRouter, useNavigation } from 'expo-router';
import { applicationService } from '../../src/services/firebase/applicationService';
import { Application, ApplicationStage } from '../../src/types/application.types';
import { ApplicationCard } from '../../src/components/applications/ApplicationCard';
import { ApplicationFilters, ApplicationFilterState, ApplicationSortOption } from '../../src/components/applications/ApplicationFilters';
import { historyService } from '../../src/services/firebase/historyService';
import { DocxGenerator } from '../../src/services/docx/docxGenerator';
import { ParsedResume } from '../../src/types/resume.types';
import { SavedAnalysis } from '../../src/types/history.types';
import { useResumeStore } from '../../src/store/resumeStore';
import { perplexityService } from '../../src/services/ai/perplexityService';
import { activityService } from '../../src/services/firebase/activityService';
import { prepAssistantService } from '../../src/services/ai/prepAssistant';
import { prepGuidePdfGenerator } from '../../src/services/pdf/pdfGenerator';
import { taskService } from '../../src/services/firebase/taskService';
import { notificationService } from '../../src/services/firebase/notificationService';
import { backgroundTaskService, BackgroundTask } from '../../src/services/firebase/backgroundTaskService';
import { UserHeader } from '../../src/components/layout/UserHeader'; // Import UserHeader
import { useTokenCheck } from '../../src/hooks/useTokenCheck';
import { migrationService } from '../../src/services/firebase/migrationService';
import { CoverLetterDialog } from '../../src/components/applications/CoverLetterDialog';
import { PrepGuideDialogs } from '../../src/components/applications/PrepGuideDialogs';

const isAndroid = Platform.OS === 'android';

export default function ApplicationsScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const theme = useTheme();
    const { setCurrentAnalysis } = useResumeStore();
    const { checkTokens } = useTokenCheck();
    const [applications, setApplications] = useState<Application[]>([]);
    const [pendingAnalyses, setPendingAnalyses] = useState<SavedAnalysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewingCoverLetterApp, setViewingCoverLetterApp] = useState<Application | null>(null);
    const [isEditingCoverLetter, setIsEditingCoverLetter] = useState(false);
    const [editedCoverLetterContent, setEditedCoverLetterContent] = useState('');
    const [viewMode, setViewMode] = useState('active'); // active | archived

    // Filter & Sort State
    const [sortOption, setSortOption] = useState<ApplicationSortOption>('recent');
    const [filters, setFilters] = useState<ApplicationFilterState>({
        stages: [],
        companies: [],
        scoreRanges: [],
        dateRange: 'all'
    });

    // Prep Guide State
    const [prepConfirmationVisible, setPrepConfirmationVisible] = useState(false);
    const [viewingPrepAppId, setViewingPrepAppId] = useState<string | null>(null); // For "View Guide" dialog (completed state)
    const [viewDialogVisible, setViewDialogVisible] = useState(false);
    const abortControllers = useRef<Map<string, AbortController>>(new Map());

    // Derived State for Generating App (to show banner)
    const generatingApp = applications.find(a => a.prepGuide?.status === 'generating');

    // Derived State for Viewing App
    const viewingPrepApp = viewingPrepAppId ? applications.find(a => a.id === viewingPrepAppId) : null;

    // Convert pending/draft analyses to read-only applications
    const convertAnalysisToReadOnlyApp = (analysis: SavedAnalysis): Application => {
        const hasDraft = !!analysis.draftOptimizedResumeData;
        const analysisStatus = hasDraft ? 'draft_ready' : 'pending_resume_update';

        return {
            id: `analysis_${analysis.id}`, // Prefix to distinguish from real apps
            userId: analysis.userId,
            analysisId: analysis.id,
            jobTitle: analysis.jobTitle || 'Untitled Position',
            company: analysis.company || 'Unknown Company',
            jobDescription: analysis.jobData?.description || '',
            atsScore: analysis.draftAtsScore || analysis.atsScore || 0,
            currentStage: 'not_applied',
            lastStatusUpdate: analysis.updatedAt || analysis.createdAt,
            timeline: [{
                stage: 'not_applied' as ApplicationStage,
                date: analysis.createdAt,
                note: 'Analysis created'
            }],
            isArchived: false,
            createdAt: analysis.createdAt,
            updatedAt: analysis.updatedAt || analysis.createdAt,
            isReadOnly: true,
            analysisStatus: analysisStatus
        };
    };

    // Merge applications with read-only pending analyses
    const mergedApplications = React.useMemo(() => {
        // Create a map of analyses by ID for quick lookup
        const analysesById = new Map(pendingAnalyses.map(a => [a.id, a]));

        // Get IDs of analyses that already have applications
        const analysisIdsWithApps = new Set(applications.map(app => app.analysisId));

        // Process existing applications - check if they have pending skill updates
        const processedApps = applications.map(app => {
            const linkedAnalysis = analysesById.get(app.analysisId);

            // Check if the linked analysis has pending draft changes (skill updates)
            if (linkedAnalysis && linkedAnalysis.draftOptimizedResumeData && linkedAnalysis.optimizedResumeData) {
                // Analysis was optimized but now has new draft changes (skill addition)
                return {
                    ...app,
                    isReadOnly: true,
                    analysisStatus: 'pending_skill_update' as const,
                    // Update score to show the draft score
                    atsScore: linkedAnalysis.draftAtsScore || app.atsScore
                };
            }
            return app;
        });

        // Convert pending analyses (those without optimizedResumeData) to read-only apps
        const readOnlyApps = pendingAnalyses
            .filter(analysis => {
                // Only include if:
                // 1. No existing application for this analysis
                // 2. No optimizedResumeData (not yet fully optimized)
                return !analysisIdsWithApps.has(analysis.id) && !analysis.optimizedResumeData;
            })
            .map(convertAnalysisToReadOnlyApp);

        // Merge processed apps with read-only apps
        return [...processedApps, ...readOnlyApps];
    }, [applications, pendingAnalyses]);

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleRefresh = React.useCallback(() => {
        setLoading(true);
        setRefreshTrigger(prev => prev + 1);

        // Sync Logic: Check for zombie applications (missing parent analysis)
        (async () => {
            try {
                // 1. Run one-time migration to fix prepGuideHistory status
                await migrationService.fixPrepGuideHistoryStatus();

                // 2. Fetch fresh data
                const allAnalyses = await historyService.getUserHistory();
                const allApps = await applicationService.getApplications();

                const analysisIds = new Set(allAnalyses.map(a => a.id));
                let removedCount = 0;

                // 2. Identify zombies
                // Only check real apps (not read-only pending ones we synthesized)
                const zombieApps = allApps.filter(app => !app.isReadOnly && !analysisIds.has(app.analysisId));

                // 3. Cleanup
                for (const zombie of zombieApps) {
                    console.log(`Removing zombie application: ${zombie.id} (Analysis ${zombie.analysisId} missing)`);
                    await applicationService.deleteApplication(zombie.id);
                    removedCount++;
                }

                if (removedCount > 0) {
                    Alert.alert("Sync Complete", `Cleaned up ${removedCount} application(s) with missing data.`);
                    setRefreshTrigger(prev => prev + 1); // Trigger re-render after cleanup
                }
            } catch (err) {
                console.error("Sync failed:", err);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <UserHeader />
            ),
        });
    }, [navigation]);

    useEffect(() => {
        setLoading(true);
        // Subscribe to applications
        const unsubApps = applicationService.subscribeToApplications((apps) => {
            // Diagnostic: log cover letter status changes
            apps.forEach(app => {
                if (app.coverLetter) {
                    console.log(`[Subscription] ${app.company} CL status: ${app.coverLetter.status}, content: ${!!app.coverLetter.content}`);
                }
            });
            setApplications(apps);
            setLoading(false);
        });

        // Subscribe to analyses (to get pending/draft ones)
        const unsubAnalyses = historyService.subscribeToUserHistory((analyses) => {
            setPendingAnalyses(analyses);
        });

        return () => {
            unsubApps();
            unsubAnalyses();
        };
    }, [refreshTrigger]);

    // Force refresh when app returns to foreground
    // This handles cases where onSnapshot misses updates while backgrounded
    useEffect(() => {
        const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                console.log('[Applications] App foregrounded - triggering refresh');
                setRefreshTrigger(prev => prev + 1);
            }
        });

        return () => {
            appStateSubscription.remove();
        };
    }, []);

    // Cleanup abort controllers on unmount
    useEffect(() => {
        return () => {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            abortControllers.current.forEach(controller => controller.abort());
            abortControllers.current.clear();
        };
    }, []);

    const filteredApplications = React.useMemo(() => {
        let result = mergedApplications.filter(app => {
            const matchesSearch =
                app.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                app.company.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesViewMode = viewMode === 'archived' ? app.isArchived : !app.isArchived;
            if (!matchesSearch || !matchesViewMode) return false;

            // Apply Advanced Filters
            if (filters.stages.length > 0 && !filters.stages.includes(app.currentStage)) return false;
            if (filters.companies.length > 0 && !filters.companies.includes(app.company)) return false;

            if (filters.scoreRanges.length > 0) {
                const matchesScore = filters.scoreRanges.some(range => {
                    const [min, max] = range.split('-').map(Number);
                    return app.atsScore >= min && app.atsScore <= max;
                });
                if (!matchesScore) return false;
            }

            if (filters.dateRange !== 'all') {
                const now = new Date();
                const days = filters.dateRange === '7days' ? 7 : filters.dateRange === '30days' ? 30 : 90;
                const cutoff = new Date(now.setDate(now.getDate() - days));
                if (new Date(app.lastStatusUpdate) < cutoff) return false;
            }

            return true;
        });

        // Apply Sorting
        result.sort((a, b) => {
            switch (sortOption) {
                case 'recent':
                    return new Date(b.lastStatusUpdate).getTime() - new Date(a.lastStatusUpdate).getTime();
                case 'score_desc':
                    return b.atsScore - a.atsScore;
                case 'score_asc':
                    return a.atsScore - b.atsScore;
                case 'company_asc':
                    return a.company.localeCompare(b.company);
                case 'company_desc':
                    return b.company.localeCompare(a.company);
                case 'stage_priority': {
                    const priority: Record<string, number> = {
                        'offer': 0,
                        'final_round': 1,
                        'technical': 2,
                        'phone_screen': 3,
                        'submitted': 4,
                        'not_applied': 5,
                        'other': 6,
                        'withdrawn': 7,
                        'rejected': 8
                    };
                    return (priority[a.currentStage] ?? 9) - (priority[b.currentStage] ?? 9);
                }
                default:
                    return 0;
            }
        });

        return result;
    }, [mergedApplications, searchQuery, viewMode, filters, sortOption]);

    const handleStatusUpdate = async (id: string, stage: ApplicationStage, note?: string, customName?: string) => {
        const success = await applicationService.updateStatus(id, stage, note, customName);
        if (success) {
            // Success
        } else {
            Alert.alert("Error", "Failed to update status.");
        }
    };

    const handleRestore = async (id: string) => {
        Alert.alert(
            "Restore Application",
            "Are you sure you want to restore this application to the active list?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Restore",
                    onPress: async () => {
                        const success = await applicationService.setArchived(id, false);
                        if (!success) {
                            Alert.alert("Error", "Failed to restore application.");
                        }
                    }
                }
            ]
        );
    };

    const handleGenerateCoverLetter = async (id: string) => {
        try {
            const app = applications.find(a => a.id === id);
            if (!app) return;

            // If cover letter exists with content, view it
            if (app.coverLetter?.content && app.coverLetter.content.length > 0) {
                setViewingCoverLetterApp(app);
                return;
            }

            // Detect stuck "generating" state (over 60 seconds)
            if (app.coverLetter?.status === 'generating') {
                const startedAt = app.coverLetter.startedAt;
                const isStuck = startedAt && (Date.now() - new Date(startedAt).getTime() > 60000);

                if (isStuck) {
                    Alert.alert(
                        "Generation may have stalled",
                        "The cover letter has been generating for a while. Would you like to try again?",
                        [
                            { text: "Wait", style: "cancel" },
                            { text: "Retry", onPress: () => generateLetter(app) }
                        ]
                    );
                } else {
                    Alert.alert("Please wait", "Your cover letter is still being generated. You'll be notified when it's ready.");
                }
                return;
            }

            // Handle failed status - offer to retry
            if (app.coverLetter?.status === 'failed') {
                Alert.alert(
                    "Generation Failed",
                    "The cover letter generation failed. Would you like to try again?",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Retry", onPress: () => generateLetter(app) }
                    ]
                );
                return;
            }

            await generateLetter(app);

        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to handle cover letter request.");
        }
    };

    const handleDownloadCoverLetter = async () => {
        const content = isEditingCoverLetter ? editedCoverLetterContent : viewingCoverLetterApp?.coverLetter?.content;
        if (!content) return;
        try {
            await DocxGenerator.generateCoverLetter(content);
        } catch (error) {
            Alert.alert("Error", "Failed to download cover letter.");
        }
    };

    const handleStartEdit = () => {
        if (viewingCoverLetterApp?.coverLetter) {
            setEditedCoverLetterContent(viewingCoverLetterApp.coverLetter.content);
            setIsEditingCoverLetter(true);
        }
    };

    const handleCancelEdit = () => {
        setIsEditingCoverLetter(false);
        setEditedCoverLetterContent('');
    };

    const handleSaveEdit = async () => {
        if (!viewingCoverLetterApp || !editedCoverLetterContent.trim()) return;

        setLoading(true); // Re-use loading or local state? Dialog covers screen, so main loading might not show well.
        // Ideally local loading state for save button.

        try {
            await applicationService.saveCoverLetter(viewingCoverLetterApp.id, editedCoverLetterContent);

            // Update local state immediately
            const updatedApp = {
                ...viewingCoverLetterApp,
                coverLetter: {
                    ...viewingCoverLetterApp.coverLetter!,
                    content: editedCoverLetterContent,
                    lastEditedAt: new Date() // approximate
                }
            };

            // Update the main list so if we close/reopen it's there
            setApplications(apps => apps.map(a => a.id === updatedApp.id ? updatedApp : a));

            // Update current view
            setViewingCoverLetterApp(updatedApp);
            setIsEditingCoverLetter(false);

        } catch (error) {
            Alert.alert("Error", "Failed to save changes.");
        } finally {
            setLoading(false);
        }
    };

    const generateLetter = async (application: Application, onDismissModal?: () => void) => {
        if (!checkTokens(15, onDismissModal)) return;
        setLoading(true);
        try {
            // Get necessary data for the background task
            let resumeData: ParsedResume | null = null;
            let jobDescription = application.jobDescription;

            if (application.submittedResumeData) {
                resumeData = application.submittedResumeData;
            } else {
                const analysis = await historyService.getAnalysisById(application.analysisId);
                if (analysis) {
                    resumeData = analysis.optimizedResumeData || analysis.resumeData || null;
                    if (!jobDescription) jobDescription = analysis.jobData.description;
                }
            }

            if (!resumeData) {
                Alert.alert("Error", "No resume data available to generate a cover letter.");
                setLoading(false);
                return;
            }

            // Optimistic Update: Immediately set status to generating locally
            // This ensures instant feedback even if network/backend is slow to respond
            console.log("[CoverLetter] Applying optimistic update: generating");
            setApplications(prev => prev.map(a => {
                if (a.id === application.id) {
                    return {
                        ...a,
                        coverLetter: {
                            ...a.coverLetter,
                            status: 'generating',
                            content: '', // Clear old content if any, or keep it? decided to clear to show regeneration
                            generatedAt: new Date(),
                            startedAt: new Date()
                        }
                    };
                }
                return a;
            }));

            // Use fire-and-forget pattern: create a background task
            // The Cloud Function processes it automatically and updates Firestore
            // We listen via Firestore for completion - works even when app is backgrounded
            console.log("[CoverLetter] Creating background task for server-side generation...");

            await backgroundTaskService.createTask(
                'cover_letter',
                {
                    applicationId: application.id,
                    resume: resumeData,
                    jobTitle: application.jobTitle,
                    company: application.company,
                    jobDescription: jobDescription
                }
            );

            // Show immediate feedback - the task is now processing in the background
            Alert.alert(
                "Generating...",
                "Your cover letter is being generated. You'll be notified when it's ready. You can close the app."
            );

        } catch (error) {
            console.error("Cover Letter generation failed:", error);
            // Revert optimistic update on failure (optional, but good practice)
            setApplications(prev => prev.map(a => {
                if (a.id === application.id && a.coverLetter?.status === 'generating') {
                    // Revert to undefined or previous state if possible.
                    // For now, just removing the generating status so user can try again.
                    const { coverLetter, ...rest } = a;
                    return rest;
                }
                return a;
            }));
            Alert.alert("Error", "Failed to start cover letter generation. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePrep = (id: string) => {
        const app = applications.find(a => a.id === id);
        if (!app) return;

        setViewingPrepAppId(app.id); // Set active app for context

        if (app.prepGuide?.status === 'completed') {
            // Open View Dialog
            setViewDialogVisible(true);
        } else if (app.prepGuide?.status === 'generating') {
            // Already generating, do nothing (User sees banner)
            Alert.alert("Generating", `Guide for ${app.company} is currently generating. Check progress at the top.`);
        } else {
            // Not started, show confirmation
            setPrepConfirmationVisible(true);
        }
    };

    // Async Background Generation - uses fire-and-forget pattern with Firestore triggers
    // The Cloud Function is triggered automatically when we create a background_tasks document
    // This works even when the app is backgrounded because Firestore listeners persist
    const runBackgroundGeneration = async (appId: string, signal?: AbortSignal, onDismissModal?: () => void) => {
        if (!checkTokens(40, onDismissModal)) return; // Cost: 40 tokens (was 15)
        try {
            const application = applications.find(a => a.id === appId);
            if (!application) return;

            // Get analysis data needed for prep guide
            const analysis = await historyService.getAnalysisById(application.analysisId);
            if (!analysis) throw new Error("Analysis data not found");
            if (signal?.aborted) return;

            const resumeToUse = application.submittedResumeData || analysis.optimizedResumeData || analysis.resumeData;

            // 1. DEDUCT TOKENS FIRST - This ensures the user is charged BEFORE any AI work begins
            // and the logs update immediately in the UI.
            try {
                await activityService.logActivity({
                    type: 'interview_prep_generation',
                    description: `Generated Interview Prep Guide for ${application.company}`,
                    resourceId: application.id,
                    resourceName: application.company,
                    aiProvider: 'perplexity-sonar-pro',
                    platform: 'ios'
                });
                console.log("[PrepGuide] Tokens deducted successfully BEFORE task creation");

                // 1.5 INITIALIZE STATUS - Force push a new history entry so the Cancel button shows up
                await applicationService.updatePrepStatus(appId, {
                    status: 'generating',
                    currentStep: 'Initializing background task...',
                    progress: 5
                }, true);

            } catch (deductError: any) {
                console.error("[PrepGuide] Token deduction failed:", deductError);
                // Return early - task won't be created
                Alert.alert("Token Error", deductError.message || "Failed to deduct tokens. Please try again.");
                return;
            }

            // 2. CREATE TASK ONLY AFTER SUCCESSFUL DEDUCTION
            console.log("[PrepGuide] Creating background task for server-side generation...");

            await backgroundTaskService.createTask(
                'prep_guide',
                {
                    applicationId: application.id,
                    companyName: application.company,
                    jobTitle: application.jobTitle,
                    jobDescription: application.jobDescription || analysis.jobData.description,
                    optimizedResume: JSON.stringify(resumeToUse),
                    atsScore: application.atsScore,
                    matchedSkills: analysis.analysisData.matchAnalysis?.matchedSkills.map((s: any) => s.skill) || [],
                    partialMatches: analysis.analysisData.matchAnalysis?.partialMatches.map((s: any) => s.skill) || [],
                    missingSkills: analysis.analysisData.matchAnalysis?.missingSkills.map((s: any) => s.skill) || [],
                    newSkillsAcquired: []
                },
                // onComplete - called when Firestore updates with completion
                async (bgTask: BackgroundTask) => {
                    console.log("[PrepGuide] Background task completed");

                    // LOG AUDIT ACTIVITY - Use skipTokenDeduction because tokens were already deducted at the start
                    // This serves as a "completion" marker in the log if needed, though usually the start log is enough.
                    // To avoid cluttering the log with two entries for the same thing, we can either skip this
                    // or mark it differently. Per user request "update log before task starts", 
                    // we've already done the main log.
                    console.log("[PrepGuide] Task completed, skipping duplicate logging.");

                    // The Cloud Function already updated the application document with sections
                    // Now generate PDF locally (needs file system access)
                    const sections = bgTask.result?.sections;
                    let pdfUri: string | undefined;

                    if (sections) {
                        try {
                            pdfUri = await prepGuidePdfGenerator.generateAndShare(sections, {
                                companyName: application.company,
                                jobTitle: application.jobTitle
                            });
                        } catch (pdfError) {
                            console.error("[PrepGuide] PDF generation failed:", pdfError);
                            // PDF generation failed but content is still available in Firestore
                        }
                    }

                    // ALWAYS ensure status is marked complete (handles race condition with Cloud Function)
                    await applicationService.updatePrepStatus(application.id, {
                        status: 'completed',
                        downloadUrl: pdfUri,
                        generatedAt: new Date()
                    });

                    // Note: Push notification is now handled by Cloud Function only
                    // to prevent duplicates. No client-side notification calls needed.

                    // Local notifications removed to prevent duplicates (backend handles this)
                },
                // onError
                async (bgTask: BackgroundTask) => {
                    // Check if this is a user-initiated cancellation (not a real error)
                    const isCancellation = bgTask.error?.includes('cancelled by user') || bgTask.error?.includes('Task cancelled');
                    if (isCancellation) {
                        console.log("[PrepGuide] Generation was cancelled by user.");
                        // Ensure history is updated to 'failed' (cancelled state) - handleCancelPrep may have already done this
                        // but we update again to ensure consistency
                        await applicationService.updatePrepStatus(appId, {
                            status: 'cancelled',
                            historyStatus: 'failed',
                            progress: 0,
                            currentStep: 'Generation Cancelled'
                        }).catch(console.error);
                    } else {
                        console.error("[PrepGuide] Background task failed:", bgTask.error);
                        await applicationService.updatePrepStatus(appId, {
                            status: 'failed',
                            historyStatus: 'failed',
                            progress: 0,
                            currentStep: `Failed: ${bgTask.error || 'Unknown error'}`
                        }).catch(console.error);
                    }
                }
            );

            // Task created successfully - the Cloud Function will process it
            // Progress updates will happen via Firestore listeners in the Application document

        } catch (error) {
            console.error("Background Gen Error:", error);
            // Update status to failed
            await applicationService.updatePrepStatus(appId, {
                status: 'failed',
                progress: 0,
                currentStep: `Failed: ${(error as any).message || 'Unknown error'}`
            }).catch(console.error);
        }
    };

    const confirmGeneratePrep = () => {
        if (!viewingPrepAppId) return;
        const appId = viewingPrepAppId;

        // Close UI immediately
        setPrepConfirmationVisible(false);

        // Abort previous if any
        if (abortControllers.current.has(appId)) {
            abortControllers.current.get(appId)?.abort();
        }

        const controller = new AbortController();
        abortControllers.current.set(appId, controller);

        // Fire and forget (Background Process)
        runBackgroundGeneration(appId, controller.signal, () => setPrepConfirmationVisible(false)).finally(() => {
            if (abortControllers.current.get(appId) === controller) {
                abortControllers.current.delete(appId);
            }
        });
    };

    const handleDownloadPrep = async () => {
        console.log('[PrepGuide] Download requested. App:', viewingPrepApp?.company, 'ID:', viewingPrepApp?.id);
        console.log('[PrepGuide] Has sections:', !!viewingPrepApp?.prepGuide?.sections);
        console.log('[PrepGuide] Section keys:', viewingPrepApp?.prepGuide?.sections ? Object.keys(viewingPrepApp.prepGuide.sections) : 'none');

        if (!viewingPrepApp?.prepGuide) {
            Alert.alert("Error", "No prep guide data available.");
            return;
        }

        let sections = viewingPrepApp.prepGuide.sections;

        // Fallback: fetch sections directly from Firestore if missing from local state
        if (!sections || Object.keys(sections).length === 0) {
            console.log('[PrepGuide] No sections in local state, fetching from Firestore...');
            try {
                setLoading(true);
                const freshApp = await applicationService.getApplicationById(viewingPrepApp.id);
                if (freshApp?.prepGuide?.sections && Object.keys(freshApp.prepGuide.sections).length > 0) {
                    sections = freshApp.prepGuide.sections;
                    console.log('[PrepGuide] Fetched sections from Firestore:', Object.keys(sections!));
                } else {
                    console.log('[PrepGuide] No sections found in Firestore either.');
                    Alert.alert(
                        "Sections Not Available",
                        "The prep guide sections are missing. This may happen if the guide was generated with an older version. Would you like to regenerate it?",
                        [
                            { text: "Cancel", style: "cancel" },
                            {
                                text: "Regenerate",
                                onPress: () => {
                                    setViewDialogVisible(false);
                                    runBackgroundGeneration(viewingPrepApp.id);
                                }
                            }
                        ]
                    );
                    setLoading(false);
                    return;
                }
            } catch (err) {
                console.error('[PrepGuide] Firestore fallback fetch failed:', err);
                Alert.alert("Error", "Could not retrieve prep guide data.");
                setLoading(false);
                return;
            }
        }

        try {
            setLoading(true);
            await prepGuidePdfGenerator.generateAndShare(sections as any, {
                companyName: viewingPrepApp.company,
                jobTitle: viewingPrepApp.jobTitle
            });
        } catch (error: any) {
            console.error('[PrepGuide] PDF download failed:', error);
            Alert.alert("Error", `Failed to download PDF: ${error.message || 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    const handlePreviewResume = async (id: string) => {
        try {
            const app = applications.find(a => a.id === id);
            if (!app) return;

            setLoading(true);

            let resumeToPreview: ParsedResume | null = null;
            let fullAnalysisData: any = null;

            if (app.submittedResumeData) {
                resumeToPreview = app.submittedResumeData;
            } else {
                const analysis = await historyService.getAnalysisById(app.analysisId);
                if (analysis) {
                    resumeToPreview = analysis.optimizedResumeData || analysis.resumeData || null;
                    fullAnalysisData = analysis.analysisData; // Capture full analysis if available
                }
            }

            setLoading(false);

            if (resumeToPreview) {
                // Populate store with enough data for the preview screen
                setCurrentAnalysis({
                    ...(fullAnalysisData || {}), // Spread existing if we have it
                    id: app.analysisId,
                    // Minimal mocks to satisfy type requirements if fullAnalysisData is missing/partial
                    matchAnalysis: fullAnalysisData?.matchAnalysis || { matchedSkills: [], missingSkills: [], partialMatches: [] },
                    recommendation: fullAnalysisData?.recommendation || { action: 'review', priority: 'medium', reasoning: '' },
                    atsScore: app.atsScore,

                    // Essential for Preview
                    job: { title: app.jobTitle, company: app.company } as any, // Mock Job
                    resume: {} as any, // Mock Original
                    optimizedResume: resumeToPreview
                } as any);

                router.push('/resume-preview');
            } else {
                Alert.alert("Error", "No resume data found for this application.");
            }
        } catch (error) {
            setLoading(false);
            console.error("Preview error:", error);
            Alert.alert("Error", "Failed to load resume preview.");
        }
    };

    const handleRegeneratePrep = (id: string) => {
        const app = applications.find(a => a.id === id);
        if (!app) return;

        // Setup state to trigger confirmation dialog (forcing regeneration)
        setViewingPrepAppId(app.id);
        setPrepConfirmationVisible(true);
    };

    const handleCancelPrep = async (id: string) => {
        try {
            // 1. Real Abort
            if (abortControllers.current.has(id)) {
                abortControllers.current.get(id)?.abort();
                abortControllers.current.delete(id);
            }

            const app = applications.find(a => a.id === id);
            // Check if we have previous guide content to revert to
            const hasExistingGuide = app?.prepGuide?.sections && Object.keys(app.prepGuide.sections).length > 0;

            await applicationService.updatePrepStatus(id, {
                status: 'cancelled',
                historyStatus: 'failed',
                currentStep: 'Generation Cancelled by User',
                progress: 0
            });
        } catch (error) {
            console.error("Error cancelling prep:", error);
        }
    };

    // Handle navigation to complete optimization for read-only cards
    const handleCompleteOptimization = async (analysisId: string) => {
        try {
            const analysis = pendingAnalyses.find(a => a.id === analysisId);
            if (!analysis) {
                Alert.alert("Error", "Analysis not found.");
                return;
            }

            // Load analysis into store and navigate to analysis result
            setCurrentAnalysis({
                id: analysis.id,
                resume: analysis.resumeData,
                job: analysis.jobData,
                matchAnalysis: analysis.draftMatchAnalysis || analysis.analysisData?.matchAnalysis,
                recommendation: analysis.analysisData?.recommendation,
                atsScore: analysis.draftAtsScore || analysis.atsScore,
                optimizedResume: analysis.draftOptimizedResumeData,
                changes: analysis.draftChangesData,
                draftOptimizedResumeData: analysis.draftOptimizedResumeData,
                draftChangesData: analysis.draftChangesData,
                draftAtsScore: analysis.draftAtsScore,
                draftMatchAnalysis: analysis.draftMatchAnalysis,
                optimizedMatchAnalysis: analysis.analysisData?.matchAnalysis
            } as any);

            router.push('/analysis-result');
        } catch (error) {
            console.error("Error navigating to optimization:", error);
            Alert.alert("Error", "Failed to load analysis.");
        }
    };

    // Helper to calculate counts based on current non-status filters
    const getTabCounts = () => {
        const filteredByCriteria = mergedApplications.filter(app => {
            const matchesSearch =
                app.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                app.company.toLowerCase().includes(searchQuery.toLowerCase());

            if (!matchesSearch) return false;

            // Apply Advanced Filters
            if (filters.stages.length > 0 && !filters.stages.includes(app.currentStage)) return false;
            if (filters.companies.length > 0 && !filters.companies.includes(app.company)) return false;

            if (filters.scoreRanges.length > 0) {
                const matchesScore = filters.scoreRanges.some(range => {
                    const [min, max] = range.split('-').map(Number);
                    return app.atsScore >= min && app.atsScore <= max;
                });
                if (!matchesScore) return false;
            }

            if (filters.dateRange !== 'all') {
                const now = new Date();
                const days = filters.dateRange === '7days' ? 7 : filters.dateRange === '30days' ? 30 : 90;
                const cutoff = new Date(now.setDate(now.getDate() - days));
                if (new Date(app.lastStatusUpdate) < cutoff) return false;
            }

            return true;
        });

        return {
            active: filteredByCriteria.filter(a => !a.isArchived).length,
            archived: filteredByCriteria.filter(a => a.isArchived).length
        };
    };

    const tabCounts = getTabCounts();

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header Content */}
            <View style={styles.header}>
                <Text variant={isAndroid ? "headlineSmall" : "headlineMedium"} style={{ fontWeight: 'bold', marginBottom: 8 }}>My Applications</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <SegmentedButtons
                        value={viewMode}
                        onValueChange={setViewMode}
                        style={{ flex: 1, marginRight: 8 }}
                        buttons={[
                            { value: 'active', label: `Active (${tabCounts.active})` },
                            { value: 'archived', label: `Archive (${tabCounts.archived})` },
                        ]}
                    />
                </View>

                <Searchbar
                    placeholder="Search roles or companies"
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={{ marginBottom: isAndroid ? 8 : 16, backgroundColor: theme.colors.elevation.level1 }}
                    elevation={0}
                />

                <ApplicationFilters
                    applications={mergedApplications}
                    onFilterChange={setFilters}
                    currentSort={sortOption}
                    onSortChange={setSortOption}
                />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" />
                </View>
            ) : (
                <FlatList
                    refreshControl={
                        <RefreshControl refreshing={loading} onRefresh={handleRefresh} />
                    }
                    data={filteredApplications}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <ApplicationCard
                            application={item}
                            onStatusUpdate={handleStatusUpdate}
                            onGenerateCoverLetter={handleGenerateCoverLetter}
                            onGeneratePrep={handleGeneratePrep}
                            onDownloadResume={handlePreviewResume}
                            onRegeneratePrep={handleRegeneratePrep}
                            onCancelPrep={handleCancelPrep}
                            onCompleteOptimization={handleCompleteOptimization}
                            isResumeUpdated={
                                !item.isReadOnly && item.lastResumeUpdateAt
                                    ? (item.prepGuide?.generatedAt
                                        ? new Date(item.lastResumeUpdateAt).getTime() > new Date(item.prepGuide.generatedAt).getTime()
                                        : true)
                                    : false
                            }
                            onRestore={handleRestore}
                        />
                    )}
                    contentContainerStyle={{ paddingBottom: 80 }}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text variant="bodyLarge" style={{ color: '#888', textAlign: 'center' }}>
                                {viewMode === 'active'
                                    ? "No active applications.\nOptimize a resume to get started!"
                                    : "No archived applications."}
                            </Text>
                            {viewMode === 'active' && (
                                <Button
                                    mode="contained"
                                    onPress={() => router.push('/(tabs)/analyze')}
                                    style={{ marginTop: 16 }}
                                >
                                    Start New Analysis
                                </Button>
                            )}
                        </View>
                    }
                />
            )}

            <CoverLetterDialog
                visible={!!viewingCoverLetterApp}
                application={viewingCoverLetterApp}
                onDismiss={() => setViewingCoverLetterApp(null)}
                onSave={handleSaveEdit}
                onRegenerate={() => {
                    if (viewingCoverLetterApp) {
                        generateLetter(viewingCoverLetterApp, () => setViewingCoverLetterApp(null));
                    }
                }}
                onDownload={handleDownloadCoverLetter}
            />

            <PrepGuideDialogs
                confirmationVisible={prepConfirmationVisible}
                viewDialogVisible={viewDialogVisible}
                application={applications.find(a => a.id === viewingPrepAppId) || null}
                onDismissConfirmation={() => setPrepConfirmationVisible(false)}
                onDismissView={() => setViewDialogVisible(false)}
                onConfirmGenerate={confirmGeneratePrep}
                onDownload={handleDownloadPrep}
            />

            {/* Guidance Message for empty or new users */}
            {applications.length > 0 && viewMode === 'active' && (
                <View style={[styles.guidance, { backgroundColor: theme.colors.secondaryContainer }]}>
                    <Text variant="bodySmall" style={{ textAlign: 'center', color: theme.colors.onSecondaryContainer }}>
                        📌 Remember to apply on the company portal. Update status here to track progress.
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 16,
        paddingBottom: 0
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    empty: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center'
    },
    guidance: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 8,
        alignItems: 'center'
    },
    statusBanner: {
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 8,
        backgroundColor: '#e3f2fd' // Light blue
    }
});
