import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, ScrollView, Keyboard } from 'react-native';
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

            // If cover letter exists and is completed with content, view it
            if (app.coverLetter?.status === 'completed' && app.coverLetter?.content) {
                setViewingCoverLetterApp(app);
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
                },
                // onComplete - called when Firestore updates with completion
                async (bgTask: BackgroundTask) => {
                    console.log("[CoverLetter] Background task completed");

                    // Log activity (tokens already deducted by Cloud Function)
                    await activityService.logActivity({
                        type: 'cover_letter_generation',
                        description: `Generated Cover Letter for ${application.company}`,
                        resourceId: application.id,
                        resourceName: application.company,
                        aiProvider: 'perplexity-sonar-pro',
                        platform: 'ios',
                        skipTokenDeduction: true,
                        tokensUsed: 15
                    });

                    // Note: Push notification is now handled by Cloud Function only
                    // to prevent duplicates. No client-side notification calls needed.

                    // Local notifications removed to prevent duplicates (backend handles this)

                    Alert.alert("Success", "Cover Letter generated successfully!");
                },
                // onError
                (bgTask: BackgroundTask) => {
                    console.error("[CoverLetter] Background task failed:", bgTask.error);
                    Alert.alert("Error", bgTask.error || "Failed to generate cover letter.");
                }
            );

            // Show immediate feedback - the task is now processing in the background
            Alert.alert(
                "Generating...",
                "Your cover letter is being generated. You'll be notified when it's ready. You can close the app."
            );

        } catch (error) {
            console.error("Cover Letter generation failed:", error);
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
        if (!viewingPrepApp?.prepGuide?.downloadUrl && !viewingPrepApp?.prepGuide?.sections) return;

        try {
            // If strictly just view/download, we should rely on the PDF we generated.
            // If downloadUrl is local file uri and exists, share it.
            // For robustness, if we have sections, regenerate PDF to be sure (cheap operation vs network).
            if (viewingPrepApp.prepGuide.sections) {
                await prepGuidePdfGenerator.generateAndShare(viewingPrepApp.prepGuide.sections as any, {
                    companyName: viewingPrepApp.company,
                    jobTitle: viewingPrepApp.jobTitle
                });
            } else if (viewingPrepApp.prepGuide.downloadUrl) {
                // Try sharing existing url (if we trust it exists)
                // await Sharing.shareAsync(viewingPrepApp.prepGuide.downloadUrl);
            }
        } catch (error) {
            Alert.alert("Error", "Failed to download/share PDF.");
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
                <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginBottom: 8 }}>My Applications</Text>

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
                    style={{ marginBottom: 16, backgroundColor: theme.colors.elevation.level1 }}
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

            <Portal>
                <Dialog visible={!!viewingCoverLetterApp} onDismiss={() => { setViewingCoverLetterApp(null); setIsEditingCoverLetter(false); }} style={{ maxHeight: '90%' }}>
                    <Dialog.Title>
                        {isEditingCoverLetter ? "Edit Cover Letter" : "Cover Letter"}
                    </Dialog.Title>
                    <Dialog.ScrollArea>
                        <ScrollView
                            contentContainerStyle={{ paddingVertical: 12 }}
                            keyboardDismissMode="on-drag"
                            keyboardShouldPersistTaps="handled"
                        >
                            {isEditingCoverLetter ? (
                                <TextInput
                                    mode="outlined"
                                    multiline
                                    value={editedCoverLetterContent}
                                    onChangeText={setEditedCoverLetterContent}
                                    style={{ height: 400, backgroundColor: theme.colors.surface }}
                                    autoFocus
                                />
                            ) : (
                                <Text variant="bodyMedium" style={{ lineHeight: 22 }}>
                                    {viewingCoverLetterApp?.coverLetter?.content}
                                </Text>
                            )}
                        </ScrollView>
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        {isEditingCoverLetter && (
                            <Button onPress={handleCancelEdit}>Cancel</Button>
                        )}
                        {isEditingCoverLetter && (
                            <Button mode="contained" onPress={handleSaveEdit}>Save</Button>
                        )}
                        {!isEditingCoverLetter && (
                            <Button onPress={() => setViewingCoverLetterApp(null)}>Close</Button>
                        )}
                        {!isEditingCoverLetter && (
                            <Button onPress={handleStartEdit}>Edit</Button>
                        )}
                        {!isEditingCoverLetter && (
                            <Button onPress={() => {
                                const app = viewingCoverLetterApp!;
                                generateLetter(app, () => {
                                    setViewingCoverLetterApp(null);
                                    setIsEditingCoverLetter(false);
                                });
                            }} textColor={theme.colors.error}>Regenerate</Button>
                        )}
                        {!isEditingCoverLetter && (
                            <Button mode="contained" onPress={handleDownloadCoverLetter} icon="download">
                                Download
                            </Button>
                        )}
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            <Portal>
                {/* 1. Confirmation Dialog (Starts Generation) */}
                <Dialog visible={prepConfirmationVisible} onDismiss={() => setPrepConfirmationVisible(false)}>
                    <Dialog.Title>Generate Interview Prep Guide</Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyMedium" style={{ marginBottom: 12 }}>
                            We will generate a comprehensive interview preparation document including:
                        </Text>
                        <Text variant="bodyMedium" style={{ marginLeft: 8 }}>• Company research & culture insights</Text>
                        <Text variant="bodyMedium" style={{ marginLeft: 8 }}>• Technical topics tailored to you</Text>
                        <Text variant="bodyMedium" style={{ marginLeft: 8 }}>• Behavioral questions with YOUR stories</Text>
                        <Text variant="bodyMedium" style={{ marginLeft: 8 }}>• Strategic questions to ask</Text>
                        <Text variant="bodyMedium" style={{ marginTop: 12, fontWeight: 'bold' }}>
                            Generation time: about 20 mins
                        </Text>
                        <Text variant="bodySmall" style={{ marginTop: 8, color: theme.colors.outline }}>
                            You can continue using the app while we generate this in the background.
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setPrepConfirmationVisible(false)}>Cancel</Button>
                        <Button mode="contained" onPress={confirmGeneratePrep}>Generate</Button>
                    </Dialog.Actions>
                </Dialog>

                {/* 2. View Guide Dialog (Completed) */}
                <Dialog visible={viewDialogVisible} onDismiss={() => setViewDialogVisible(false)}>
                    <Dialog.Title>Interview Prep Guide</Dialog.Title>
                    <Dialog.Content>
                        <View style={{ marginBottom: 20 }}>
                            <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                                {viewingPrepApp?.company} - {viewingPrepApp?.jobTitle}
                            </Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.secondary, marginBottom: 12 }}>
                                Generated {viewingPrepApp?.prepGuide?.startedAt ? new Date(viewingPrepApp.prepGuide.startedAt).toLocaleDateString() : 'Just now'}
                            </Text>

                            <Divider style={{ marginVertical: 12 }} />

                            <Text variant="bodyMedium" style={{ fontWeight: 'bold', marginBottom: 8 }}>Guide includes:</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                <Chip icon="check" style={{ margin: 4 }} textStyle={{ fontSize: 11 }}>Company Intel</Chip>
                                <Chip icon="check" style={{ margin: 4 }} textStyle={{ fontSize: 11 }}>Role Deep Dive</Chip>
                                <Chip icon="check" style={{ margin: 4 }} textStyle={{ fontSize: 11 }}>Tech Prep</Chip>
                                <Chip icon="check" style={{ margin: 4 }} textStyle={{ fontSize: 11 }}>Behavioral STAR</Chip>
                                <Chip icon="check" style={{ margin: 4 }} textStyle={{ fontSize: 11 }}>Questions to Ask</Chip>
                            </View>
                        </View>

                        <Button
                            mode="contained"
                            icon="file-download-outline"
                            onPress={handleDownloadPrep}
                            contentStyle={{ height: 48 }}
                        >
                            Download PDF Guide
                        </Button>
                    </Dialog.Content>
                    <Dialog.Actions>
                        {/* Optional Regenerate flow could go here but hidden for simplicity per request */}
                        <Button onPress={() => setViewDialogVisible(false)}>Close</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

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
