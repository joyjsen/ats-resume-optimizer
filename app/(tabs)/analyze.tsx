import React, { useState, useRef } from 'react';
import { View, ScrollView, StyleSheet, Alert, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, AppState, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Button, Text, ActivityIndicator, IconButton, Dialog, Portal, Modal, TextInput, useTheme, List, ProgressBar, Card, Chip } from 'react-native-paper';
import { useRouter, useNavigation, useFocusEffect } from 'expo-router';
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
import { ParsedResumeViewer } from '../../src/components/upload/ParsedResumeViewer';
import { useTaskQueue } from '../../src/context/TaskQueueContext';
import { linkedInService } from '../../src/services/external/linkedInService';
import { useTokenCheck } from '../../src/hooks/useTokenCheck';
import { horizontalScale, verticalScale, moderateScale, scaleFont } from '../../src/utils/responsive';
import { notificationService } from '../../src/services/firebase/notificationService';
import { generatedResumeService, GeneratedResume } from '../../src/services/firebase/generatedResumeService';
import { getAuth } from 'firebase/auth';
import { useTutorialStore } from '../../src/store/tutorialStore';
import { SequenceOverlay } from '../../src/components/common/SequenceOverlay';

const AnimatedPath = RNAnimated.createAnimatedComponent(Path);
const AnimatedCircle = RNAnimated.createAnimatedComponent(Circle);

