import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Text, Card, IconButton, useTheme } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

interface Props {
    onFileSelected: (uris: string[]) => void;
    isTextModeActive?: boolean;
}

interface UploadedFile {
    uri: string;
    name: string;
    size?: number;
}

export const CVUploader = ({ onFileSelected, isTextModeActive }: Props) => {
    const theme = useTheme();
    const [files, setFiles] = useState<UploadedFile[]>([]);

    const getFileType = (name: string): 'document' | 'image' | 'unknown' => {
        const lower = name.toLowerCase();
        if (lower.endsWith('.docx') || lower.endsWith('.doc') || lower.endsWith('.txt')) return 'document';
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.heic')) return 'image';
        return 'unknown';
    };

    const pickDocument = async () => {
        // Validation 1: Check Text Conflict
        if (isTextModeActive) {
            Alert.alert("Format Conflict", "You are currently in Text Mode. Please clear the pasted text before uploading a document.");
            return;
        }

        // Validation 2: Check Image Conflict
        if (files.some(f => getFileType(f.name) === 'image')) {
            Alert.alert("Format Conflict", "You can only use one resume format at a time. Please remove the existing image(s) to upload a document.");
            return;
        }

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
                    'application/msword', // doc
                    'text/plain' // txt
                ],
                copyToCacheDirectory: true,
                multiple: true,
            });

            if (result.canceled) return;

            const newFiles = result.assets.map(a => ({
                uri: a.uri,
                name: a.name,
                size: a.size
            }));

            updateFiles([...files, ...newFiles]);
        } catch (err) {
            console.error('Error picking document:', err);
        }
    };

    const pickImages = async () => {
        // Validation 1: Check Text Conflict
        if (isTextModeActive) {
            Alert.alert("Format Conflict", "You are currently in Text Mode. Please clear the pasted text before uploading an image.");
            return;
        }

        // Validation 2: Check Document Conflict
        if (files.some(f => getFileType(f.name) === 'document')) {
            Alert.alert("Format Conflict", "You can only use one resume format at a time. Please remove the existing document to upload an image.");
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
                allowsMultipleSelection: true,
                selectionLimit: 5,
            });

            if (!result.canceled && result.assets) {
                const newFiles = result.assets.map(a => ({
                    uri: a.uri,
                    name: a.fileName || `Screenshot_${Date.now()}.jpg`,
                    size: a.fileSize
                }));

                updateFiles([...files, ...newFiles]);
            }
        } catch (err) {
            console.error('Error picking images:', err);
        }
    };

    const updateFiles = (newFileList: UploadedFile[]) => {
        setFiles(newFileList);
        onFileSelected(newFileList.map(f => f.uri));
    };

    const removeFile = (uri: string) => {
        const updated = files.filter(f => f.uri !== uri);
        updateFiles(updated);
    };

    return (
        <View style={styles.container}>
            <Card style={styles.uploadCard} mode="outlined">
                <Card.Content style={styles.content}>
                    <IconButton icon="cloud-upload" size={40} iconColor={theme.colors.primary} />
                    <Text variant="titleMedium">Upload Resume(s)</Text>
                    <Text variant="bodySmall" style={styles.supportText}>
                        Accepted: Word (DOCX), text files (TXT), or Images
                    </Text>

                    <View style={styles.buttonRow}>
                        <Button
                            mode="contained"
                            icon="image"
                            onPress={pickImages}
                            style={styles.button}
                        >
                            Gallery
                        </Button>
                        <Button
                            mode="outlined"
                            icon="file-document"
                            onPress={pickDocument}
                            style={styles.button}
                        >
                            Files
                        </Button>
                    </View>

                    {files.length > 0 && (
                        <Text variant="bodySmall" style={{ marginTop: 8 }}>
                            {files.length} file(s) selected
                        </Text>
                    )}
                </Card.Content>
            </Card>

            {files.map((f, index) => (
                <Card key={index} mode="outlined" style={{ marginTop: 8 }}>
                    <Card.Title
                        title={f.name}
                        subtitle={`${(f.size ? f.size / 1024 : 0).toFixed(1)} KB`}
                        left={(props) => <IconButton {...props} icon={getFileType(f.name) === 'image' ? "image" : "file-document"} />}
                        right={(props) => (
                            <IconButton
                                {...props}
                                icon="close"
                                onPress={() => removeFile(f.uri)}
                            />
                        )}
                    />
                </Card>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 12,
    },
    uploadCard: {
        borderStyle: 'dashed',
        borderColor: '#ccc',
    },
    content: {
        alignItems: 'center',
        padding: 24,
    },
    supportText: {
        opacity: 0.6,
        marginTop: 4,
    },
    button: {
        marginTop: 0,
        flex: 1,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
        width: '100%',
    }
});
