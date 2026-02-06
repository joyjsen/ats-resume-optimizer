import React from 'react';
import { View } from 'react-native';
import { Button, Dialog, Portal, Text, useTheme, Divider, Chip } from 'react-native-paper';
import { Application } from '../../types/application.types';

interface PrepGuideDialogsProps {
    confirmationVisible: boolean;
    viewDialogVisible: boolean;
    application: Application | null;
    onDismissConfirmation: () => void;
    onDismissView: () => void;
    onConfirmGenerate: () => void;
    onDownload: () => void;
}

export const PrepGuideDialogs: React.FC<PrepGuideDialogsProps> = ({
    confirmationVisible,
    viewDialogVisible,
    application,
    onDismissConfirmation,
    onDismissView,
    onConfirmGenerate,
    onDownload
}) => {
    const theme = useTheme();

    if (!application) return null;

    return (
        <Portal>
            {/* 1. Confirmation Dialog (Starts Generation) */}
            <Dialog visible={confirmationVisible} onDismiss={onDismissConfirmation}>
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
                    <Button onPress={onDismissConfirmation}>Cancel</Button>
                    <Button mode="contained" onPress={onConfirmGenerate}>Generate</Button>
                </Dialog.Actions>
            </Dialog>

            {/* 2. View Guide Dialog (Completed) */}
            <Dialog visible={viewDialogVisible} onDismiss={onDismissView}>
                <Dialog.Title>Interview Prep Guide</Dialog.Title>
                <Dialog.Content>
                    <View style={{ marginBottom: 20 }}>
                        <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                            {application.company} - {application.jobTitle}
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.secondary, marginBottom: 12 }}>
                            Generated {application.prepGuide?.startedAt ? new Date(application.prepGuide.startedAt).toLocaleDateString() : 'Just now'}
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
                        onPress={onDownload}
                        contentStyle={{ height: 48 }}
                    >
                        Download PDF Guide
                    </Button>
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={onDismissView}>Close</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};