const SVGArrow = () => {
    const drawAnim = React.useRef(new RNAnimated.Value(200)).current; 
    const drawArrowHead = React.useRef(new RNAnimated.Value(40)).current;
    const fadeCircle = React.useRef(new RNAnimated.Value(0)).current;

    React.useEffect(() => {
        RNAnimated.sequence([
            RNAnimated.delay(300),
            RNAnimated.timing(fadeCircle, { toValue: 1, duration: 200, useNativeDriver: true }),
            RNAnimated.timing(drawAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
            RNAnimated.timing(drawArrowHead, { toValue: 0, duration: 300, useNativeDriver: true })
        ]).start();
    }, []);

    return (
        <Svg width="140" height="110" viewBox="0 0 140 110" fill="none" style={{
            shadowColor: "#7C3AED",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 6,
            elevation: 3
        }}>
            <AnimatedPath
                d="M 120 10 C 100 8, 60 5, 30 30 C 10 48, 8 72, 20 88"
                stroke="#A78BFA"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
                strokeDasharray="200"
                strokeDashoffset={drawAnim}
            />
            <AnimatedPath
                d="M 20 88 L 8 76 M 20 88 L 34 80"
                stroke="#A78BFA"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
                strokeDasharray="40"
                strokeDashoffset={drawArrowHead}
            />
            <AnimatedCircle cx="122" cy="10" r="3" fill="#A78BFA" opacity={fadeCircle} />
        </Svg>
    );
};

const isAndroid = Platform.OS === 'android';

export default function AnalyzeScreen() {
    const theme = useTheme();
    const router = useRouter();
    const user = getAuth().currentUser;
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

    // Generated Resume State
    const [savedResumeDialogVisible, setSavedResumeDialogVisible] = useState(false);
    const [savedResumes, setSavedResumes] = useState<GeneratedResume[]>([]);
    const [isLoadingSavedResumes, setIsLoadingSavedResumes] = useState(false);

    // Track task progress natively
    const { activeTasks } = useTaskQueue();
    const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
    const [initialActivityId, setInitialActivityId] = useState<string | null>(null);
    const hasLoggedCompletionRef = useRef<string | null>(null); // Track which task completion has been logged
    const progressRef = useRef<number>(0); // Track progress for background listener

    // New UI state for Job Details
    const [isEditingJob, setIsEditingJob] = useState(false);
    const [glowResume, setGlowResume] = useState(false);
    const [showJobTutorialOverlay, setShowJobTutorialOverlay] = useState(false);
    
    // Resume Sequence State
    const [resumeStep, setResumeStep] = useState(0);
    const [resumeSectionY, setResumeSectionY] = useState<number>(0);
    const [resumeLayoutMap, setResumeLayoutMap] = useState<Record<string, any>>({});
    
    // Auto-scroll to ensure tutorial is visible
    React.useEffect(() => {
        if (resumeStep > 0 && resumeUploadSequence[resumeStep - 1] && resumeLayoutMap[resumeUploadSequence[resumeStep - 1].key]) {
             const targetY = resumeLayoutMap[resumeUploadSequence[resumeStep - 1].key].y + resumeSectionY;
             scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 280), animated: true });
        }
    }, [resumeStep, resumeSectionY, resumeLayoutMap]);
    
    const scrollViewRef = React.useRef<ScrollView>(null);
    const [scrollY, setScrollY] = useState(0);
    const [headerHeight, setHeaderHeight] = useState(0);
    
    const resumeUploadSequence = [
        { key: 'gallery', title: 'Gallery', desc: 'Click here to upload an image/screenshot of your resume' },
        { key: 'files', title: 'File', desc: 'Click here to upload a file in supported format (DOCX or TXT)' },
        { key: 'createNew', title: 'Create New', desc: 'Click here to create a new resume' },
        { key: 'useSaved', title: 'Use saved', desc: 'Click here to select and use a saved resume which was created using this app' }
    ];

    const [jobInputLayout, setJobInputLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const overlayOpacity = useRef(new RNAnimated.Value(0)).current;

    // End of workflow tracking
    const analyzeBtnGlowAnim = useRef(new RNAnimated.Value(0)).current;
    const prevReadyRef = useRef(false);

    // Parse Viewer State
    const [parsedResumeData, setParsedResumeData] = useState<any>(null);
    const [isViewerVisible, setIsViewerVisible] = useState(false);
    const [isParsingResume, setIsParsingResume] = useState(false);
    const [parsingProgress, setParsingProgress] = useState(0);
    const [hasAttemptedJobExtraction, setHasAttemptedJobExtraction] = useState(false);
    const [hasAttemptedResumeExtraction, setHasAttemptedResumeExtraction] = useState(false);

    // Simulated 44-second progress timer
    React.useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isParsingResume) {
            setParsingProgress(0);
            interval = setInterval(() => {
                setParsingProgress(prev => {
                    if (prev < 99) return prev + 1;
                    return prev;
                });
            }, 440); // 440ms * 100 steps = 44 seconds
        } else {
            setParsingProgress(0);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isParsingResume]);
    const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
        title: false,
        company: false,
        description: false
    });

    const isJobPopulated = !!(jobTitle?.trim() && jobCompany?.trim() && (jobText?.trim() || screenshots.length > 0));
    const isResumePopulated = !!(cvUris.length > 0 || resumeText?.trim() || parsedResumeData !== null);
    const isResumeFullyParsed = !!parsedResumeData;
    const isReadyToAnalyze = isJobPopulated && isResumePopulated && isResumeFullyParsed;

    React.useEffect(() => {
        if (isReadyToAnalyze && !loading && !currentTaskId) {
            RNAnimated.loop(
                RNAnimated.sequence([
                    RNAnimated.timing(analyzeBtnGlowAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
                    RNAnimated.timing(analyzeBtnGlowAnim, { toValue: 0, duration: 1000, useNativeDriver: false })
                ])
            ).start();
        } else {
            analyzeBtnGlowAnim.stopAnimation();
            analyzeBtnGlowAnim.setValue(0);
        }
    }, [isReadyToAnalyze, loading, currentTaskId]);

    React.useEffect(() => {
        if (isReadyToAnalyze && !prevReadyRef.current) {
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 600);
        }
        prevReadyRef.current = isReadyToAnalyze;
    }, [isReadyToAnalyze]);

    const analyzeBtnGlowColor = analyzeBtnGlowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['transparent', theme.colors.primary]
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

    // Also extract resume if job text exists and resume is ready but parsing wasn't clicked
    useFocusEffect(
        React.useCallback(() => {
            if (jobText && cvUris.length > 0 && !parsedResumeData && !hasAttemptedResumeExtraction) {
                // handleExtractResume()
            }
        }, [jobText, cvUris.length, parsedResumeData, hasAttemptedResumeExtraction])
    );

    const loadSavedResumes = async () => {
        if (!user) return;
        setIsLoadingSavedResumes(true);
        try {
            const resumes = await generatedResumeService.fetchGeneratedResumes(user.uid);
            if (resumes.length === 0) {
                Alert.alert("No Resumes", "You haven't created any resumes yet, please create one and retry", [{ text: "OK" }]);
            } else {
                setSavedResumes(resumes);
                setSavedResumeDialogVisible(true);
            }
        } catch (error) {
            console.log("[Analyze] Suppressed indexing error for empty generated config:", error);
            Alert.alert("No Resumes", "You haven't created any resumes yet, please create one and retry", [{ text: "OK" }]);
        } finally {
            setIsLoadingSavedResumes(false);
        }
    };

    const handleDeleteSavedResume = (resumeId: string) => {
        Alert.alert(
            "Delete Resume",
            "This action cannot be undone. Are you sure you want to permanently delete this resume?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        if (!user) return;
                        try {
                            await generatedResumeService.deleteGeneratedResume(user.uid, resumeId);
                            setSavedResumes(prev => prev.filter(r => r.id !== resumeId));
                        } catch (error) {
                            console.error("Failed to delete resume:", error);
                            Alert.alert("Error", "Could not delete resume. Please try again.");
                        }
                    }
                }
            ]
        );
    };

    // Track focus state manually to avoid importing @react-navigation/native directly
    const analyzeNavigation = useNavigation();
    const [isFocused, setIsFocused] = React.useState(false);

    useFocusEffect(
        React.useCallback(() => {
            setIsFocused(true);
            
            // Checking actual store state after 400ms to allow screen switch animations.
            const focusTimer = setTimeout(() => {
                const currentStore = useResumeStore.getState();
                const { isSkipped, hasSeenJobUrlTutorial } = useTutorialStore.getState();
                if (!isSkipped && !hasSeenJobUrlTutorial && !currentStore.jobUrl && !currentStore.jobText) {
                    setShowJobTutorialOverlay(true);
                    RNAnimated.timing(overlayOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
                }
            }, 400);

            return () => {
                setIsFocused(false);
                clearTimeout(focusTimer);
                setShowJobTutorialOverlay(false);
            };
        }, [])
    );

    // Only consume pending URL when this tab is actually focused
    React.useEffect(() => {
        if (pendingSharedUrl && isFocused) {
            console.log("[Analyze] Found pending shared URL in store:", pendingSharedUrl);
            const urlToUse = pendingSharedUrl;

            // CONSUME IMMEDIATELY: Clear it from the store so no other renders see it
            setPendingSharedUrl(null);

            // Auto-replace existing content
            applyPendingUrl(urlToUse);
        }
    }, [pendingSharedUrl, isFocused]);
    // Clear parsed data if resume changes
    React.useEffect(() => {
        if (parsedResumeData) {
            if (cvUris.length > 0 && cvUris[0].uri === 'app-generated') {
                return; // Do not wipe out manually injected generated payloads
            }
            console.log("[Analyze] CV URIs changed, clearing parsed data.");
            setParsedResumeData(null);
        }
    }, [cvUris]);

    React.useEffect(() => {
        if (parsedResumeData) {
            console.log("[Analyze] Resume text changed, clearing parsed data.");
            setParsedResumeData(null);
        }
    }, [resumeText]);

    const applyPendingUrl = (urlToUse: string) => {
        console.log("[Analyze] Setting jobUrl to:", urlToUse);
        setJobUrl(urlToUse);
        setJobText(''); // Clear previous text so we don't have mixed state
        setJobTitle('');
        setJobCompany('');
        console.log("[Analyze] Setting inputMode to: url");
        setInputMode('url');
        setPendingSharedUrl(null); // Clear it

        // Keep the shared text as a fallback, instead of skipping extraction.
        const sharedTextFallback = (pendingSharedText && pendingSharedText.length > 50) ? pendingSharedText : undefined;
        if (sharedTextFallback) {
            setPendingSharedText(null); // Consume it
        }

        console.log("[Analyze] Clearing pendingSharedUrl in store, triggering redirection/render...");
        setTimeout(() => {
            console.log("[Analyze] Timeout triggered: calling handleExtractJob with:", urlToUse);
            handleExtractJob(urlToUse, sharedTextFallback);
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
        setHasAttemptedJobExtraction(false);
    };

    const handleExtractJob = async (passedUrl?: string, fallbackText?: string) => {
        const urlToParse = passedUrl || jobUrl;

        if (!urlToParse) return;

        // 2. Otherwise, use JobParserService to fetch (Perplexity or LinkedIn direct)
        setIsExtractingJob(true);
        try {
            console.log(`[Analyze] Extracting job from URL: ${urlToParse}`);
            const { title, company, description } = await jobParserService.fetchJobDescription(urlToParse);
            
            const finalDesc = (description && description.length > 50) ? description : fallbackText;

            if (finalDesc && finalDesc.length > 50) {
                setJobTitle(title || '');
                setJobCompany(company || '');
                setJobText(finalDesc);
                setInputMode('text');
                setIsEditingJob(false); // Collapsed per user request
                setTimeout(() => {
                    setGlowResume(true);
                    scrollViewRef.current?.scrollTo({ y: resumeSectionY.current, animated: true });
                    const { isSkipped, hasSeenResumeUploadTutorial } = useTutorialStore.getState();
                    if (!isSkipped && !hasSeenResumeUploadTutorial && cvUris.length === 0 && !resumeText) {
                        setResumeStep(1);
                    }
                }, 500);
            } else {
                console.warn("[Analyze] Extraction failed: Content too short.");
                Alert.alert("Note", "We couldn't extract a clear description automatically. Would you like to open our browser to copy it manually?", [
                    { text: "No", style: "cancel" },
                    { text: "Open Browser", onPress: () => setBrowserVisible(true) }
                ]);
            }
        } catch (e: any) {
            console.error("Job extraction failed:", e);
            if (fallbackText && fallbackText.length > 50) {
                console.log("[Analyze] Using fallback text after extraction failure.");
                setJobTitle('');
                setJobCompany('');
                setJobText(fallbackText);
                setInputMode('text');
                setIsEditingJob(false);
                setTimeout(() => {
                    setGlowResume(true);
                    scrollViewRef.current?.scrollTo({ y: resumeSectionY.current, animated: true });
                    const { isSkipped, hasSeenResumeUploadTutorial } = useTutorialStore.getState();
                    if (!isSkipped && !hasSeenResumeUploadTutorial && cvUris.length === 0 && !resumeText) {
                        setResumeStep(1);
                    }
                }, 500);
            } else {
                Alert.alert("Extraction Failed", "We couldn't fetch details from this site. Please try copying and pasting the job text instead.");
            }
        } finally {
            setIsExtractingJob(false);
            setHasAttemptedJobExtraction(true);
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
        setParsedResumeData(null);
        setHasAttemptedResumeExtraction(false);
    };

    const handleExtractAndShow = async () => {
        if (cvUris.length === 0 && !resumeText) {
            Alert.alert("No Resume", "Please upload a file or paste text first.");
            return;
        }

        // OPTIMIZATION: If we already have parsed data for the current resume, just show it
        if (parsedResumeData) {
            console.log("[Analyze] Using existing parsed data.");
            setIsViewerVisible(true);
            return;
        }

        setIsParsingResume(true);
        try {
            let result;
            if (cvUris.length > 0) {
                // Ensure objects with uri, name, mimeType are preserved
                const fileItems = cvUris
                    .map(f => (typeof f === 'object' ? f : { uri: f, name: f }))
                    .filter(f => typeof f.uri === 'string' && f.uri.length > 0);

                result = await resumeParserService.parseResume(fileItems);
            } else {
                result = await resumeParserService.parseResumeFromContent(resumeText);
            }

            setParsedResumeData(result);
            setIsViewerVisible(true);
            notificationService.notifyParsingComplete();
        } catch (error: any) {
            console.error("Parse Preview Failed:", error);

            // Send failure notification
            notificationService.notifyParsingFailed();

            // Log failure in activity history
            activityService.logActivity({
                type: 'resume_parsing_failed',
                description: `Failed to parse resume: ${error.message || 'Unknown error'}`,
                skipTokenDeduction: true
            }).catch(e => console.error("Failed to log parsing failure activity:", e));

            Alert.alert("Parsing Failed", error.message || "Could not parse resume.");
        } finally {
            setIsParsingResume(false);
            setHasAttemptedResumeExtraction(true);
            if (!jobUrl && !jobText) {
                setTimeout(() => {
                    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                }, 500);
            }
        }
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


    // Hooks moved to top to prevent TDZ

    // Watch for task completion (direct subscription)
    React.useEffect(() => {
        if (!currentTaskId) return;

        console.log(`Subscribing to task updates for: ${currentTaskId}`);
        setLoading(true); // Ensure loading is ON when we start watching a task

        const subscriptionPromise = taskService.subscribeToTask(currentTaskId, (task) => {
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

                        // 3. Update activity (0 tokens) - only once per task
                        if (hasLoggedCompletionRef.current !== task.resultId) {
                            hasLoggedCompletionRef.current = task.resultId ?? null;

                            if (initialActivityId) {
                                console.log("[analyze.tsx] Updating existing activity with results...");
                                activityService.updateActivity(initialActivityId, {
                                    description: `Analyzed the resume for ${saved.jobData.title} at ${saved.jobData.company}`,
                                    contextData: {
                                        newATSScore: saved.atsScore,
                                    }
                                }).catch(e => console.error("Failed to update activity:", e));
                            } else {
                                console.log("[analyze.tsx] Logging new activity (fallback)...");
                                activityService.logActivity({
                                    type: 'gap_analysis',
                                    description: `Analyzed the resume for ${saved.jobData.title} at ${saved.jobData.company}`,
                                    skipTokenDeduction: true
                                }).catch(e => console.error("Failed to log activity:", e));
                            }
                        }

                        setCurrentTaskId(null); // Stop watching

                        if (AppState.currentState === 'active') {
                            console.log("[Analyze] Task completed. Navigating to results...");
                            router.push({ pathname: '/analysis-result', params: { id: saved.id } } as any);
                        } else {
                            console.log("[Analyze] App backgrounded, skipping auto-navigation. User should tap notification.");
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

        return () => {
            Promise.resolve(subscriptionPromise).then(unsub => {
                if (typeof unsub === 'function') unsub();
            }).catch(e => console.error("Unsubscribe error:", e));
        };
    }, [currentTaskId]);

    // Background Listener for "Parsing Paused" notification
    React.useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            const isTaskEarlyStatus = currentTaskId && progressRef.current < 19;
            const isLocallyParsing = isParsingResume;

            if (nextAppState === 'background' && (isTaskEarlyStatus || isLocallyParsing)) {
                console.log(`[Analyze] App backgrounded during active parsing (Local: ${isLocallyParsing}, Task Early: ${isTaskEarlyStatus}). Triggering warning.`);
                notificationService.notifyBackgroundWarning();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [currentTaskId, isParsingResume]);


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
            // Auto-Parse Resume if not already parsed (Ensures backend receives structured data)
            let finalResumeData = parsedResumeData;

            if (!finalResumeData) {
                console.log("[analyze.tsx] parsedResumeData missing. Auto-parsing client side...");
                try {
                    // Extract rich FileItems
                    const fileItems = cvUris
                        .map(f => (typeof f === 'object' ? f : { uri: f, name: f }))
                        .filter(f => typeof f.uri === 'string' && f.uri.length > 0);

                    if (fileItems.length > 0) {
                        finalResumeData = await resumeParserService.parseResume(fileItems);
                    } else if (resumeText) {
                        finalResumeData = await resumeParserService.parseResumeFromContent(resumeText);
                    }
                    // Update state so UI reflects it (optional but good)
                    setParsedResumeData(finalResumeData);
                } catch (parseError) {
                    console.error("[analyze.tsx] Auto-parsing failed:", parseError);
                    // Decide whether to proceed with raw text only or block. 
                    // Proceeding with raw text allows backend fallback logic to attempt parsing.
                }
            }

            console.log("[analyze.tsx] FINAL RESUME DATA TO SEND:", JSON.stringify(finalResumeData, null, 2));

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
                resume: finalResumeData, // <--- TRUSTED CLIENT DATA (Source of Truth)
                screenshots: screenshots.length > 0 ? screenshots : undefined,
                jobHash,
                resumeHash
            };

            // 2. Deduct tokens BEFORE creating the task
            try {
                // Use a temporary activity ID to link if needed, or just log
                const actId = await activityService.logActivity({
                    type: 'ats_score_calculation',
                    description: `Analyzing resume for ${jobTitle || 'selected job'} at ${jobCompany || 'selected company'}...`,
                });
                setInitialActivityId(actId);
                console.log(`[analyze.tsx] Tokens deducted successfully. Activity ID: ${actId}`);
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

    const getValidationMessage = () => {
        const missingFields = [];
        if (!jobTitle?.trim()) missingFields.push('position name');
        if (!jobCompany?.trim()) missingFields.push('company name');
        if (!jobText?.trim() && screenshots.length === 0) missingFields.push('job description');

        const isJobPopulated = !!(jobTitle?.trim() && jobCompany?.trim() && (jobText?.trim() || screenshots.length > 0));
        const isResumePopulated = !!(cvUris.length > 0 || resumeText?.trim());
        const isResumeFullyParsed = !(cvUris.length > 0 && !parsedResumeData);

        if (hasAttemptedJobExtraction && hasAttemptedResumeExtraction) {
            if (!isJobPopulated || !isResumePopulated || !isResumeFullyParsed) {
                let message = "We must have valid ";
                if (missingFields.length > 0) {
                    message += missingFields.join(' and ');
                    if (!isResumePopulated) message += " and resume data";
                    message += " for a resume analysis. We were not able to extract all details, please fill them up manually to proceed.";
                } else if (!isResumePopulated) {
                    message += "resume data for a resume analysis. Please upload a file or paste text manually.";
                } else if (!isResumeFullyParsed) {
                    message += "verified resume data. Please click 'Verify Parsed Data' above.";
                }
                return message;
            }
        }
        return null;
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView 
                    ref={scrollViewRef} 
                    style={[styles.container, { backgroundColor: theme.colors.background }]} 
                    contentContainerStyle={{ paddingBottom: 100 }}
                    onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
                    scrollEventThrottle={16}
                    onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.y)} // Approximation for top offset
                >
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

                        <Modal 
                            visible={savedResumeDialogVisible} 
                            onDismiss={() => setSavedResumeDialogVisible(false)} 
                            contentContainerStyle={{ 
                                maxHeight: '80%',
                                backgroundColor: theme.dark ? '#1E1830' : '#fff',
                                borderRadius: 16,
                                borderWidth: 1, 
                                borderColor: theme.dark ? "rgba(124,58,237,0.5)" : "rgba(124,58,237,0.2)",
                                shadowColor: "#7C3AED", 
                                shadowOpacity: 0.25, 
                                shadowRadius: 12, 
                                elevation: 8,
                                marginHorizontal: 20,
                                minHeight: 350
                            }}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 }}>
                                <Text variant="titleLarge" style={{ color: theme.dark ? '#F5F3FF' : undefined, fontWeight: '600' }}>Saved Resumes</Text>
                                <IconButton 
                                    icon="close" 
                                    size={24} 
                                    iconColor={theme.dark ? "#9CA3AF" : theme.colors.outline}
                                    onPress={() => setSavedResumeDialogVisible(false)} 
                                    style={{ margin: 0 }}
                                />
                            </View>
                            <View style={{ paddingHorizontal: 24, paddingBottom: 24, flex: 1 }}>
                                {isLoadingSavedResumes ? (
                                    <ActivityIndicator size="large" style={{ marginVertical: 20 }} />
                                ) : savedResumes.length === 0 ? (
                                    <Text style={{ textAlign: 'center', marginVertical: 20, color: theme.colors.outline }}>You haven't created any resumes yet.</Text>
                                ) : (
                                    <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
                                        {savedResumes.map(resume => (
                                            <View key={resume.id} style={{ 
                                                flexDirection: 'row', 
                                                alignItems: 'center', 
                                                paddingVertical: 16, 
                                                borderBottomWidth: 1, 
                                                borderBottomColor: theme.dark ? 'rgba(255,255,255,0.1)' : '#eee' 
                                            }}>
                                                <View style={{ flex: 1, paddingRight: 8 }}>
                                                    <Text variant="titleMedium" style={{ fontWeight: '600', color: theme.dark ? "#F5F3FF" : undefined }}>
                                                        {resume.name}
                                                    </Text>
                                                    <Text variant="bodySmall" style={{ color: theme.dark ? "#9CA3AF" : theme.colors.outline, marginTop: 4 }}>
                                                        Updated {resume.updatedAt.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                    </Text>
                                                </View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Button
                                                        mode="contained"
                                                        compact
                                                        onPress={() => {
                                                            setParsedResumeData(resume.parsedData);
                                                            setCvUris([{ name: resume.name, uri: 'app-generated', type: 'application/json' }]);
                                                            setSavedResumeDialogVisible(false);
                                                        }}
                                                        style={{ marginRight: 8, borderRadius: 50, backgroundColor: theme.dark ? '#A78BFA' : theme.colors.primary }}
                                                        labelStyle={{ fontSize: 13, fontWeight: '600', color: theme.dark ? "#1E1830" : undefined }}
                                                    >
                                                        Select
                                                    </Button>
                                                    <IconButton
                                                        icon="delete-outline"
                                                        size={20}
                                                        iconColor={theme.colors.error}
                                                        onPress={() => handleDeleteSavedResume(resume.id)}
                                                        style={{ margin: 0 }}
                                                    />
                                                </View>
                                            </View>
                                        ))}
                                    </ScrollView>
                                )}
                            </View>
                        </Modal>
                    </Portal>

                    <Text style={{ fontSize: 14, fontWeight: 'normal', marginBottom: 16, color: theme.colors.onSurface }}>
                        Get honest feedback on your job readiness and optimize your resume for ATS systems
                    </Text>

                    <View style={styles.section} onLayout={(e) => setJobInputLayout(e.nativeEvent.layout)}>
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
                            isGlowing={!jobUrl && !jobText}
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
                                                    "Delete Job Details",
                                                    "Are you sure you want to delete this job details ?",
                                                    [
                                                        { text: "No", style: "cancel" },
                                                        { text: "Yes", style: "destructive", onPress: handleClearJob }
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
                                            mode={Platform.OS === 'web' ? 'flat' : 'outlined'}
                                            value={jobTitle}
                                            onChangeText={setJobTitle}
                                            style={{ backgroundColor: theme.colors.surface }}
                                        />
                                        <TextInput
                                            label="company name"
                                            mode={Platform.OS === 'web' ? 'flat' : 'outlined'}
                                            value={jobCompany}
                                            onChangeText={setJobCompany}
                                            style={{ backgroundColor: theme.colors.surface }}
                                        />
                                        <TextInput
                                            label="Job Description"
                                            mode={Platform.OS === 'web' ? 'flat' : 'outlined'}
                                            value={jobText}
                                            onChangeText={setJobText}
                                            multiline
                                            scrollEnabled={false}
                                            style={{ backgroundColor: theme.colors.surface }}
                                        />
                                    </View>
                                ) : (
                                    <View>
                                        <List.Accordion
                                            title="Position name"
                                            description={jobTitle || "Not specified"}
                                            expanded={expandedSections.title}
                                            onPress={() => toggleSection('title')}
                                            left={(props: any) => <List.Icon {...props} icon="briefcase-outline" />}
                                            right={(props: any) => <List.Icon {...props} icon={expandedSections.title ? "chevron-up" : "chevron-down"} />}
                                            style={{ backgroundColor: theme.colors.elevation.level1, borderRadius: 8, marginBottom: 8 }}
                                        >
                                            <List.Item title={jobTitle || "No title extracted"} titleNumberOfLines={0} />
                                        </List.Accordion>

                                        <List.Accordion
                                            title="Company name"
                                            description={jobCompany || "Not specified"}
                                            expanded={expandedSections.company}
                                            onPress={() => toggleSection('company')}
                                            left={(props: any) => <List.Icon {...props} icon="office-building-marker-outline" />}
                                            right={(props: any) => <List.Icon {...props} icon={expandedSections.company ? "chevron-up" : "chevron-down"} />}
                                            style={{ backgroundColor: theme.colors.elevation.level1, borderRadius: 8, marginBottom: 8 }}
                                        >
                                            <List.Item title={jobCompany || "No company extracted"} titleNumberOfLines={0} />
                                        </List.Accordion>

                                        <List.Accordion
                                            title="Job Description"
                                            expanded={expandedSections.description}
                                            onPress={() => toggleSection('description')}
                                            left={(props: any) => <List.Icon {...props} icon="text-box-outline" />}
                                            right={(props: any) => <List.Icon {...props} icon={expandedSections.description ? "chevron-up" : "chevron-down"} />}
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

                    <View 
                        style={styles.section} 
                        onLayout={(e) => { setResumeSectionY(e.nativeEvent.layout.y); }}
                    >
                        <Text variant="titleMedium" style={styles.sectionTitle}>
                            2. Your Resume
                        </Text>
                        <CVUploader
                            key={uploadKey}
                            onFileSelected={(files) => {
                                setCvUris(files);
                                setParsedResumeData(null); // Reset on new file
                                setGlowResume(false); // Turn off glow when file selected
                                setResumeText(''); // Clear if previously manually injected
                            }}
                            isTextModeActive={resumeText.length > 0 && cvUris.length === 0}
                            disabled={isParsingResume}
                            isGlowing={glowResume && cvUris.length === 0}
                            onCreateNew={() => router.push('/resume-builder')}
                            onLoadSaved={loadSavedResumes}
                            isLoadingSaved={isLoadingSavedResumes}
                            onLayoutUpdate={(key, layout) => {
                                setResumeLayoutMap(prev => ({
                                    ...prev,
                                    [key]: {
                                        ...layout // CVUploader now provides perfectly aligned root-relative layout
                                    }
                                }));
                            }}
                        />

                        {/* Parse Preview Button — Highlighted CTA */}
                        {(cvUris.length > 0 || resumeText.length > 100 || parsedResumeData) && (
                            <View style={{ marginTop: 16, alignItems: 'center' }}>
                                {!parsedResumeData && (
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: '#F3E5F5',
                                        paddingHorizontal: 16,
                                        paddingVertical: 10,
                                        borderRadius: 12,
                                        marginBottom: 12,
                                        gap: 8,
                                        borderWidth: 1,
                                        borderColor: '#9C27B0',
                                    }}>
                                        <Text style={{ fontSize: 18 }}>👇</Text>
                                        <Text variant="bodySmall" style={{ color: '#6A1B9A', flex: 1, fontWeight: '600' }}>
                                            Please verify your parsed resume data before proceeding to analysis
                                        </Text>
                                    </View>
                                )}
                                <Button
                                    mode={parsedResumeData ? "outlined" : "contained"}
                                    icon={parsedResumeData ? "check-circle" : "eye-check"}
                                    onPress={() => {
                                        if (parsedResumeData) {
                                            setIsViewerVisible(true);
                                        } else {
                                            handleExtractAndShow();
                                        }
                                    }}
                                    loading={isParsingResume}
                                    disabled={isParsingResume || (!cvUris.length && !resumeText)}
                                    style={{ elevation: parsedResumeData ? 0 : 3, width: '100%', opacity: parsedResumeData ? 0.6 : 1 }}
                                    contentStyle={{ paddingVertical: 6 }}
                                >
                                    {parsedResumeData ? 'Click to see the verified data' : 'Verify Parsed Data'}
                                </Button>
                                <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 6 }}>
                                    Check what our AI sees before analyzing
                                </Text>
                            </View>
                        )}

                        {isParsingResume && (
                            <View style={{ marginTop: 16, width: '100%', paddingHorizontal: horizontalScale(8) }}>
                                <ProgressBar
                                    progress={parsingProgress / 100}
                                    color={theme.colors.primary}
                                    style={{ height: 6, borderRadius: 3 }}
                                />
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                                    <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                                        {parsingProgress >= 99 ? 'Finalizing...' : 'Verifying structured data...'}
                                    </Text>
                                    <Text variant="labelSmall" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                                        {parsingProgress}%
                                    </Text>
                                </View>
                                {parsingProgress >= 99 && (
                                    <Text
                                        variant="bodySmall"
                                        style={{
                                            color: theme.colors.primary,
                                            textAlign: 'center',
                                            marginTop: 12,
                                            fontWeight: '600',
                                            backgroundColor: theme.colors.primaryContainer,
                                            padding: 8,
                                            borderRadius: 8
                                        }}
                                    >
                                        Verification is taking a bit longer, thank you for being patient
                                    </Text>
                                )}
                            </View>
                        )}

                        {extractingResume && !isParsingResume && (
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
                                        disabled={isParsingResume}
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


                    <View>
                        {(() => {
                            return (
                                <RNAnimated.View style={{ borderRadius: 100, borderWidth: 2, borderColor: analyzeBtnGlowColor, padding: isReadyToAnalyze ? 2 : 0, shadowColor: isReadyToAnalyze ? theme.colors.primary : 'transparent', shadowOpacity: analyzeBtnGlowAnim, shadowRadius: 12, backgroundColor: isReadyToAnalyze ? 'rgba(156,39,176,0.1)' : 'transparent', marginBottom: isAndroid ? 4 : 4 }}>
                                    <Button
                                        mode="contained"
                                        onPress={() => handleAnalyze()}
                                        disabled={loading || !!currentTaskId || extractingResume || isParsingResume || !isJobPopulated || !isResumePopulated || !isResumeFullyParsed}
                                        style={[styles.button, { paddingVertical: moderateScale(isAndroid ? 2 : 4), marginVertical: 0, marginBottom: 0, marginTop: 0 }]}
                                        compact={isAndroid}
                                    >
                                        {!!currentTaskId ? 'Analyzing...' : isParsingResume ? 'Verifying...' : loading ? 'Checking...' : 'Analyze Resume'}
                                    </Button>
                                </RNAnimated.View>
                            );
                        })()}
                        <Text variant="labelSmall" style={{ textAlign: 'center', color: theme.colors.outline, marginTop: 8, marginBottom: 24 }}>
                            Each resume analysis costs 8 tokens
                        </Text>
                        {(() => {
                            const message = getValidationMessage();
                            if (message) {
                                return (
                                    <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
                                        <Text variant="bodySmall" style={{ color: theme.colors.error, textAlign: 'center' }}>
                                            {message}
                                        </Text>
                                    </View>
                                );
                            }
                            return null;
                        })()}
                    </View>

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

            {/* Job URL FTUE Overlay */}
            {showJobTutorialOverlay && jobInputLayout.height > 0 && (
                <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.dark ? "rgba(8,6,18,0.85)" : "rgba(255,255,255,0.85)", zIndex: 100, opacity: overlayOpacity }]} pointerEvents="auto">
                    {/* SVG Arrow - Scaled and Positioned below the field */}
                    <View style={{ position: 'absolute', top: jobInputLayout.y + 110, left: jobInputLayout.x + (jobInputLayout.width / 2), transform: [{ scaleX: -1 }, { scaleY: -1 }] }}>
                        <SVGArrow />
                    </View>

                    {/* Popover */}
                    <View style={{ position: 'absolute', top: jobInputLayout.y + 220, left: 20, right: 20, backgroundColor: theme.dark ? '#1E1830' : '#fff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: "rgba(124,58,237,0.5)", shadowColor: "#7C3AED", shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 }}>
                        <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: "rgba(124,58,237,0.2)", borderRadius: 50, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#A78BFA", marginRight: 8 }} />
                            <Text style={{ color: "#A78BFA", fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>REQUIRED</Text>
                        </View>
                        <Text style={{ color: theme.dark ? "#F5F3FF" : "#111", fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Add a Job URL first</Text>
                        <Text style={{ color: theme.dark ? "#9CA3AF" : "#555", fontSize: 14, lineHeight: 20, marginBottom: 20 }}>Please share or paste a job URL to proceed. We will extract all missing skills required for this exact role and perfectly tailor your resume analysis.</Text>
                        
                        <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'flex-start' }}>
                            <TouchableOpacity style={{ backgroundColor: "#7C3AED", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 50 }} onPress={() => { setShowJobTutorialOverlay(false); useTutorialStore.getState().markSeen('hasSeenJobUrlTutorial'); }}>
                                <Text style={{ color: "white", fontSize: 14, fontWeight: '600' }}>OK, got it →</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{ paddingVertical: 12, paddingHorizontal: 16 }} onPress={() => { useTutorialStore.getState().skipAllTutorials(); setShowJobTutorialOverlay(false); }}>
                                <Text style={{ color: theme.dark ? "#9CA3AF" : "#555", fontSize: 14, fontWeight: '600' }}>Skip Training</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </RNAnimated.View>
            )}

            {/* Resume Upload Sequential FTUE Overlay */}
            {!useTutorialStore.getState().isSkipped && resumeStep > 0 && resumeUploadSequence[resumeStep - 1] && resumeLayoutMap[resumeUploadSequence[resumeStep - 1].key] && (
                <SequenceOverlay
                    targetLayout={{
                        ...resumeLayoutMap[resumeUploadSequence[resumeStep - 1].key],
                        y: resumeLayoutMap[resumeUploadSequence[resumeStep - 1].key].y + resumeSectionY + 36
                    }}
                    title={resumeUploadSequence[resumeStep - 1].title}
                    description={resumeUploadSequence[resumeStep - 1].desc}
                    stepIndex={resumeStep - 1}
                    totalSteps={resumeUploadSequence.length}
                    yOffset={headerHeight - scrollY}
                    onNext={() => {
                        if (resumeStep === resumeUploadSequence.length) {
                            setResumeStep(0);
                            useTutorialStore.getState().markSeen('hasSeenResumeUploadTutorial');
                        } else {
                            setResumeStep(prev => prev + 1);
                        }
                    }}
                    onBack={() => setResumeStep(prev => prev - 1)}
                    onSkip={() => {
                        useTutorialStore.getState().skipAllTutorials();
                        setResumeStep(0);
                    }}
                    arrowDirection="down"
                />
            )}

            <ParsedResumeViewer
                visible={isViewerVisible}
                onClose={() => setIsViewerVisible(false)}
                parsedData={parsedResumeData}
                rawText={parsedResumeData?.text}
            />
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
        fontSize: Platform.OS === 'web' ? 16 : scaleFont(16),
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
