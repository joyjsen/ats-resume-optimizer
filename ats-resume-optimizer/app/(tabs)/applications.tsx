import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, ScrollView, Keyboard } from 'react-native';
import { Text, Button, Searchbar, SegmentedButtons, FAB, useTheme, ActivityIndicator, Portal, Dialog, TextInput, ProgressBar, Card, Chip, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { applicationService } from '../../src/services/firebase/applicationService';
import { Application, ApplicationStage } from '../../src/types/application.types';
import { ApplicationCard } from '../../src/components/applications/ApplicationCard';
import { historyService } from '../../src/services/firebase/historyService';
import { DocxGenerator } from '../../src/services/docx/docxGenerator';
import { ParsedResume } from '../../src/types/resume.types';
import { useResumeStore } from '../../src/store/resumeStore';
import { perplexityService } from '../../src/services/ai/perplexityService';
import { prepAssistantService } from '../../src/services/ai/prepAssistant';
import { prepGuidePdfGenerator } from '../../src/services/pdf/pdfGenerator';

export default function ApplicationsScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { setCurrentAnalysis } = useResumeStore();
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewingCoverLetterApp, setViewingCoverLetterApp] = useState<Application | null>(null);
    const [isEditingCoverLetter, setIsEditingCoverLetter] = useState(false);
    const [editedCoverLetterContent, setEditedCoverLetterContent] = useState('');
    const [viewMode, setViewMode] = useState('active'); // active | archived

    // Prep Guide State
    const [prepConfirmationVisible, setPrepConfirmationVisible] = useState(false);
    const [viewingPrepAppId, setViewingPrepAppId] = useState<string | null>(null); // For "View Guide" dialog (completed state)
    const [viewDialogVisible, setViewDialogVisible] = useState(false);
    const abortControllers = useRef<Map<string, AbortController>>(new Map());

    // Derived State for Generating App (to show banner)
    const generatingApp = applications.find(a => a.prepGuide?.status === 'generating');

    // Derived State for Viewing App
    const viewingPrepApp = viewingPrepAppId ? applications.find(a => a.id === viewingPrepAppId) : null;

    useEffect(() => {
        const unsubscribe = applicationService.subscribeToApplications((apps) => {
            setApplications(apps);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const filteredApplications = applications.filter(app => {
        const matchesSearch =
            app.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
            app.company.toLowerCase().includes(searchQuery.toLowerCase());

        const isArchived = app.isArchived;
        if (viewMode === 'active') return !isArchived && matchesSearch;
        return isArchived && matchesSearch;
    });

    const handleStatusUpdate = async (id: string, stage: ApplicationStage, note?: string, customName?: string) => {
        const success = await applicationService.updateStatus(id, stage, note, customName);
        if (success) {
            // Check if we need to lock dashboard (this logic is typically handled by the useEffect in Dashboard, 
            // but we might want to proactively update the Analysis document here if needed.
            // For now, the dashboard can read the Application status if we link them, OR we can rely on 
            // the user seeing the changes in this tab. The spec said "Dashboard Updates...".
            // Since we linked in historyService, we can query it or let the robust syncing happen later.
            // Simple Alert for now to confirm action.
        } else {
            Alert.alert("Error", "Failed to update status.");
        }
    };

    const handleGenerateCoverLetter = async (id: string) => {
        try {
            const app = applications.find(a => a.id === id);
            if (!app) return;

            if (app.coverLetter) {
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

    const generateLetter = async (app: Application) => {
        setLoading(true);
        try {
            // Get necessary data
            let resumeData: ParsedResume | null = null;
            let jobDescription = app.jobDescription;

            if (app.submittedResumeData) {
                resumeData = app.submittedResumeData;
            } else {
                const analysis = await historyService.getAnalysisById(app.analysisId);
                if (analysis) {
                    resumeData = analysis.optimizedResumeData || analysis.resumeData || null;
                    if (!jobDescription) jobDescription = analysis.jobData.description; // Fallback if app missing JD
                }
            }

            if (!resumeData) {
                Alert.alert("Error", "No resume data available to generate a cover letter.");
                return;
            }

            const letter = await perplexityService.generateCoverLetter(
                resumeData,
                app.jobTitle,
                app.company,
                jobDescription
            );

            await applicationService.saveCoverLetter(app.id, letter);
            Alert.alert("Success", "Cover Letter generated successfully!");

        } catch (error) {
            console.error("Cover Letter generation failed:", error);
            Alert.alert("Error", "Failed to generate cover letter. Please try again.");
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

    // Async Background Generation
    const runBackgroundGeneration = async (appId: string, signal?: AbortSignal) => {
        try {
            const app = applications.find(a => a.id === appId);
            if (!app) return;

            // 1. Generate Content (prepAssistantService now handles its own "generating" status update)
            const analysis = await historyService.getAnalysisById(app.analysisId);
            if (!analysis) throw new Error("Analysis data not found");
            if (signal?.aborted) return;

            const resumeToUse = app.submittedResumeData || analysis.optimizedResumeData || analysis.resumeData;

            const sections = await prepAssistantService.generatePrepGuide({
                applicationId: app.id,
                companyName: app.company,
                jobTitle: app.jobTitle,
                jobDescription: app.jobDescription || analysis.jobData.description,
                optimizedResume: JSON.stringify(resumeToUse),
                atsScore: app.atsScore,
                matchedSkills: analysis.analysisData.matchAnalysis?.matchedSkills.map((s: any) => s.skill) || [],
                partialMatches: analysis.analysisData.matchAnalysis?.partialMatches.map((s: any) => s.skill) || [],
                missingSkills: analysis.analysisData.matchAnalysis?.missingSkills.map((s: any) => s.skill) || [],
                newSkillsAcquired: [],
                userId: app.userId
            }, signal);

            if (signal?.aborted) return;

            // 2. Generate PDF
            const pdfUri = await prepGuidePdfGenerator.generateAndShare(sections, {
                companyName: app.company,
                jobTitle: app.jobTitle
            });

            // 3. Mark Complete
            await applicationService.updatePrepStatus(app.id, {
                status: 'completed',
                progress: 100,
                currentStep: 'Completed!',
                downloadUrl: pdfUri,
                generatedAt: new Date()
            });

        } catch (error) {
            console.error("Background Gen Error:", error);
            // Service handles 'failed' status update in catch block internal, but strictly:
            // updatePrepStatus('failed') is called in prepAssistantService catch.
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
        runBackgroundGeneration(appId, controller.signal).finally(() => {
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
                status: hasExistingGuide ? 'completed' : 'failed',
                historyStatus: 'failed',
                currentStep: hasExistingGuide ? 'Generation Cancelled. Restored previous guide.' : 'Cancelled by user',
                progress: hasExistingGuide ? 100 : 0
            });
        } catch (error) {
            console.error("Error cancelling prep:", error);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginBottom: 8 }}>My Applications</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <SegmentedButtons
                        value={viewMode}
                        onValueChange={setViewMode}
                        style={{ flex: 1, marginRight: 8 }}
                        buttons={[
                            { value: 'active', label: `Active (${applications.filter(a => !a.isArchived).length})` },
                            { value: 'archived', label: 'Archive' },
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
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" />
                </View>
            ) : (
                <FlatList
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
                            isResumeUpdated={
                                item.lastResumeUpdateAt
                                    ? (item.prepGuide?.generatedAt
                                        ? new Date(item.lastResumeUpdateAt).getTime() > new Date(item.prepGuide.generatedAt).getTime()
                                        : true)
                                    : false
                            }
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
                                    style={{ height: 400, backgroundColor: 'white' }}
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
                                setViewingCoverLetterApp(null);
                                generateLetter(app);
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
                            Generation time: ~60-90 seconds
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
