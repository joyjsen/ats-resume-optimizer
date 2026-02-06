import React, { useState, useEffect } from 'react';
import { ScrollView, TextInput as RNTextInput } from 'react-native';
import { Button, Dialog, Portal, Text, useTheme, TextInput } from 'react-native-paper';
import { Application } from '../../types/application.types';

interface CoverLetterDialogProps {
    visible: boolean;
    application: Application | null;
    onDismiss: () => void;
    onSave: (content: string) => Promise<void>;
    onRegenerate: () => void;
    onDownload: (content: string) => void;
}

export const CoverLetterDialog: React.FC<CoverLetterDialogProps> = ({
    visible,
    application,
    onDismiss,
    onSave,
    onRegenerate,
    onDownload
}) => {
    const theme = useTheme();
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState('');

    useEffect(() => {
        if (application?.coverLetter?.content) {
            setEditedContent(application.coverLetter.content);
        }
    }, [application]);

    const handleSave = async () => {
        await onSave(editedContent);
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditedContent(application?.coverLetter?.content || '');
    };

    const handleDismiss = () => {
        setIsEditing(false);
        onDismiss();
    };

    if (!application) return null;

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={handleDismiss} style={{ maxHeight: '90%' }}>
                <Dialog.Title>
                    {isEditing ? "Edit Cover Letter" : "Cover Letter"}
                </Dialog.Title>
                <Dialog.ScrollArea>
                    <ScrollView
                        contentContainerStyle={{ paddingVertical: 12 }}
                        keyboardDismissMode="on-drag"
                        keyboardShouldPersistTaps="handled"
                    >
                        {isEditing ? (
                            <TextInput
                                mode="outlined"
                                multiline
                                value={editedContent}
                                onChangeText={setEditedContent}
                                style={{ height: 400, backgroundColor: theme.colors.surface }}
                                autoFocus
                            />
                        ) : (
                            <Text variant="bodyMedium" style={{ lineHeight: 22 }}>
                                {application.coverLetter?.content}
                            </Text>
                        )}
                    </ScrollView>
                </Dialog.ScrollArea>
                <Dialog.Actions>
                    {isEditing ? (
                        <>
                            <Button onPress={handleCancelEdit}>Cancel</Button>
                            <Button mode="contained" onPress={handleSave}>Save</Button>
                        </>
                    ) : (
                        <>
                            <Button onPress={handleDismiss}>Close</Button>
                            <Button onPress={() => setIsEditing(true)}>Edit</Button>
                            <Button
                                onPress={onRegenerate}
                                textColor={theme.colors.error}
                            >
                                Regenerate
                            </Button>
                            <Button
                                mode="contained"
                                onPress={() => onDownload(editedContent)}
                                icon="download"
                            >
                                Download
                            </Button>
                        </>
                    )}
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};
