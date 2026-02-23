import React, { useState } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { Button, Text, Card, IconButton, useTheme } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export interface UploadedFile {
    uri: string;
    name: string;
    size?: number;
}

interface Props {
    onFileSelected: (files: UploadedFile[]) => void;
    isTextModeActive?: boolean;
    disabled?: boolean;
}

const isAndroid = Platform.OS === 'android';

export const CVUploader = ({ onFileSelected, isTextModeActive, disabled }: Props) => {
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

            // Check for duplicates (same name and size)
            const duplicates = newFiles.filter(newFile =>
                files.some(f => f.name === newFile.name && f.size === newFile.size)
            );

            if (duplicates.length > 0) {
                const duplicateNames = duplicates.map(d => d.name).join(', ');
                Alert.alert("Duplicate File", `The following file(s) are already uploaded: ${duplicateNames}`);
            }

            const nonDuplicates = newFiles.filter(newFile =>
                !files.some(f => f.name === newFile.name && f.size === newFile.size)
            );

            if (nonDuplicates.length > 0) {
                updateFiles([...files, ...nonDuplicates]);
            }
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

                // Check for duplicates (same name and size)
                const duplicates = newFiles.filter(newFile =>
                    files.some(f => f.name === newFile.name && f.size === newFile.size)
                );

                if (duplicates.length > 0) {
                    const duplicateNames = duplicates.map(d => d.name).join(', ');
                    Alert.alert("Duplicate Image", `The following image(s) are already uploaded: ${duplicateNames}`);
                }

                const nonDuplicates = newFiles.filter(newFile =>
                    !files.some(f => f.name === newFile.name && f.size === newFile.size)
                );

                if (nonDuplicates.length > 0) {
                    updateFiles([...files, ...nonDuplicates]);
                }
            }
        } catch (err) {
            console.error('Error picking images:', err);
        }
    };

    const updateFiles = (newFileList: UploadedFile[]) => {
        setFiles(newFileList);
        onFileSelected(newFileList); // Pass full objects, not just URIs
    };

    const removeFile = (uri: string) => {
        const updated = files.filter(f => f.uri !== uri);
        updateFiles(updated);
    };

    return (
        <View style={styles.container}>
            <Card style={styles.uploadCard} mode="outlined">
                <Card.Content style={styles.content}>
                    <IconButton icon="cloud-upload" size={isAndroid ? 32 : 40} iconColor={theme.colors.primary} />
                    <Text variant={isAndroid ? "titleSmall" : "titleMedium"}>Upload Resume(s)</Text>
                    <Text variant="bodySmall" style={styles.supportText}>
                        Accepted: Word (DOCX), text files (TXT), or Images
                    </Text>

                    <View style={styles.buttonRow}>
                        <Button
                            mode="contained"
                            icon="image"
                            onPress={pickImages}
                            style={styles.button}
                            compact={isAndroid}
                            disabled={disabled}
                        >
                            Gallery
                        </Button>
                        <Button
                            mode="outlined"
                            icon="file-document"
                            onPress={pickDocument}
                            style={styles.button}
                            compact={isAndroid}
                            disabled={disabled}
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
                        left={(props) => <IconButton {...props} icon={getFileType(f.name) === 'image' ? "image" : "file-document"} size={isAndroid ? 20 : 24} />}
                        right={(props) => (
                            <IconButton
                                {...props}
                                icon="close"
                                onPress={() => removeFile(f.uri)}
                                size={isAndroid ? 20 : 24}
                                disabled={disabled}
                            />
                        )}
                        titleStyle={isAndroid ? { fontSize: 14 } : undefined}
                        subtitleStyle={isAndroid ? { fontSize: 11 } : undefined}
                    />
                </Card>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: isAndroid ? 8 : 12,
    },
    uploadCard: {
        borderStyle: 'dashed',
        borderColor: '#ccc',
    },
    content: {
        alignItems: 'center',
        padding: isAndroid ? 16 : 24,
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
        gap: isAndroid ? 8 : 12,
        marginTop: isAndroid ? 12 : 16,
        width: '100%',
    }
});

