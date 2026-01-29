import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { TextInput, Button, useTheme, HelperText, Appbar, Avatar, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useProfileStore } from '../../src/store/profileStore';
import { userService } from '../../src/services/firebase/userService';
import { authService } from '../../src/services/firebase/authService';
import { storageService } from '../../src/services/firebase/storageService';

export default function EditProfileScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { userProfile, refreshProfile } = useProfileStore();

    const [firstName, setFirstName] = useState(userProfile?.firstName || '');
    const [lastName, setLastName] = useState(userProfile?.lastName || '');
    const [phone, setPhone] = useState(userProfile?.phoneNumber || '');

    // Photo State
    const [photoUri, setPhotoUri] = useState<string | null>(userProfile?.photoURL || null);
    const [isNewPhoto, setIsNewPhoto] = useState(false);

    // Password Change State
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });

            if (!result.canceled && result.assets[0].uri) {
                setPhotoUri(result.assets[0].uri);
                setIsNewPhoto(true);
            }
        } catch (error) {
            Alert.alert("Error", "Failed to pick image.");
        }
    };

    const handleSave = async () => {
        if (!userProfile) return;
        setLoading(true);

        try {
            // 0. Upload Photo if changed
            let finalPhotoURL = userProfile.photoURL;
            if (isNewPhoto && photoUri) {
                try {
                    finalPhotoURL = await storageService.uploadProfilePhoto(userProfile.uid, photoUri);
                } catch (e) {
                    console.error("Photo upload failed", e);
                    Alert.alert("Warning", "Failed to upload photo, proceeding with profile update.");
                }
            }

            // 1. Update Bio Data
            const updates: any = {
                firstName,
                lastName,
                displayName: `${firstName} ${lastName}`.trim(),
                phoneNumber: phone,
                photoURL: finalPhotoURL
            };

            await userService.updateProfile(userProfile.uid, updates);

            // 2. Update Password if provided
            if (newPassword) {
                if (newPassword.length < 6) {
                    Alert.alert("Error", "Password must be at least 6 characters long.");
                    setLoading(false);
                    return;
                }
                if (newPassword !== confirmPassword) {
                    Alert.alert("Error", "Passwords do not match.");
                    setLoading(false);
                    return;
                }

                try {
                    await authService.updateUserPassword(newPassword);
                    Alert.alert("Success", "Profile and password updated successfully.");
                } catch (error: any) {
                    if (error.code === 'auth/requires-recent-login') {
                        Alert.alert("Security Check", "To change your password, please logout and login again.");
                    } else {
                        Alert.alert("Error", "Failed to update password: " + error.message);
                    }
                    // Bio data was saved, so we keep going
                }
            } else {
                Alert.alert("Success", "Profile updated successfully.");
            }

            await refreshProfile();
            router.back();

        } catch (error: any) {
            console.error("Save Error:", error);
            Alert.alert("Error", "Failed to save profile.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <Appbar.Header>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title="Edit Profile" />
                <Appbar.Action icon="check" onPress={handleSave} disabled={loading} />
            </Appbar.Header>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.container}>

                    {/* Photo Upload Section */}
                    <View style={styles.photoContainer}>
                        <TouchableOpacity onPress={handlePickImage} disabled={loading}>
                            {photoUri ? (
                                <Avatar.Image size={100} source={{ uri: photoUri }} />
                            ) : (
                                <Avatar.Text size={100} label={firstName[0] || 'U'} />
                            )}
                            <View style={[styles.editBadge, { backgroundColor: theme.colors.primary, borderColor: theme.colors.background }]}>
                                <Avatar.Icon size={24} icon="camera" style={{ backgroundColor: 'transparent' }} color={theme.colors.onPrimary} />
                            </View>
                        </TouchableOpacity>
                        <Button mode="text" onPress={handlePickImage} disabled={loading} compact>
                            Change Photo
                        </Button>
                    </View>

                    <TextInput
                        label="First Name"
                        value={firstName}
                        onChangeText={setFirstName}
                        style={[styles.input, { backgroundColor: theme.colors.surface }]}
                        mode="outlined"
                    />
                    <TextInput
                        label="Last Name"
                        value={lastName}
                        onChangeText={setLastName}
                        style={[styles.input, { backgroundColor: theme.colors.surface }]}
                        mode="outlined"
                    />
                    <TextInput
                        label="Phone Number"
                        value={phone}
                        onChangeText={setPhone}
                        style={[styles.input, { backgroundColor: theme.colors.surface }]}
                        mode="outlined"
                        keyboardType="phone-pad"
                    />

                    {userProfile?.provider === 'email' ? (
                        <View style={[styles.passwordSection, { borderTopColor: theme.colors.outlineVariant }]}>
                            <HelperText type="info" visible>
                                Leave password fields blank to keep current password.
                            </HelperText>
                            <TextInput
                                label="New Password"
                                value={newPassword}
                                onChangeText={setNewPassword}
                                style={[styles.input, { backgroundColor: theme.colors.surface }]}
                                mode="outlined"
                                secureTextEntry
                            />
                            <TextInput
                                label="Confirm New Password"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                style={[styles.input, { backgroundColor: theme.colors.surface }]}
                                mode="outlined"
                                secureTextEntry
                                error={confirmPassword !== '' && newPassword !== confirmPassword}
                            />
                            {confirmPassword !== '' && newPassword !== confirmPassword && (
                                <HelperText type="error" visible>
                                    Passwords do not match
                                </HelperText>
                            )}
                        </View>
                    ) : (
                        <View style={styles.passwordSection}>
                            <Text variant="bodyMedium" style={{ color: theme.colors.outline, fontStyle: 'italic' }}>
                                Password update is disabled for {userProfile?.provider} accounts.
                            </Text>
                        </View>
                    )}

                    <Button
                        mode="outlined"
                        onPress={() => router.push('/profile/edit-professional')}
                        style={{ marginTop: 24, borderColor: theme.colors.primary }}
                        textColor={theme.colors.primary}
                        icon="briefcase-edit-outline"
                    >
                        Edit Professional Details
                    </Button>

                    <Button
                        mode="contained"
                        onPress={handleSave}
                        loading={loading}
                        style={styles.saveButton}
                    >
                        Save Changes
                    </Button>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
    },
    photoContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        borderRadius: 15,
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        // borderColor set dynamically
    },
    input: {
        marginBottom: 16,
        // backgroundColor set dynamically
    },
    passwordSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#ccc', // Will be overridden or we should change it. Let's rely on component override if possible, but StyleSheet is static. 
        // Actually, I should use inline styles for the border color in passwordSection too.
    },
    saveButton: {
        marginTop: 24,
    }
});
