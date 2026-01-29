import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Linking, ScrollView } from 'react-native';
import { Text, Card, ActivityIndicator, useTheme, Button, Chip, IconButton, Portal, Dialog, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useProfileStore } from '../src/store/profileStore';
import { applicationService } from '../src/services/firebase/applicationService';
import { historyService } from '../src/services/firebase/historyService';
import { learningService } from '../src/services/firebase/learningService';
import { prepGuidePdfGenerator } from '../src/services/pdf/pdfGenerator';
import { DocxGenerator } from '../src/services/docx/docxGenerator';
import { SavedAnalysis } from '../src/types/history.types';
import { Application } from '../src/types/application.types';
import { LearningEntry } from '../src/types/learning.types';
import { format } from 'date-fns';

type FilterType =
    | 'resumes_analyzed'
    | 'optimized_resumes'
    | 'reoptimized_resumes'
    | 'prep_guides'
    | 'skills_learned'
    | 'cover_letters';

export default function HistoryDetailsScreen() {
    const { filter } = useLocalSearchParams<{ filter: FilterType }>();
    const router = useRouter();
    const theme = useTheme();
    const { userProfile } = useProfileStore();

    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<any[]>([]);

    // View State
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [viewType, setViewType] = useState<'prep' | 'cover_letter' | 'skill' | null>(null);

    useEffect(() => {
        if (!userProfile) return;
        loadData();
    }, [filter, userProfile]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (!userProfile) return;

            if (filter === 'resumes_analyzed' || filter === 'optimized_resumes' || filter === 'reoptimized_resumes') {
                const unsubscribe = historyService.subscribeToUserHistory((analyses: SavedAnalysis[]) => {
                    let filtered = analyses;
                    if (filter === 'optimized_resumes' || filter === 'reoptimized_resumes') {
                        filtered = analyses.filter(a => a.analysisStatus === 'optimized' || a.optimizedResumeData);
                    }
                    setItems(filtered);
                    setLoading(false);
                });
                return () => unsubscribe();

            } else if (filter === 'prep_guides') {
                const unsubscribe = applicationService.subscribeToApplications((apps) => {
                    const withGuides = apps.filter(app => app.prepGuide || (app.prepGuideHistory && app.prepGuideHistory.length > 0));
                    setItems(withGuides);
                    setLoading(false);
                });
                return () => unsubscribe();

            } else if (filter === 'skills_learned') {
                const unsubscribe = learningService.subscribeToEntries(userProfile.uid, (entries) => {
                    setItems(entries);
                    setLoading(false);
                });
                return () => unsubscribe();

            } else if (filter === 'cover_letters') {
                const unsubscribe = applicationService.subscribeToApplications((apps) => {
                    const withCL = apps.filter(app => app.coverLetter);
                    setItems(withCL);
                    setLoading(false);
                });
                return () => unsubscribe();
            }

        } catch (error) {
            console.error("Error loading history details:", error);
            setLoading(false);
        }
    };

    const handleItemPress = (item: any) => {
        if (filter?.includes('resumes')) {
            router.push({ pathname: '/analysis-result', params: { id: item.id } } as any);
        } else if (filter === 'prep_guides') {
            setSelectedItem(item);
            setViewType('prep');
            setDialogVisible(true);
        } else if (filter === 'cover_letters') {
            setSelectedItem(item);
            setViewType('cover_letter');
            setDialogVisible(true);
        } else if (filter === 'skills_learned') {
            setSelectedItem(item);
            setViewType('skill');
            setDialogVisible(true);
        }
    };

    const getTitle = () => {
        switch (filter) {
            case 'resumes_analyzed': return 'Resume Analyses';
            case 'optimized_resumes': return 'Optimized Resumes';
            case 'reoptimized_resumes': return 'Re-Optimized Resumes';
            case 'prep_guides': return 'Interview Prep Guides';
            case 'skills_learned': return 'Skills Learned';
            case 'cover_letters': return 'Cover Letters';
            default: return 'History';
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        if (filter?.includes('resumes')) {
            const analysis = item as SavedAnalysis;
            return (
                <Card style={styles.card}>
                    <Card.Title
                        title={analysis.jobTitle || "Resume Analysis"}
                        subtitle={analysis.company || format(new Date(analysis.createdAt), 'MMM d, yyyy')}
                        left={(props) => <MaterialCommunityIcons {...props} name="file-document-outline" size={40} color={theme.colors.primary} />}
                        right={(props) => (
                            <View style={[styles.scoreContainer, { backgroundColor: theme.colors.secondaryContainer }]}>
                                <Text style={[styles.scoreText, { color: theme.colors.onSecondaryContainer }]}>{Math.round(analysis.atsScore)}</Text>
                            </View>
                        )}
                    />
                    <Card.Content>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Analyzed on {format(new Date(analysis.createdAt), 'PP p')}
                        </Text>
                        {analysis.optimizedResumeData && (
                            <Chip
                                icon="check"
                                style={styles.chip}
                                textStyle={{ fontSize: 10 }}
                                compact
                                mode="outlined"
                            >
                                Optimized
                            </Chip>
                        )}
                    </Card.Content>
                </Card>
            );
        }

        if (filter === 'prep_guides') {
            const app = item as Application;
            return (
                <Card style={styles.card}>
                    <Card.Title
                        title={app.jobTitle}
                        subtitle={app.company}
                        left={(props) => <MaterialCommunityIcons {...props} name="briefcase-check" size={40} color={theme.colors.secondary} />}
                    />
                    <Card.Content>
                        <View style={styles.row}>
                            <Text variant="bodySmall">
                                Generated: {app.prepGuide?.generatedAt ? format(new Date(app.prepGuide.generatedAt), 'PP') : 'In Progress'}
                            </Text>
                            <Chip style={{ height: 24, alignItems: 'center', marginLeft: 8 }} textStyle={{ fontSize: 10, lineHeight: 12 }}>
                                {app.prepGuide?.status || 'Active'}
                            </Chip>
                        </View>
                    </Card.Content>
                </Card>
            );
        }

        if (filter === 'skills_learned') {
            const skill = item as LearningEntry;
            return (
                <Card style={styles.card} onPress={() => handleItemPress(item)}>
                    <Card.Title
                        title={skill.skillName}
                        subtitle={`${skill.companyName} • ${skill.jobTitle}`}
                        left={(props) => <MaterialCommunityIcons {...props} name="school" size={40} color={theme.colors.tertiary} />}
                    />
                    <Card.Content>
                        <View style={styles.row}>
                            <Text variant="bodySmall">Slides: {skill.totalSlides}</Text>
                            <Text variant="bodySmall"> • </Text>
                            <Text variant="bodySmall">
                                Progress: {skill.status === 'completed' ? '100%' : `${Math.round(((skill.currentSlide || 0) / (skill.totalSlides || 1)) * 100)}%`}
                            </Text>
                        </View>
                    </Card.Content>
                </Card>
            );
        }

        if (filter === 'cover_letters') {
            const app = item as Application;
            return (
                <Card style={styles.card} onPress={() => handleItemPress(item)}>
                    <Card.Title
                        title={app.jobTitle}
                        subtitle={app.company}
                        left={(props) => <MaterialCommunityIcons {...props} name="email-outline" size={40} color={theme.colors.error} />}
                    />
                    <Card.Content>
                        <Text variant="bodySmall">
                            Generated: {app.coverLetter?.generatedAt ? format(new Date(app.coverLetter.generatedAt), 'PP') : 'Unknown'}
                        </Text>
                    </Card.Content>
                </Card>
            );
        }

        return null;
    };

    const handleDownloadPrep = async () => {
        if (!selectedItem || viewType !== 'prep') return;
        const app = selectedItem as Application;
        try {
            if (app.prepGuide?.sections) {
                await prepGuidePdfGenerator.generateAndShare(app.prepGuide.sections as any, {
                    companyName: app.company,
                    jobTitle: app.jobTitle
                });
            } else if (app.prepGuide?.downloadUrl) {
                // Implement share/download if URL exists
                // await Sharing.shareAsync(app.prepGuide.downloadUrl);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDownloadCoverLetter = async () => {
        if (!selectedItem || viewType !== 'cover_letter') return;
        const app = selectedItem as Application;
        if (app.coverLetter?.content) {
            await DocxGenerator.generateCoverLetter(app.coverLetter.content);
        }
    };

    const renderDialogContent = () => {
        if (!selectedItem) return null;

        if (viewType === 'prep') {
            const app = selectedItem as Application;
            return (
                <View>
                    <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{app.company} - {app.jobTitle}</Text>
                    <Text variant="bodyMedium" style={{ marginVertical: 8 }}>
                        Generated on: {app.prepGuide?.generatedAt ? format(new Date(app.prepGuide.generatedAt), 'PP p') : 'Unknown'}
                    </Text>
                    <Divider style={{ marginVertical: 8 }} />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        <Chip icon="check" style={{ margin: 4 }} textStyle={{ fontSize: 11 }}>Company Intel</Chip>
                        <Chip icon="check" style={{ margin: 4 }} textStyle={{ fontSize: 11 }}>Role Deep Dive</Chip>
                        <Chip icon="check" style={{ margin: 4 }} textStyle={{ fontSize: 11 }}>Tech Prep</Chip>
                        <Chip icon="check" style={{ margin: 4 }} textStyle={{ fontSize: 11 }}>Strategies</Chip>
                    </View>
                    <Button style={{ marginVertical: 8 }} mode="contained" icon="download" onPress={handleDownloadPrep}>Download PDF</Button>
                </View>
            );
        }

        if (viewType === 'cover_letter') {
            const app = selectedItem as Application;
            return (
                <View style={{ height: 300 }}>
                    <ScrollView>
                        <Text variant="bodyMedium">{app.coverLetter?.content}</Text>
                    </ScrollView>
                    <Button style={{ marginTop: 8 }} mode="contained" icon="download" onPress={handleDownloadCoverLetter}>Download DOCX</Button>
                </View>
            );
        }

        if (viewType === 'skill') {
            const skill = selectedItem as LearningEntry;
            return (
                <View>
                    <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{skill.skillName}</Text>
                    <Text variant="bodyMedium">Company: {skill.companyName}</Text>
                    <Text variant="bodyMedium">Role: {skill.jobTitle}</Text>
                    <Divider style={{ marginVertical: 8 }} />
                    <Text>Progress: {skill.status === 'completed' ? 'Completed' : `${skill.currentSlide}/${skill.totalSlides} slides`}</Text>
                    {/* Simple placeholder for viewing content */}
                    <Text style={{ marginTop: 12, fontStyle: 'italic', color: '#666' }}>
                        View full learning path in main activity feed.
                    </Text>
                </View>
            );
        }
        return null;
    };

    const navigation = useNavigation();

    useEffect(() => {
        navigation.setOptions({ title: getTitle(), headerBackTitle: '' });
    }, [filter]);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" />
                </View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => (item.id || item.activityId || Math.random().toString())}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="folder-open-outline" size={48} color={theme.colors.outline} />
                            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>No items found</Text>
                        </View>
                    }
                />
            )}

            <Portal>
                <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
                    <Dialog.Title>
                        {viewType === 'prep' ? 'Interview Guide' : viewType === 'cover_letter' ? 'Cover Letter' : 'Skill Details'}
                    </Dialog.Title>
                    <Dialog.Content>
                        {renderDialogContent()}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setDialogVisible(false)}>Close</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // backgroundColor: '#f5f5f5', -- Handled inline
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        // backgroundColor: '#fff', -- Handled inline
        elevation: 2,
    },
    headerTitle: {
        fontWeight: 'bold',
        marginLeft: 8,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
    },
    card: {
        marginBottom: 12,
        // backgroundColor: '#fff', -- Handled by Card default
    },
    scoreContainer: {
        // backgroundColor: '#E3F2FD', -- Handled inline
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scoreText: {
        // color: '#1976D2', -- Handled inline
        fontWeight: 'bold',
    },
    chip: {
        alignSelf: 'flex-start',
        marginTop: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 60,
    },
    emptyText: {
        // color: '#888', -- Handled inline
        marginTop: 16,
    }
});
