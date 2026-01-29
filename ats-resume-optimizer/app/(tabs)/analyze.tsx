import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Button, Text, ActivityIndicator, IconButton, Dialog, Portal, TextInput, useTheme } from 'react-native-paper';
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
import { useTaskQueue } from '../../src/context/TaskQueueContext';
import { linkedInService } from '../../src/services/external/linkedInService';
import { UserHeader } from '../../src/components/layout/UserHeader'; // Import UserHeader

import { useTokenCheck } from '../../src/hooks/useTokenCheck'; // Add import

export default function AnalyzeScreen() {
    const theme = useTheme();
    // State management
    const router = useRouter();
    const { setCurrentAnalysis } = useResumeStore();
    const [jobUrl, setJobUrl] = useState('');
    const [jobText, setJobText] = useState('');
    const [inputMode, setInputMode] = useState<'url' | 'text'>('url');
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

    const handleExtractJob = async () => {
        if (!jobUrl) {
            Alert.alert("Missing URL", "Please enter a valid job URL first.");
            return;
        }

        setIsExtractingJob(true);
        try {
            console.log(`Extracting job form URL: ${jobUrl}`);
            // Use the fast-path text extraction
            const extractedText = await jobParserService.fetchJobDescription(jobUrl);

            if (extractedText && extractedText.length > 50) {
                setJobText(extractedText);
                // Switch to text mode so user can see/edit the extracted text
                if (inputMode === 'url') {
                    setInputMode('text');
                }
                Alert.alert("Success", "Job description extracted successfully!");
            } else {
                Alert.alert("Warning", "Could not extract a clear description. Please paste it manually.");
            }

        } catch (e: any) {
            console.error("Job extraction failed:", e);
            Alert.alert("Extraction Failed", e.message || "Could not parse job details. Please copy & paste the text.");
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
            const existingAnalysis = await historyService.findExistingAnalysis(jobHash, resumeHash);

            if (existingAnalysis) {
                console.log("Existing analysis found.");
                setLoading(false);
                Alert.alert(
                    "Analysis Exists",
                    "You have already analyzed this specific job and resume pairing.",
                    [
                        {
                            text: "View Existing Result",
                            onPress: () => {
                                setCurrentAnalysis({
                                    ...existingAnalysis.analysisData,
                                    id: existingAnalysis.id,
                                    job: existingAnalysis.jobData,
                                    resume: existingAnalysis.resumeData || {} as any,
                                    optimizedResume: existingAnalysis.optimizedResumeData,
                                    changes: existingAnalysis.changesData
                                });

                                if (existingAnalysis.action === 'optimize') {
                                    router.push('/analysis-result');
                                } else {
                                    router.push('/upskilling-path');
                                }
                            }
                        },
                        {
                            text: "Start New Anyway",
                            style: "cancel",
                            onPress: async () => {
                                console.log("User chose to start new anyway");
                                await proceedWithAnalysis(jobHash, resumeHash);
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

    // Watch for task completion (direct subscription)
    React.useEffect(() => {
        if (!currentTaskId) return;

        console.log(`Subscribing to task updates for: ${currentTaskId}`);
        setLoading(true); // Ensure loading is ON when we start watching a task

        const unsubscribe = taskService.subscribeToTask(currentTaskId, (task) => {
            console.log(`Task update: ${task.id} [${task.status}] - ${task.progress}%`);
            setStage(`${task.stage} (${task.progress}%)`);

            if (task.status === 'completed' && task.resultId) {
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

                        // 3. Log completion (0 tokens)
                        activityService.logActivity({
                            type: 'gap_analysis',
                            description: `Analyzed the resume for ${saved.jobData.title} at ${saved.jobData.company}`,
                            skipTokenDeduction: true
                        });

                        setCurrentTaskId(null); // Stop watching

                        if (saved.action === 'optimize') {
                            router.push('/analysis-result');
                        } else {
                            router.push('/upskilling-path');
                        }
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
                                    if (retrySaved.action === 'optimize') router.push('/analysis-result');
                                    else router.push('/upskilling-path');
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
            const payload = {
                jobUrl,
                jobText,
                resumeText,
                resumeFiles: cvUris,
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

                    <Text variant="headlineMedium" style={styles.title}>
                        Analyze Your Resume
                    </Text>

                    <Text variant="bodyMedium" style={styles.subtitle}>
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
                            onExtract={handleExtractJob}
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
                                <Text style={{ marginLeft: 8, color: theme.colors.onPrimaryContainer }}>Extracting job details from LinkedIn...</Text>
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


                    <Button
                        mode="contained"
                        onPress={() => handleAnalyze()}
                        disabled={loading || !!currentTaskId || extractingResume || (!jobUrl && !jobText && screenshots.length === 0) || (cvUris.length === 0 && !resumeText)}
                        style={styles.button}
                    >
                        {!!currentTaskId ? 'Analyzing...' : loading ? 'Checking...' : 'Analyze Resume'}
                    </Button>

                    {
                        (loading || !!currentTaskId) && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" />
                                <Text style={styles.loadingText}>{stage || 'Preparing...'}</Text>
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
        padding: 16,
    },
    title: {
        marginBottom: 8,
    },
    subtitle: {
        marginBottom: 24,
        opacity: 0.7,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        marginBottom: 12,
    },
    button: {
        marginTop: 16,
        marginBottom: 40,
    },
    loadingContainer: {
        marginTop: 24,
        alignItems: 'center',
        marginBottom: 40,
    },
    loadingText: {
        marginTop: 8,
        opacity: 0.7,
    },
    screenshotPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        padding: 8,
        borderRadius: 8,
    },
    extractingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginTop: 8,
    },
    previewContainer: {
        marginTop: 12,
    }
});
