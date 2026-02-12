import React, { useState, useRef } from 'react';
import { View, ScrollView, StyleSheet, Alert, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, AppState } from 'react-native';
import { Button, Text, ActivityIndicator, IconButton, Dialog, Portal, TextInput, useTheme, List } from 'react-native-paper';
import { useRouter, useNavigation } from 'expo-router'; // Add useNavigation
import * as ImagePicker from 'expo-image-picker';
import JobBrowser from '../../src/components/job/JobBrowser';
import { JobURLInput } from '../../src/components/upload/JobURLInput';
import { CVUploader } from '../../src/components/upload/CVUploader';
import { jobParserService } from '../../src/services/ai/jobParser';
import { resumeParserService } from '../../src/services/ai/resumeParser';
import { gapAnalyzerService } from '../../src/services/ai/gapAnalyzer';
import { historyService } from '../../src/services/firebase/historyService';
import { useResumeStore } from '../../src/store/resumeStore';
import { generateHash } from '../../src/utils/hashUtils';
import { taskService } from '../../src/services/firebase/taskService';
import { activityService } from '../../src/services/firebase/activityService';
import { ResumeTipsCarousel } from '../../src/components/analysis/ResumeTipsCarousel';
import { useTaskQueue } from '../../src/context/TaskQueueContext';
import { linkedInService } from '../../src/services/external/linkedInService';
import { useTokenCheck } from '../../src/hooks/useTokenCheck';
import { horizontalScale, verticalScale, moderateScale, scaleFont } from '../../src/utils/responsive';
import { notificationService } from '../../src/services/firebase/notificationService';
const isAndroid = Platform.OS === 'android';

