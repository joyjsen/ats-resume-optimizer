import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, Platform, Animated as RNAnimated, findNodeHandle } from 'react-native';
import { Button, Text, Card, IconButton, useTheme } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export interface UploadedFile {
    uri: string;
    name: string;
    size?: number;
    mimeType?: string;
}

interface Props {
    onFileSelected: (files: UploadedFile[]) => void;
    isTextModeActive?: boolean;
    disabled?: boolean;
    isGlowing?: boolean;
    onCreateNew?: () => void;
    onLoadSaved?: () => void;
    isLoadingSaved?: boolean;
    onLayoutUpdate?: (key: string, layout: any) => void;
}

const isAndroid = Platform.OS === 'android';

export const CVUploader = ({ onFileSelected, isTextModeActive, disabled, isGlowing, onCreateNew, onLoadSaved, isLoadingSaved, onLayoutUpdate }: Props) => {
    const theme = useTheme();
    const [files, setFiles] = useState<UploadedFile[]>([]);
    
    const glowAnim = useRef(new RNAnimated.Value(0)).current;

    useEffect(() => {
        if (isGlowing) {
            RNAnimated.loop(
                RNAnimated.sequence([
                    RNAnimated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
                    RNAnimated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: false })
                ])
            ).start();
        } else {
            glowAnim.stopAnimation();
            glowAnim.setValue(0);
        }
    }, [isGlowing]);

    const glowColor = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['transparent', theme.colors.primary]
    });

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
                size: a.size,
                mimeType: a.mimeType
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
                    size: a.fileSize,
                    mimeType: a.mimeType || 'image/jpeg'
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

    const rootRef = useRef<View>(null);
    const galleryRef = useRef<View>(null);
    const filesRef = useRef<View>(null);
    const createNewRef = useRef<View>(null);
    const useSavedRef = useRef<View>(null);

    const removeFile = (uri: string) => {
        const updated = files.filter(f => f.uri !== uri);
        updateFiles(updated);
    };

    const triggerMeasurement = () => {
        if (!onLayoutUpdate || !rootRef.current) return;
        setTimeout(() => {
            rootRef.current?.measure((rx, ry, rw, rh, rootPageX, rootPageY) => {
                if (rootPageY === undefined) return;

                galleryRef.current?.measure((x, y, w, h, pageX, pageY) => {
                    if (pageY !== undefined) onLayoutUpdate('gallery', { x: pageX - rootPageX, y: pageY - rootPageY, width: w, height: h });
                });
                filesRef.current?.measure((x, y, w, h, pageX, pageY) => {
                    if (pageY !== undefined) onLayoutUpdate('files', { x: pageX - rootPageX, y: pageY - rootPageY, width: w, height: h });
                });
                createNewRef.current?.measure((x, y, w, h, pageX, pageY) => {
                    if (pageY !== undefined) onLayoutUpdate('createNew', { x: pageX - rootPageX, y: pageY - rootPageY, width: w, height: h });
                });
                useSavedRef.current?.measure((x, y, w, h, pageX, pageY) => {
                    if (pageY !== undefined) onLayoutUpdate('useSaved', { x: pageX - rootPageX, y: pageY - rootPageY, width: w, height: h });
                });
            });
        }, 300);
    };

    React.useEffect(() => {
        triggerMeasurement();
    }, [disabled, isGlowing]);

    return (
        <View style={styles.container} ref={rootRef} onLayout={triggerMeasurement}>
            <RNAnimated.View style={{ borderRadius: 12, borderWidth: 2, borderColor: glowColor, shadowColor: isGlowing ? theme.colors.primary : 'transparent', shadowOpacity: glowAnim, shadowRadius: 8 }}>
            <Card style={styles.uploadCard} mode="outlined">
                <Card.Content style={styles.content}>
                    <IconButton icon="cloud-upload" size={isAndroid ? 32 : 40} iconColor={theme.colors.primary} />
                    <Text variant={isAndroid ? "titleSmall" : "titleMedium"}>Upload Resume(s)</Text>
                    <Text variant="bodySmall" style={styles.supportText}>
                        Accepted: Word (DOCX), text files (TXT), or Images
                    </Text>

                    <View style={styles.buttonRow}>
                        <View style={{ flex: 1 }} ref={galleryRef}>
                            <Button
                                mode="outlined"
                                icon="image"
                                onPress={pickImages}
                                style={styles.button}
                                compact={true}
                                labelStyle={{ fontSize: isAndroid ? 14 : 16 }}
                                disabled={disabled}
                            >
                                Gallery
                            </Button>
                        </View>
                        <View style={{ flex: 1 }} ref={filesRef}>
                            <Button
                                mode="outlined"
                                icon="file-document"
                                onPress={pickDocument}
                                style={styles.button}
                                compact={true}
                                labelStyle={{ fontSize: isAndroid ? 14 : 16 }}
                                disabled={disabled}
                            >
                                Files
                            </Button>
                        </View>
                    </View>

                    {(onCreateNew || onLoadSaved) && (
                        <View style={styles.buttonRowSecondary}>
                            {onCreateNew && (
                                <View style={{ flex: 1 }} ref={createNewRef}>
                                    <Button
                                        mode="contained"
                                        icon="file-document-edit"
                                        onPress={onCreateNew}
                                        style={styles.button}
                                        compact={true}
                                        labelStyle={{ fontSize: isAndroid ? 14 : 16 }}
                                        disabled={disabled}
                                    >
                                        Create New
                                    </Button>
                                </View>
                            )}
                            {onLoadSaved && (
                                <View style={{ flex: 1 }} ref={useSavedRef}>
                                    <Button
                                        mode="contained"
                                        icon="cloud-download"
                                        onPress={onLoadSaved}
                                        style={styles.button}
                                        compact={true}
                                        labelStyle={{ fontSize: isAndroid ? 14 : 16 }}
                                        disabled={disabled || isLoadingSaved}
                                        loading={isLoadingSaved}
                                    >
                                        Use saved
                                    </Button>
                                </View>
                            )}
                        </View>
                    )}

                    {files.length > 0 && (
                        <Text variant="bodySmall" style={{ marginTop: 8 }}>
                            {files.length} file(s) selected
                        </Text>
                    )}
                </Card.Content>
            </Card>
            </RNAnimated.View>

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
        width: '100%',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: isAndroid ? 8 : 12,
        marginTop: isAndroid ? 12 : 16,
        width: '100%',
    },
    buttonRowSecondary: {
        flexDirection: 'row',
        gap: isAndroid ? 8 : 12,
        marginTop: 8,
        width: '100%',
    }
});

