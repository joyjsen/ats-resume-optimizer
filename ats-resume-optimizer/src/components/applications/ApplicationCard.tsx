import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Card, Text, Chip, Button, IconButton, Menu, Divider, useTheme, ProgressBar, Portal, Dialog, TextInput } from 'react-native-paper';
import { Application, ApplicationStage, TimelineEvent } from '../../types/application.types';
import { format } from 'date-fns';

interface Props {
    application: Application;
    onStatusUpdate: (id: string, stage: ApplicationStage, note?: string, customName?: string, date?: Date) => void;
    onGenerateCoverLetter: (id: string) => void;
    onGeneratePrep: (id: string) => void;
    onDownloadResume: (id: string) => void;
    onRegeneratePrep: (id: string) => void;
    onCancelPrep: (id: string) => void;
    isResumeUpdated?: boolean; // Prop to trigger re-generate activation
}

export const ApplicationCard = ({
    application,
    onStatusUpdate,
    onGenerateCoverLetter,
    onGeneratePrep,
    onDownloadResume,
    onRegeneratePrep,
    onCancelPrep,
    isResumeUpdated = false
}: Props) => {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);
    const [statusMenuVisible, setStatusMenuVisible] = useState(false);
    const [statusDialogVisible, setStatusDialogVisible] = useState(false);
    const [selectedPendingStage, setSelectedPendingStage] = useState<ApplicationStage | null>(null);
    const [customStageName, setCustomStageName] = useState('');
    const [statusNote, setStatusNote] = useState('');

    const getStatusColor = (stage: ApplicationStage) => {
        switch (stage) {
            case 'offer': return '#4CAF50'; // Green
            case 'rejected': return '#F44336'; // Red
            case 'withdrawn': return '#9E9E9E'; // Grey
            case 'submitted': return '#2196F3'; // Blue
            case 'final_round': return '#FF9800'; // Orange
            case 'not_applied': return '#757575'; // Grey
            default: return '#6200EE'; // Primary Purple (Safe Hex)
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return '#4CAF50';
        if (score >= 60) return '#FF9800';
        return '#F44336';
    };

    const renderStatusOption = (stage: ApplicationStage, label: string) => (
        <Menu.Item
            key={stage}
            onPress={() => {
                setStatusMenuVisible(false);
                setSelectedPendingStage(stage);
                setStatusDialogVisible(true);
            }}
            title={label}
            leadingIcon={application.currentStage === stage ? 'check' : undefined}
        />
    );

    const handleConfirmStatus = () => {
        if (selectedPendingStage) {
            onStatusUpdate(application.id, selectedPendingStage, statusNote, customStageName);
            setStatusDialogVisible(false);
            setCustomStageName('');
            setStatusNote('');
        }
    };

    return (
        <Card style={[styles.card, { borderLeftColor: getStatusColor(application.currentStage), borderLeftWidth: 4 }]}>
            <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
                <Card.Content>
                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <Text variant="titleMedium" numberOfLines={1} style={{ fontWeight: 'bold' }}>
                                {application.jobTitle}
                            </Text>
                            <Text variant="bodyMedium" style={{ color: theme.colors.secondary }}>
                                {application.company}
                            </Text>
                        </View>
                        <View style={styles.badges}>
                            <Chip
                                style={{ backgroundColor: getScoreColor(application.atsScore) + '20', height: 28 }}
                                textStyle={{ fontSize: 11, color: getScoreColor(application.atsScore), fontWeight: 'bold' }}
                            >
                                {application.atsScore}%
                            </Chip>
                        </View>
                    </View>

                    <View style={styles.statusRow}>
                        <Menu
                            visible={statusMenuVisible}
                            onDismiss={() => setStatusMenuVisible(false)}
                            anchor={
                                <Chip
                                    icon="chevron-down"
                                    onPress={() => setStatusMenuVisible(true)}
                                    style={{ backgroundColor: getStatusColor(application.currentStage) + '15', marginTop: 8 }}
                                >
                                    {application.customStageName || application.currentStage.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </Chip>
                            }
                        >
                            {renderStatusOption("not_applied", "Not Yet Applied")}
                            {renderStatusOption("submitted", "Application Submitted")}
                            {renderStatusOption("phone_screen", "Phone Screen")}
                            {renderStatusOption("technical", "Technical Interview")}
                            {renderStatusOption("final_round", "Final Round")}
                            <Divider />
                            {renderStatusOption("offer", "Offer Received")}
                            {renderStatusOption("rejected", "Rejected")}
                            {renderStatusOption("withdrawn", "Withdrawn")}
                            {renderStatusOption("other", "Other / Custom")}
                        </Menu>

                        <Text variant="labelSmall" style={{ color: '#888', marginTop: 14, marginLeft: 'auto' }}>
                            {format(application.lastStatusUpdate, 'MMM d')}
                        </Text>
                    </View>
                </Card.Content>
            </TouchableOpacity >

            {expanded && (
                <View>
                    <Divider />
                    <Card.Actions style={styles.actions}>
                        <View style={styles.actionGrid}>
                            <Button
                                mode="outlined"
                                icon="file-download-outline"
                                onPress={() => onDownloadResume(application.id)}
                                style={styles.actionBtn}
                                labelStyle={{ fontSize: 12 }}
                            >
                                Resume
                            </Button>
                            <Button
                                mode="outlined"
                                icon="text-box-outline"
                                onPress={() => onGenerateCoverLetter(application.id)}
                                style={styles.actionBtn}
                                labelStyle={{ fontSize: 12 }}
                                textColor={application.coverLetter ? theme.colors.primary : undefined}
                            >
                                {application.coverLetter ? 'View Letter' : 'Cover Letter'}
                            </Button>
                            <Button
                                mode={application.prepGuide?.status === 'completed' ? "contained-tonal" : "outlined"}
                                icon={application.prepGuide?.status === 'completed' ? "book-open-variant" : "school-outline"}
                                onPress={() => onGeneratePrep(application.id)}
                                style={styles.actionBtn}
                                labelStyle={{ fontSize: 12 }}
                                loading={application.prepGuide?.status === 'generating'}
                                disabled={application.prepGuide?.status === 'generating'}
                            >
                                {application.prepGuide?.status === 'completed' ? 'View Guide' : 'Prep Guide'}
                            </Button>
                            <Button
                                mode="text"
                                icon="refresh"
                                onPress={() => onRegeneratePrep(application.id)}
                                style={styles.actionBtn}
                                labelStyle={{ fontSize: 11 }}
                                disabled={application.prepGuide?.status !== 'completed' || !isResumeUpdated || application.prepGuide.status === 'generating'} // Only enabled if guide exists AND is completed AND resume updated
                                textColor={isResumeUpdated && application.prepGuide?.status === 'completed' ? theme.colors.primary : theme.colors.outline}
                            >
                                Re-Generate Prep Guide
                            </Button>
                        </View>

                        {/* Prep Status Text Removed - Moved to Timeline */}
                    </Card.Actions >

                    {/* Timeline Preview */}
                    <View style={styles.timeline}>


                        {/* 1. Prep Guide Status Item (Injected at top if recent) */}
                        {/* 1. Prep Guide History (Loop through all attempts) */}
                        {application.prepGuideHistory && application.prepGuideHistory.map((guideRun, index) => (
                            <View key={`guide-run-${index}`} style={styles.timelineItem}>
                                <View style={[styles.dot, { backgroundColor: guideRun.status === 'generating' ? theme.colors.primary : theme.colors.secondary, marginTop: 4 }]} />
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text variant="bodySmall" style={{ fontWeight: 'bold', color: guideRun.status === 'generating' ? theme.colors.primary : guideRun.status === 'failed' ? theme.colors.error : undefined }}>
                                                {guideRun.status === 'generating'
                                                    ? (index > 0 ? "Prep Guide re-generation started" : "Prep Guide generation started")
                                                    : guideRun.status === 'failed'
                                                        ? (index > 0 ? "Prep Guide re-generation cancelled" : "Prep Guide generation cancelled")
                                                        : (index > 0 ? "Prep Guide Re-generation completed" : "Prep Guide generation completed")}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text variant="labelSmall" style={{ color: '#888' }}>
                                                {guideRun.generatedAt || guideRun.startedAt
                                                    ? format(new Date(guideRun.generatedAt || guideRun.startedAt), 'MMM d, yyyy')
                                                    : 'Just now'}
                                            </Text>

                                            {/* Only show cancel for the LATEST run if it is generating */}
                                            {guideRun.status === 'generating' && index === (application.prepGuideHistory?.length || 0) - 1 && (
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        Alert.alert(
                                                            "Cancel Generation",
                                                            "This action will cancel the prep guide generation, are you sure you want to continue to cancel the running task?",
                                                            [
                                                                { text: "No", style: "cancel" },
                                                                { text: "Yes, Cancel", style: 'destructive', onPress: () => onCancelPrep(application.id) }
                                                            ]
                                                        );
                                                    }}
                                                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
                                                >
                                                    <Text variant="labelSmall" style={{ color: theme.colors.error, marginRight: 2 }}>Cancel</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                    <Text variant="labelSmall" style={{ color: '#666', fontStyle: 'italic' }}>
                                        {guideRun.status === 'generating' ? 'AI is analyzing role & resume...' :
                                            guideRun.status === 'failed' ? 'Prep guide is not available yet' :
                                                'Ready to view'}
                                    </Text>
                                </View>
                            </View>
                        ))}

                        {/* Fallback for legacy data (if no history yet but has prepGuide) */}
                        {!application.prepGuideHistory && application.prepGuide && (
                            <View style={styles.timelineItem}>
                                <View style={[styles.dot, { backgroundColor: application.prepGuide.status === 'generating' ? theme.colors.primary : theme.colors.secondary, marginTop: 4 }]} />
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text variant="bodySmall" style={{ fontWeight: 'bold', color: application.prepGuide.status === 'generating' ? theme.colors.primary : application.prepGuide.status === 'failed' ? theme.colors.error : undefined }}>
                                                {application.prepGuide.status === 'generating' ? "Prep Guide is being generated" :
                                                    application.prepGuide.status === 'failed' ? "Generation Failed/Cancelled" :
                                                        "Prep Guide generation completed"}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text variant="labelSmall" style={{ color: '#888' }}>
                                                {application.prepGuide.generatedAt || application.prepGuide.startedAt
                                                    ? format(new Date(application.prepGuide.generatedAt || application.prepGuide.startedAt), 'MMM d, yyyy')
                                                    : 'Just now'}
                                            </Text>
                                            {application.prepGuide.status === 'generating' && (
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        Alert.alert(
                                                            "Cancel Generation",
                                                            "This action will cancel the prep guide generation, are you sure you want to continue to cancel the running task?",
                                                            [
                                                                { text: "No", style: "cancel" },
                                                                { text: "Yes, Cancel", style: 'destructive', onPress: () => onCancelPrep(application.id) }
                                                            ]
                                                        );
                                                    }}
                                                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
                                                >
                                                    <Text variant="labelSmall" style={{ color: theme.colors.error, marginRight: 2 }}>Cancel</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                    <Text variant="labelSmall" style={{ color: '#666', fontStyle: 'italic' }}>
                                        {application.prepGuide.status === 'generating' ? 'AI is analyzing role & resume...' :
                                            application.prepGuide.status === 'failed' ? 'Prep guide is not available yet' :
                                                'Ready to view'}
                                    </Text>
                                </View>
                            </View>
                        )}

                        <Text variant="titleSmall" style={{ marginBottom: 8, paddingHorizontal: 16 }}>Timeline</Text>

                        {application.timeline.map((event, index) => (
                            <View key={index} style={styles.timelineItem}>
                                <View style={[styles.dot, { backgroundColor: index === application.timeline.length - 1 ? theme.colors.primary : '#ddd' }]} />
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text variant="bodySmall" style={{ fontWeight: 'bold' }}>
                                            {event.customStageName || event.stage.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                        </Text>
                                        <Text variant="labelSmall" style={{ color: '#888' }}>
                                            {format(event.date, 'MMM d, yyyy')}
                                        </Text>
                                    </View>
                                    {event.note && (
                                        <Text variant="labelSmall" style={{ color: '#666', fontStyle: 'italic' }}>
                                            {event.note}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        ))
                        }
                    </View >
                </View >
            )}

            <Portal>
                <Dialog visible={statusDialogVisible} onDismiss={() => setStatusDialogVisible(false)}>
                    <Dialog.Title>Update Status</Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                            Update status to: <Text style={{ fontWeight: 'bold' }}>{selectedPendingStage?.replace('_', ' ').toUpperCase()}</Text>
                        </Text>

                        {selectedPendingStage === 'other' && (
                            <TextInput
                                label="Custom Stage Name"
                                value={customStageName}
                                onChangeText={setCustomStageName}
                                mode="outlined"
                                style={{ marginBottom: 12 }}
                            />
                        )}

                        <TextInput
                            label="Add a note (optional)"
                            value={statusNote}
                            onChangeText={setStatusNote}
                            mode="outlined"
                            placeholder="e.g. Spoke with HR, next steps..."
                            multiline
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setStatusDialogVisible(false)}>Cancel</Button>
                        <Button onPress={handleConfirmStatus} mode="contained">Update</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </Card >
    );
};

const styles = StyleSheet.create({
    card: {
        marginBottom: 12,
        marginHorizontal: 16,
        elevation: 2
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    badges: {
        alignItems: 'flex-end',
        marginLeft: 8
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actions: {
        paddingHorizontal: 8,
        paddingBottom: 8
    },
    actionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        width: '100%'
    },
    actionBtn: {
        width: '48%',
        marginVertical: 4
    },
    timeline: {
        padding: 16,
        backgroundColor: '#f9f9f9',
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 12,
        alignItems: 'flex-start'
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 6,
        marginRight: 12
    }
});
