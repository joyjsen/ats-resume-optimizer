import React, { useState, useEffect } from 'react';
import { ScrollView, TextInput as RNTextInput, View, Alert } from 'react-native';
import { Button, Dialog, Portal, Text, useTheme, TextInput, IconButton } from 'react-native-paper';
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

    // Sanitize cover letter text: strip markdown formatting and placeholders
    const sanitize = (text: string): string => {
        if (!text) return '';
        return text
            .replace(/\*\*/g, '')           // Remove ** bold
            .replace(/(?<!\w)\*(?!\*)/g, '') // Remove lone * italic (not **)
            .replace(/^#+\s*/gm, '')         // Remove # headings
            .replace(/\[Your Name\]/gi, '')
            .replace(/\[Your Address\]/gi, '')
            .replace(/\[City,?\s*State,?\s*ZIP\s*(?:Code)?\]/gi, '')
            .replace(/\[Date\]/gi, '')
            .replace(/\[Company Address\]/gi, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    };

    useEffect(() => {
        if (application?.coverLetter?.content) {
            setEditedContent(sanitize(application.coverLetter.content));
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 8 }}>
                    <Dialog.Title style={{ flex: 1 }}>
                        {isEditing ? "Edit Cover Letter" : "Cover Letter"}
                    </Dialog.Title>
                    <IconButton
                        icon="close"
                        size={24}
                        onPress={handleDismiss}
                    />
                </View>
                <Dialog.ScrollArea>
                    <ScrollView
                        contentContainerStyle={{ paddingVertical: 12 }}
                        keyboardDismissMode="on-drag"
                        keyboardShouldPersistTaps="handled"
                    >
                        {isEditing ? (
                            <View>
                                <TextInput
                                    mode="outlined"
                                    multiline
                                    value={editedContent}
                                    onChangeText={setEditedContent}
                                    style={{ height: 400, backgroundColor: theme.colors.surface }}
                                    autoFocus
                                    returnKeyType="done"
                                    blurOnSubmit={true}
                                    placeholder="Type your cover letter here..."
                                />
                            </View>
                        ) : (
                            <Text variant="bodyMedium" style={{ lineHeight: 22 }}>
                                {sanitize(application.coverLetter?.content || '')}
                            </Text>
                        )}
                    </ScrollView>
                </Dialog.ScrollArea>
                <Dialog.Actions>
                    {isEditing ? (
                        [
                            <Button key="cancel" onPress={handleCancelEdit}>Cancel</Button>,
                            <Button key="save" mode="contained" onPress={handleSave}>Save</Button>
                        ]
                    ) : (
                        [
                            // Close button removed from here
                            <Button key="edit" onPress={() => setIsEditing(true)}>Edit</Button>,
                            <Button
                                key="regenerate"
                                onPress={onRegenerate}
                                textColor={theme.colors.error}
                            >
                                Regenerate
                            </Button>,
                            <Button
                                key="download"
                                mode="contained"
                                onPress={() => onDownload(editedContent)}
                                icon="download"
                            >
                                Download
                            </Button>
                        ]
                    )}
                </Dialog.Actions>
                {!isEditing && (
                    <Text variant="labelSmall" style={{ textAlign: 'center', marginBottom: 16, color: theme.colors.outline, paddingHorizontal: 16 }}>
                        Each cover letter Regeneration costs 30 tokens, while manual Edit is free of charge
                    </Text>
                )}
            </Dialog>
        </Portal>
    );
};