export default function AnalyzeScreen() {
    const theme = useTheme();
    // State management
    const router = useRouter();
    const {
        setCurrentAnalysis,
        pendingSharedUrl,
        setPendingSharedUrl,
        jobUrl,
        setJobUrl,
        jobText,
        setJobText,
        jobTitle,
        setJobTitle,
        jobCompany,
        setJobCompany,
        pendingSharedText,
        setPendingSharedText
    } = useResumeStore();

    // Local state for UI only
    const [inputMode, setInputMode] = useState<'url' | 'text'>('url');
    console.log("[Analyze] Render. inputMode:", inputMode, "jobUrl length:", jobUrl.length, "jobText length:", jobText.length);
    const [screenshots, setScreenshots] = useState<string[]>([]);
    const [isExtractingJob, setIsExtractingJob] = useState(false);
    const [browserVisible, setBrowserVisible] = useState(false);
    const [uploadKey, setUploadKey] = useState(0);
    const [cvUris, setCvUris] = useState<any[]>([]); // Using any[] for document assets
    const [resumeText, setResumeText] = useState('');
    const [extractingResume, setExtractingResume] = useState(false);
    const [loading, setLoading] = useState(false);
    const [stage, setStage] = useState('');
    const [fallbackVisible, setFallbackVisible] = useState(false);

    // New UI state for Job Details
    const [isEditingJob, setIsEditingJob] = useState(false);
    const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
        title: true,
        company: true,
        description: true
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Auto-extract job when URL changes (debounced)
    React.useEffect(() => {
        if (jobUrl && jobUrl.length > 10 && jobUrl.startsWith('http') && !isExtractingJob && !jobText) {
            const timer = setTimeout(() => {
                handleExtractJob(jobUrl);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [jobUrl]);

    // Simplified effect: Always auto-replace content when a new share arrives
    React.useEffect(() => {
        if (pendingSharedUrl) {
            console.log("[Analyze] Found pending shared URL in store:", pendingSharedUrl);
            const urlToUse = pendingSharedUrl;

            // CONSUME IMMEDIATELY: Clear it from the store so no other renders see it
            setPendingSharedUrl(null);

            // Auto-replace existing content
            applyPendingUrl(urlToUse);
        }
    }, [pendingSharedUrl]);

    const applyPendingUrl = (urlToUse: string) => {
        console.log("[Analyze] Setting jobUrl to:", urlToUse);
        setJobUrl(urlToUse);
        setJobText(''); // Clear previous text so we don't have mixed state
        setJobTitle('');
        setJobCompany('');
        console.log("[Analyze] Setting inputMode to: url");
        setInputMode('url');
        setPendingSharedUrl(null); // Clear it

        // If we have shared text, set it immediately (don't wait for extraction)
        if (pendingSharedText && pendingSharedText.length > 50) {
            console.log("[Analyze] Using pre-fetched shared text. Length:", pendingSharedText.length);
            setJobText(pendingSharedText);
            setInputMode('text');
            setPendingSharedText(null); // Consume it
            return;
        }

        console.log("[Analyze] Clearing pendingSharedUrl in store, triggering redirection/render...");
        setTimeout(() => {
            console.log("[Analyze] Timeout triggered: calling handleExtractJob with:", urlToUse);
            handleExtractJob(urlToUse);
        }, 500);
    };

    // Helper functions
    const pickScreenshot = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 1,
        });

        if (!result.canceled) {
            setScreenshots([result.assets[0].uri]);
            Alert.alert("Screenshot Added", "We'll analyze this image for job details.");
        }
    };

    const handleClearJob = () => {
        setJobUrl('');
        setJobText('');
        setJobTitle('');
        setJobCompany('');
        setInputMode('url');
        setIsEditingJob(false);
    };

    const handleExtractJob = async (passedUrl?: string) => {
        const urlToParse = passedUrl || jobUrl;

        if (!urlToParse) return;

        // 2. Otherwise, use JobParserService to fetch (Perplexity or LinkedIn direct)
        setIsExtractingJob(true);
        try {
            console.log(`[Analyze] Extracting job from URL: ${urlToParse}`);
            const { title, company, description } = await jobParserService.fetchJobDescription(urlToParse);

            if (description && description.length > 50) {
                setJobTitle(title || '');
                setJobCompany(company || '');
                setJobText(description);
                setInputMode('text');
                setIsEditingJob(false); // Default to view mode
            } else {
                console.warn("[Analyze] Extraction failed: Content too short.");
                Alert.alert("Note", "We couldn't extract a clear description automatically. Would you like to open our browser to copy it manually?", [
                    { text: "No", style: "cancel" },
                    { text: "Open Browser", onPress: () => setBrowserVisible(true) }
                ]);
            }
        } catch (e: any) {
            console.error("Job extraction failed:", e);
            Alert.alert("Extraction Failed", "We couldn't fetch details from this site. Please try copying and pasting the job text instead.");
        } finally {
            setIsExtractingJob(false);
        }
    };

    const handleBrowserImport = (url: string, text: string) => {

        setJobUrl(url);
        setJobText(text);
        setBrowserVisible(false);
    };

    const handleCleanup = () => {
        setResumeText('');
        setCvUris([]);
        setUploadKey(prev => prev + 1);
    };

    // ... existing hooks
    const { checkTokens } = useTokenCheck(); // Init hook

    const handleAnalyze = async (overrideMethod?: 'text' | 'image') => {
        if (!checkTokens(8)) return; // Cost: 8 tokens (ATS Score Calculation)
        console.log("--- handleAnalyze Triggered ---");
        if ((!jobText && screenshots.length === 0 && !overrideMethod) || (cvUris.length === 0 && !resumeText)) {
            console.log("Validation Failed: Missing Info");

            if (jobUrl && !jobText) {
                Alert.alert(
                    "Action Required",
                    "We have the link, but we need the job description text.\n\nPlease click 'Open Job Link in Browser' to extract the text, or paste it manually."
                );
            } else {
                Alert.alert('Missing Information', 'Please provide job details (Text/Screenshots) and your CV.');
            }
            return;
        }

        console.log("Setting Loading: true");
        setLoading(true);
        setFallbackVisible(false);

        try {
            // 0. Deduplication Check
            const targetJobHashRaw = jobUrl || jobText || (screenshots.length > 0 ? screenshots[0] : 'nojobby');
            const targetResumeHashRaw = resumeText || (cvUris.length > 0 ? cvUris[0] : 'noresume');

            const jobHash = await generateHash(targetJobHashRaw);
            const resumeHash = await generateHash(targetResumeHashRaw);

            console.log("Hashes generated:", { jobHash, resumeHash });

            console.log("Checking for existing analysis...");

            // Priority 1: Check by URL OR Title+Company
            // If we have a Job URL, that's a very strong signal.
            // If not, we fall back to Title + Company.
            let existingAnalysis = null;
            const hasUrl = jobUrl && jobUrl.length > 5;
            const hasDetails = jobTitle && jobCompany && jobTitle.length > 2 && jobCompany.length > 2;

            if (hasUrl || hasDetails) {
                console.log(`Checking by details... URL: ${hasUrl}, Details: ${hasDetails}`);
                existingAnalysis = await historyService.findExistingAnalysisByDetails(
                    jobTitle || '',
                    jobCompany || '',
                    resumeHash,
                    jobUrl // Pass the URL for the stronger check
                );
            }

            // Priority 2: Fallback to strict Hash Check (if nothing found by title/company)
            if (!existingAnalysis) {
                console.log("Checking by strict hash...");
                existingAnalysis = await historyService.findExistingAnalysis(jobHash, resumeHash);
            }

            if (existingAnalysis) {
                console.log("Existing analysis found.");
                setLoading(false);
                Alert.alert(
                    "Duplicate Analysis",
                    "You have already analyzed this resume for this position (" + existingAnalysis.jobTitle + " at " + existingAnalysis.company + ").",
                    [
                        {
                            text: "Exit",
                            style: "cancel",
                            onPress: () => console.log("User cancelled analysis")
                        },
                        {
                            text: "Start New Anyway",
                            style: "destructive", // Highlighted as a 're-do' action
                            onPress: async () => {
                                console.log("User chose to start new anyway");
                                await proceedWithAnalysis(jobHash, resumeHash);
                            }
                        },
                        {
                            text: "View Existing",
                            onPress: () => {
                                // @ts-ignore
                                setCurrentAnalysis({
                                    ...existingAnalysis.analysisData,
                                    id: existingAnalysis.id,
                                    job: existingAnalysis.jobData,
                                    resume: existingAnalysis.resumeData || {} as any,
                                    optimizedResume: existingAnalysis.optimizedResumeData,
                                    changes: existingAnalysis.changesData
                                });

                                router.push({ pathname: '/analysis-result', params: { id: existingAnalysis.id } } as any);
                            }
                        }
                    ]
                );
                return;
            }

            console.log("Proceeding with new analysis...");
            await proceedWithAnalysis(jobHash, resumeHash);

        } catch (error: any) {
            console.error('Analysis error caught in handleAnalyze:', error);
            alertError(error);
            setLoading(false);
        }
    };

    const alertError = (error: any) => {
        if (error.message && error.message.includes('SCREENSHOT')) {
            Alert.alert('Resume Parsing Limit', error.message);
        } else {
            Alert.alert('Error', error.message || 'Failed to analyze.');
        }
    };


    const { activeTasks } = useTaskQueue();
    const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
    const hasLoggedCompletionRef = useRef<string | null>(null); // Track which task completion has been logged

    const progressRef = useRef<number>(0); // Track progress for background listener

    // Watch for task completion (direct subscription)
    React.useEffect(() => {
        if (!currentTaskId) return;

        console.log(`Subscribing to task updates for: ${currentTaskId}`);
        setLoading(true); // Ensure loading is ON when we start watching a task

        const unsubscribe = taskService.subscribeToTask(currentTaskId, (task) => {
            console.log(`Task update: ${task.id} [${task.status}] - ${task.progress}%`);
            setStage(`${task.stage} (${task.progress}%)`);
            progressRef.current = task.progress; // Update ref

            if (task.status === 'completed' && task.resultId) {
                // ... (completion logic)
                console.log("Task completed! resultId:", task.resultId);
                setLoading(false);
                historyService.getUserHistory().then(history => {
                    const saved = history.find(h => h.id === task.resultId);
                    if (saved) {
                        console.log("Analysis data found in history, navigating...");
                        setCurrentAnalysis({
                            ...saved.analysisData,
                            id: saved.id,
                            job: saved.jobData,
                            resume: saved.resumeData || {} as any,
                            optimizedResume: saved.optimizedResumeData,
                            changes: saved.changesData
                        });

                        // 3. Log completion (0 tokens) - only once per task
                        if (hasLoggedCompletionRef.current !== task.resultId) {
                            hasLoggedCompletionRef.current = task.resultId ?? null;
                            activityService.logActivity({
                                type: 'gap_analysis',
                                description: `Analyzed the resume for ${saved.jobData.title} at ${saved.jobData.company}`,
                                skipTokenDeduction: true
                            });
                        }

                        setCurrentTaskId(null); // Stop watching

                        if (AppState.currentState === 'active') {
                            console.log("App is active, navigating to results...");
                            router.push({ pathname: '/analysis-result', params: { id: saved.id } } as any);
                        } else {
                            console.log("App is backgrounded, skipping auto-navigation. User should tap notification.");
                            // We still clear the current task ID so the UI resets when they return
                        }

                        setCurrentTaskId(null); // Stop watching
                    } else {
                        // Fallback: If history fetch lags, try fetching specific doc?
                        console.warn("Task completed but result not found in history fetch yet.");
                        setTimeout(() => {
                            historyService.getUserHistory().then(retryHistory => {
                                const retrySaved = retryHistory.find(h => h.id === task.resultId);
                                if (retrySaved) {
                                    setCurrentAnalysis({
                                        ...retrySaved.analysisData,
                                        id: retrySaved.id,
                                        job: retrySaved.jobData,
                                        resume: retrySaved.resumeData || {} as any,
                                        optimizedResume: retrySaved.optimizedResumeData,
                                        changes: retrySaved.changesData
                                    });
                                    if (AppState.currentState === 'active') {
                                        router.push({ pathname: '/analysis-result', params: { id: retrySaved.id } } as any);
                                    }
                                }
                            });
                        }, 2000);
                    }
                });
            } else if (task.status === 'cancelled') {
                console.log("Task cancelled:", task.error);
                setLoading(false);
                setCurrentTaskId(null);
                // Don't show alert for user-initiated cancellations
            } else if (task.status === 'failed') {
                console.error("Task failed:", task.error);
                setLoading(false);
                setCurrentTaskId(null);
                Alert.alert("Analysis Failed", task.error || "Unknown error");
            }
        }, (error) => {
            console.error("Subscription failed:", error);
            setCurrentTaskId(null);
            Alert.alert("Connection Error", "Lost connection to task status.");
        });

        return () => unsubscribe();
    }, [currentTaskId]);

    // Background Listener for "Parsing Paused" notification
    React.useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'background' && currentTaskId && progressRef.current < 19) {
                console.log(`[Analyze] App backgrounded with progress ${progressRef.current}%. Triggering warning.`);
                notificationService.notifyBackgroundWarning();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [currentTaskId]);


    const proceedWithAnalysis = async (jobHash: string, resumeHash: string) => {
        console.log("--- proceedWithAnalysis ---", { jobHash, resumeHash });
        try {
            setLoading(true);

            // Check if we already have a RUNNING task for this hash to attach to
            const existingRunningTask = activeTasks.find(t =>
                t.payload.jobHash === jobHash &&
                t.payload.resumeHash === resumeHash &&
                t.status !== 'failed' &&
                t.status !== 'completed'
            );

            if (existingRunningTask) {
                console.log("Found existing running task:", existingRunningTask.id);
                setCurrentTaskId(existingRunningTask.id);
                return;
            }

            // 1. Prepare Payload
            // Extract pure URIs from the objects for the worker AND filter out invalid ones
            const fileUris = cvUris
                .map(f => (typeof f === 'object' ? f.uri : f))
                .filter(uri => typeof uri === 'string' && uri.length > 0);

            console.log("Analysis Payload URIs:", fileUris);

            const payload = {
                jobUrl,
                jobText,
                jobTitle,
                jobCompany,
                resumeText,
                resumeFiles: fileUris, // Send strings to worker/backend
                screenshots: screenshots.length > 0 ? screenshots : undefined,
                jobHash,
                resumeHash
            };

            // 2. Deduct tokens BEFORE creating the task
            try {
                // Use a temporary activity ID to link if needed, or just log
                await activityService.logActivity({
                    type: 'ats_score_calculation',
                    description: "Analyze Resume has started",
                });
                console.log("[analyze.tsx] Tokens deducted successfully BEFORE task creation");
            } catch (deductError: any) {
                console.error("[analyze.tsx] Token deduction failed:", deductError);
                setLoading(false);
                Alert.alert("Token Error", deductError.message || "Failed to deduct tokens. Please try again.");
                return;
            }

            // 2. Create the Task ONLY after successful deduction
            console.log("Creating new task...");
            const taskId = await taskService.createTask('analyze_resume', payload);
            console.log("Task created with ID:", taskId);

            setCurrentTaskId(taskId);

        } catch (error: any) {
            console.error('Task creation error in proceedWithAnalysis:', error);
            setLoading(false); // Can keep this for creating error
            setCurrentTaskId(null); // Ensure task ID is cleared if creation failed
            Alert.alert('Error', 'Failed to start analysis task.');
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={{ paddingBottom: 100 }}>
                    <Portal>
                        <Dialog visible={fallbackVisible} onDismiss={() => setFallbackVisible(false)} style={{ backgroundColor: theme.colors.elevation.level3 }}>
                            <Dialog.Title>Parsing Issue</Dialog.Title>
                            <Dialog.Content>
                                <Text>
                                    We couldn't access that link directly (likely due to security protections).

                                    Please choose a fallback method:
                                </Text>
                            </Dialog.Content>
                            <Dialog.Actions style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                                <Button onPress={() => setFallbackVisible(false)}>Cancel</Button>
                                <Button mode="contained" onPress={pickScreenshot}>Upload Screenshot</Button>
                                <Button mode="outlined" onPress={() => {
                                    setFallbackVisible(false);
                                    Alert.alert("Tip", "Switch to the 'Paste Text' tab above.");
                                }}>Paste Text</Button>
                            </Dialog.Actions>
                        </Dialog>
                    </Portal>

                    <Text variant={isAndroid ? "headlineSmall" : "headlineMedium"} style={[styles.title, isAndroid && { fontSize: scaleFont(20) }]}>
                        Analyze Your Resume
                    </Text>

                    <Text variant={isAndroid ? "bodySmall" : "bodyMedium"} style={styles.subtitle}>
                        Get honest feedback on your job readiness and optimize your resume for ATS systems.
                    </Text>

                    <View style={styles.section}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>
                            1. Job Posting
                        </Text>



                        <JobURLInput
                            urlValue={jobUrl}
                            textValue={jobText}
                            mode={inputMode}
                            onModeChange={setInputMode}
                            onUrlChange={setJobUrl}
                            onTextChange={setJobText}
                            isExtracting={isExtractingJob}
                        />

                        {screenshots.length > 0 && (
                            <View style={[styles.screenshotPreview, { backgroundColor: theme.colors.elevation.level1 }]}>
                                <Text style={{ color: theme.colors.primary }}>✓ {screenshots.length} Screenshot(s) attached</Text>
                                <IconButton icon="close" size={20} onPress={() => setScreenshots([])} />
                            </View>
                        )}

                        {isExtractingJob && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, padding: 8, backgroundColor: theme.colors.primaryContainer, borderRadius: 8 }}>
                                <ActivityIndicator size="small" color={theme.colors.primary} />
                                <Text style={{ marginLeft: 8, color: theme.colors.onPrimaryContainer }}>Extracting job details...</Text>
                            </View>
                        )}

                        {inputMode === 'text' && (
                            <View style={{ marginTop: 24 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <Text variant="titleMedium">Job Details</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <IconButton
                                            icon="trash-can-outline"
                                            iconColor={theme.colors.error}
                                            size={24}
                                            onPress={() => {
                                                Alert.alert(
                                                    "Clear Job Details",
                                                    "Are you sure you want to remove all job info?",
                                                    [
                                                        { text: "Cancel", style: "cancel" },
                                                        { text: "Delete", style: "destructive", onPress: handleClearJob }
                                                    ]
                                                );
                                            }}
                                        />
                                        <Button
                                            mode="outlined"
                                            onPress={() => setIsEditingJob(!isEditingJob)}
                                            icon={isEditingJob ? "check" : "pencil"}
                                            style={{ minWidth: 80 }}
                                        >
                                            {isEditingJob ? "Done" : "Edit"}
                                        </Button>
                                    </View>
                                </View>

                                {isEditingJob ? (
                                    <View style={{ gap: 12 }}>
                                        <TextInput
                                            label="Postion name"
                                            mode="outlined"
                                            value={jobTitle}
                                            onChangeText={setJobTitle}
                                            style={{ backgroundColor: theme.colors.surface }}
                                        />
                                        <TextInput
                                            label="company name"
                                            mode="outlined"
                                            value={jobCompany}
                                            onChangeText={setJobCompany}
                                            style={{ backgroundColor: theme.colors.surface }}
                                        />
                                        <TextInput
                                            label="Job Description"
                                            mode="outlined"
                                            value={jobText}
                                            onChangeText={setJobText}
                                            multiline
                                            numberOfLines={10}
                                            style={{ backgroundColor: theme.colors.surface }}
                                        />
                                    </View>
                                ) : (
                                    <View>
                                        <List.Accordion
                                            title="Postion name"
                                            description={jobTitle || "Not specified"}
                                            expanded={expandedSections.title}
                                            onPress={() => toggleSection('title')}
                                            left={(props: any) => <List.Icon {...props} icon="briefcase-outline" />}
                                            style={{ backgroundColor: theme.colors.elevation.level1, borderRadius: 8, marginBottom: 8 }}
                                        >
                                            <List.Item title={jobTitle || "No title extracted"} titleNumberOfLines={0} />
                                        </List.Accordion>

                                        <List.Accordion
                                            title="company name"
                                            description={jobCompany || "Not specified"}
                                            expanded={expandedSections.company}
                                            onPress={() => toggleSection('company')}
                                            left={(props: any) => <List.Icon {...props} icon="office-building-marker-outline" />}
                                            style={{ backgroundColor: theme.colors.elevation.level1, borderRadius: 8, marginBottom: 8 }}
                                        >
                                            <List.Item title={jobCompany || "No company extracted"} titleNumberOfLines={0} />
                                        </List.Accordion>

                                        <List.Accordion
                                            title="Job Description"
                                            expanded={expandedSections.description}
                                            onPress={() => toggleSection('description')}
                                            left={(props: any) => <List.Icon {...props} icon="text-box-outline" />}
                                            style={{ backgroundColor: theme.colors.elevation.level1, borderRadius: 8 }}
                                        >
                                            <View style={{ padding: 16, backgroundColor: theme.colors.elevation.level1 }}>
                                                <Text variant="bodyMedium">{jobText || "No description provided."}</Text>
                                            </View>
                                        </List.Accordion>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    <JobBrowser
                        visible={browserVisible}
                        initialUrl={jobUrl}
                        onClose={() => setBrowserVisible(false)}
                        onImport={handleBrowserImport}
                    />

                    <View style={styles.section}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>
                            2. Your Resume
                        </Text>
                        <CVUploader
                            key={uploadKey}
                            onFileSelected={setCvUris}
                            isTextModeActive={resumeText.length > 0 && cvUris.length === 0}
                        />

                        {extractingResume && (
                            <View style={[styles.extractingContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
                                <ActivityIndicator size="small" />
                                <Text style={{ marginLeft: 8 }}>Extracting text from resume...</Text>
                            </View>
                        )}

                        {resumeText.length > 0 && !extractingResume && (
                            <View style={styles.previewContainer}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <Text variant="labelMedium">Resume Content Preview:</Text>
                                    <Button
                                        mode="text"
                                        compact
                                        textColor={theme.colors.error}
                                        icon="delete"
                                        onPress={handleCleanup}
                                    >
                                        Delete & Reset
                                    </Button>
                                </View>
                                <TextInput
                                    mode="outlined"
                                    value={resumeText}
                                    onChangeText={setResumeText}
                                    multiline
                                    numberOfLines={8}
                                    style={{ backgroundColor: theme.colors.surface, minHeight: 150 }}
                                    right={
                                        <TextInput.Icon icon="pencil" />
                                    }
                                />
                                <Text variant="bodySmall" style={{ opacity: 0.6, marginTop: 4 }}>
                                    Please review and edit if the extracted text looks incorrect.
                                </Text>
                            </View>
                        )}
                    </View>


                    {(() => {
                        const isJobPopulated = !!(jobTitle?.trim() && jobCompany?.trim() && (jobText?.trim() || screenshots.length > 0));
                        const isResumePopulated = !!(cvUris.length > 0 || resumeText?.trim());

                        return (
                            <Button
                                mode="contained"
                                onPress={() => handleAnalyze()}
                                disabled={loading || !!currentTaskId || extractingResume || !isJobPopulated || !isResumePopulated}
                                style={[styles.button, { paddingVertical: moderateScale(isAndroid ? 2 : 4) }]}
                                compact={isAndroid}
                            >
                                {!!currentTaskId ? 'Analyzing...' : loading ? 'Checking...' : 'Analyze Resume'}
                            </Button>
                        );
                    })()}

                    {
                        (loading || !!currentTaskId) && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" />
                                <Text style={styles.loadingText}>{stage || 'Preparing...'}</Text>
                                <ResumeTipsCarousel />
                            </View>
                        )
                    }
                </ScrollView>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: horizontalScale(16),
    },
    title: {
        fontSize: scaleFont(24),
        marginBottom: verticalScale(8),
    },
    subtitle: {
        fontSize: scaleFont(14),
        marginBottom: verticalScale(24),
        opacity: 0.7,
    },
    section: {
        marginBottom: verticalScale(isAndroid ? 16 : 24),
    },
    sectionTitle: {
        fontSize: scaleFont(16),
        marginBottom: verticalScale(12),
    },
    button: {
        marginTop: verticalScale(16),
        marginBottom: verticalScale(40),
    },
    loadingContainer: {
        marginTop: verticalScale(24),
        alignItems: 'center',
        marginBottom: verticalScale(40),
        width: '100%',
    },
    loadingText: {
        marginTop: verticalScale(8),
        opacity: 0.7,
    },
    screenshotPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: verticalScale(8),
        padding: horizontalScale(8),
        borderRadius: moderateScale(8),
    },
    extractingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: moderateScale(12),
        borderRadius: moderateScale(8),
        marginTop: verticalScale(8),
    },
    previewContainer: {
        marginTop: verticalScale(12),
    }
});
