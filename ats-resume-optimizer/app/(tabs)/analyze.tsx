import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Button, Text, ActivityIndicator, IconButton, Dialog, Portal, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
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
import { useTaskQueue } from '../../src/context/TaskQueueContext';

export default function AnalyzeScreen() {
    // ... existing hooks ...
    const router = useRouter();
    const { setCurrentAnalysis } = useResumeStore();

    const [jobUrl, setJobUrl] = useState('');
    const [jobText, setJobText] = useState('');
    const [cvUris, setCvUris] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [stage, setStage] = useState('');
    const [browserVisible, setBrowserVisible] = useState(false);

    // Resume Preview State
    const [resumeText, setResumeText] = useState('');
    const [extractingResume, setExtractingResume] = useState(false);
    const [uploadKey, setUploadKey] = useState(0); // Key to force-reset Uploader

    // Fallback UI State
    const [fallbackVisible, setFallbackVisible] = useState(false);
    const [screenshots, setScreenshots] = useState<string[]>([]);

    const [inputMode, setInputMode] = useState<'url' | 'text'>('url');

    // ... existing useEffect ...
    React.useEffect(() => {
        const extractResumeText = async () => {
            if (cvUris.length === 0) {
                // Only clear if we explicitly don't have files anymore (manual clear handled separately)
                if (!resumeText) setResumeText(''); // Prevent clearing if user is just typing text without file?
                // Actually logic: cvUris drives extraction. If empty, maybe user cleared it?
                // If user uploaded file, cvUris changes -> triggers extraction.
                // If user clears file via cleanup, cvUris becomes [], we want to clear text.
                return;
            }
            setExtractingResume(true);
            setResumeText(''); // Clear previous content immediately
            try {
                const text = await resumeParserService.extractContentFromFiles(cvUris);
                setResumeText(text);
            } catch (e) {
            } finally {
                setExtractingResume(false);
            }
        };
        extractResumeText();
    }, [cvUris]);

    // ... existing handlers ...

    const handleCleanup = () => {
        Alert.alert(
            "Clear Resume Data?",
            "This will remove the uploaded file and any text changes you've made. You will need to re-upload your resume.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete & Reset",
                    style: "destructive",
                    onPress: () => {
                        setCvUris([]);
                        setResumeText('');
                        setUploadKey(prev => prev + 1); // Force remount uploader
                    }
                }
            ]
        );
    };

    const handleBrowserImport = (text: string, url: string) => {
        setJobText(text); // Auto-fill text
        setJobUrl(url);   // Save URL for reference
        setInputMode('text'); // Switch to text mode to show preview
        setBrowserVisible(false); // Close browser
    };

    const pickScreenshot = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            base64: true,
            quality: 0.7,
            allowsMultipleSelection: true,
            selectionLimit: 5,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const newScreenshots = result.assets.map(a => a.base64).filter(b => b) as string[];
            setScreenshots([...screenshots, ...newScreenshots]);
            setFallbackVisible(false);
        }
    };

    const handleAnalyze = async (overrideMethod?: 'text' | 'image') => {
        if ((!jobUrl && !jobText && screenshots.length === 0 && !overrideMethod) || (cvUris.length === 0 && !resumeText)) {
            Alert.alert('Missing Information', 'Please provide job details (URL/Text) and your CV.');
            return;
        }

        setLoading(true);
        setFallbackVisible(false);

        try {
            // 0. Deduplication Check
            const targetJobHashRaw = jobUrl || jobText || (screenshots.length > 0 ? screenshots[0] : 'nojobby');
            const targetResumeHashRaw = resumeText || (cvUris.length > 0 ? cvUris[0] : 'noresume');

            const jobHash = await generateHash(targetJobHashRaw);
            const resumeHash = await generateHash(targetResumeHashRaw);

            const existingAnalysis = await historyService.findExistingAnalysis(jobHash, resumeHash);

            if (existingAnalysis) {
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
                                await proceedWithAnalysis(jobHash, resumeHash);
                            }
                        }
                    ]
                );
                return;
            }

            await proceedWithAnalysis(jobHash, resumeHash);

        } catch (error: any) {
            console.error('Analysis error:', error);
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

    // Watch for task completion (or existing running task)
    React.useEffect(() => {
        if (!currentTaskId) return;

        const task = activeTasks.find(t => t.id === currentTaskId);
        if (task) {
            setLoading(true);
            setStage(`${task.stage} (${task.progress}%)`);

            if (task.status === 'completed' && task.resultId) {
                // Task finished!
                setLoading(false);
                historyService.getUserHistory().then(history => {
                    const saved = history.find(h => h.id === task.resultId);
                    if (saved) {
                        setCurrentAnalysis({
                            ...saved.analysisData,
                            id: saved.id,
                            job: saved.jobData,
                            resume: saved.resumeData || {} as any,
                            optimizedResume: saved.optimizedResumeData,
                            changes: saved.changesData
                        });

                        // Clear local task ID tracking so we don't loop
                        setCurrentTaskId(null);

                        if (saved.action === 'optimize') {
                            router.push('/analysis-result');
                        } else {
                            router.push('/upskilling-path');
                        }
                    }
                });
            } else if (task.status === 'failed') {
                setLoading(false);
                setCurrentTaskId(null);
                Alert.alert("Analysis Failed", task.error || "Unknown error");
            }

        } else if (loading) {
            // Task disappeared? Maybe completed before we caught it or filtered out
            setLoading(false);
        }
    }, [activeTasks, currentTaskId]);


    const proceedWithAnalysis = async (jobHash: string, resumeHash: string) => {
        try {
            setLoading(true);

            // Check if we already have a RUNNING task for this hash to attach to
            const existingRunningTask = activeTasks.find(t =>
                t.payload.jobHash === jobHash &&
                t.payload.resumeHash === resumeHash &&
                t.status !== 'failed'
            );

            if (existingRunningTask) {
                console.log("Found existing running task, attaching...");
                setCurrentTaskId(existingRunningTask.id);
                return;
            }

            // Create new Task
            const payload = {
                jobUrl,
                jobText,
                resumeText,
                resumeFiles: cvUris,
                screenshots: screenshots.length > 0 ? screenshots : undefined,
                jobHash,
                resumeHash
            };

            const taskId = await taskService.createTask('analyze_resume', payload);
            setCurrentTaskId(taskId);

        } catch (error: any) {
            console.error('Task creation error:', error);
            setLoading(false);
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
                <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
                    <Portal>
                        <Dialog visible={fallbackVisible} onDismiss={() => setFallbackVisible(false)}>
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

                        <Button
                            mode={jobUrl ? "contained-tonal" : "outlined"}
                            icon="web"
                            onPress={() => setBrowserVisible(true)}
                            style={{ marginBottom: 16 }}
                            disabled={!jobUrl}
                        >
                            Open Job Link in Browser (Import)
                        </Button>

                        <JobURLInput
                            urlValue={jobUrl}
                            textValue={jobText}
                            mode={inputMode}
                            onModeChange={setInputMode}
                            onUrlChange={setJobUrl}
                            onTextChange={setJobText}
                        />

                        {screenshots.length > 0 && (
                            <View style={styles.screenshotPreview}>
                                <Text style={{ color: 'green' }}>✓ {screenshots.length} Screenshot(s) attached</Text>
                                <IconButton icon="close" size={20} onPress={() => setScreenshots([])} />
                            </View>
                        )}

                        <Button
                            mode="text"
                            icon="camera"
                            onPress={pickScreenshot}
                            style={{ alignSelf: 'flex-start', marginLeft: -8 }}
                        >
                            Or Upload Screenshot(s)
                        </Button>
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
                            <View style={styles.extractingContainer}>
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
                                        textColor="red"
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
                                    style={{ backgroundColor: '#f9f9f9', minHeight: 150 }}
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
                        disabled={loading || extractingResume || (!jobUrl && !jobText && screenshots.length === 0) || (cvUris.length === 0 && !resumeText)}
                        style={styles.button}
                    >
                        {loading ? 'Analyzing...' : 'Analyze Resume'}
                    </Button>

                    {
                        loading && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" />
                                <Text style={styles.loadingText}>{stage}</Text>
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
        backgroundColor: '#e8f5e9',
        borderRadius: 8,
    },
    extractingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        marginTop: 8,
    },
    previewContainer: {
        marginTop: 12,
    }
});
