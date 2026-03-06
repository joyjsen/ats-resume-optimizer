import React, { useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { TextInput, Button, useTheme, HelperText, Appbar, Avatar, Text } from 'react-native-paper';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useProfileStore } from '../../src/store/profileStore';
import { userService } from '../../src/services/firebase/userService';
import { authService } from '../../src/services/firebase/authService';
import { storageService } from '../../src/services/firebase/storageService';
import { auth } from '../../src/services/firebase/config';
import RecaptchaVerifierModal from '../../src/components/auth/RecaptchaVerifierModal';
import { PhoneAuthProvider } from 'firebase/auth';
import { CountryCodeSelector } from '../../src/components/auth/CountryCodeSelector';
import { COUNTRY_CALLING_CODES, CountryCallingCode } from '../../src/constants/countries';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function EditProfileScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { userProfile, refreshProfile } = useProfileStore();

    const [firstName, setFirstName] = useState(userProfile?.firstName || '');
    const [lastName, setLastName] = useState(userProfile?.lastName || '');
    const [email, setEmail] = useState(userProfile?.email || '');

    // Parse initial phone number
    const initialPhone = userProfile?.phoneNumber || '';
    const initialCountry = COUNTRY_CALLING_CODES.find(c => initialPhone.startsWith(c.code)) ||
        COUNTRY_CALLING_CODES.find(c => c.iso === 'US') ||
        COUNTRY_CALLING_CODES[0];

    // The local part of the phone number (without country code)
    const localPhone = initialPhone.startsWith(initialCountry.code)
        ? initialPhone.slice(initialCountry.code.length)
        : initialPhone;

    const [phone, setPhone] = useState(localPhone);
    const [selectedCountry, setSelectedCountry] = useState<CountryCallingCode>(initialCountry);

    // Photo State
    const [photoUri, setPhotoUri] = useState<string | null>(userProfile?.photoURL || null);
    const [isNewPhoto, setIsNewPhoto] = useState(false);

    // Password Change State
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Phone Verification State
    const [confirmingPhone, setConfirmingPhone] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const recaptchaVerifier = useRef(null);

    // Email Verification State
    const [confirmingEmail, setConfirmingEmail] = useState(false);

    const isPhoneAuth = userProfile?.provider === 'phone';

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

    const validateEmail = (email: string) => {
        return String(email)
            .toLowerCase()
            .match(
                /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
            );
    };

    const performRemainingUpdates = async (forceLogoutAfter = false) => {
        if (!userProfile) return;

        try {
            // 0. Upload Photo if changed
            let finalPhotoURL = userProfile.photoURL;
            if (isNewPhoto && photoUri) {
                try {
                    finalPhotoURL = await storageService.uploadProfilePhoto(userProfile.uid, photoUri);
                } catch (e) {
                    console.error("Photo upload failed", e);
                }
            }

            // 1. Update Bio Data in Firestore
            const updates: any = {
                firstName,
                lastName,
                displayName: `${firstName} ${lastName}`.trim(),
                photoURL: finalPhotoURL
            };

            // Only update phone/email in Firestore if they match auth state now
            const currentUser = auth.currentUser;
            const fullPhone = `${selectedCountry.code}${phone}`;
            if (currentUser?.email?.toLowerCase() === email.toLowerCase() || forceLogoutAfter) {
                updates.email = email;
            }
            if (currentUser?.phoneNumber === fullPhone) {
                updates.phoneNumber = fullPhone;
            }

            // Check if profile is now complete
            if (!userProfile.profileCompleted &&
                updates.firstName &&
                updates.lastName &&
                userProfile.jobTitle &&
                userProfile.targetJobTitle &&
                userProfile.experienceLevel &&
                userProfile.targetIndustry) {
                updates.profileCompleted = true;
                updates.profileCompletedAt = new Date();
            }

            await userService.updateProfile(userProfile.uid, updates);

            // 2. Update Password if provided
            if (newPassword) {
                if (newPassword.length >= 6 && newPassword === confirmPassword) {
                    try {
                        await authService.updateUserPassword(newPassword);
                        if (!forceLogoutAfter) Alert.alert("Success", "Profile updated successfully (including password).");
                    } catch (error: any) {
                        Alert.alert("Warning", "Bio updated, but password update failed: " + error.message);
                    }
                }
            } else {
                if (!forceLogoutAfter) Alert.alert("Success", "Profile details saved.");
            }

            await refreshProfile();

            if (forceLogoutAfter) {
                Alert.alert(
                    "Update Successful",
                    "Email address is updated, please re-login with the new email address to continue",
                    [{
                        text: "OK",
                        onPress: async () => {
                            await authService.logout();
                            router.replace('/(auth)/sign-in' as any);
                        }
                    }]
                );
            } else {
                router.back();
            }

        } catch (error: any) {
            console.error("Firestore Update Error:", error);
            if (error.code === 'auth/user-token-expired' || forceLogoutAfter) {
                Alert.alert(
                    "Update Successful",
                    "Email address is updated, please re-login with the new email address to continue",
                    [{
                        text: "OK",
                        onPress: async () => {
                            await authService.logout();
                            router.replace('/(auth)/sign-in' as any);
                        }
                    }]
                );
            } else {
                Alert.alert("Error", "Bio data updated in Auth, but failed to save to database record.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSendPhoneCode = async () => {
        try {
            const cleanNumber = phone.replace(/\s+/g, '').replace(/-/g, '').replace(/\(|\)/g, '');
            const fullNumber = cleanNumber.startsWith('+') ? cleanNumber : `${selectedCountry.code}${cleanNumber}`;

            const verifier = Platform.OS === 'web' ? undefined : recaptchaVerifier.current;
            await authService.signInWithPhoneNumber(fullNumber, verifier || undefined);
            setConfirmingPhone(true);
            Alert.alert("Verification", "Verification code sent to your new phone number.");
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to send code.");
            setLoading(false);
        }
    };

    const handleConfirmPhone = async () => {
        setLoading(true);
        try {
            const credential = PhoneAuthProvider.credential(
                // @ts-ignore -confirmationResult is stored in authService
                authService['confirmationResult'].verificationId,
                verificationCode
            );
            await authService.updateNewPhoneNumber(credential);
            setConfirmingPhone(false);
            setVerificationCode('');
            await performRemainingUpdates();
        } catch (error: any) {
            Alert.alert("Error", error.message || "Invalid code.");
            setLoading(false);
        }
    };

    const handleCheckEmailVerification = async () => {
        setLoading(true);
        try {
            const user = await authService.reloadUser();
            if (user?.email?.toLowerCase() === email.toLowerCase()) {
                setConfirmingEmail(false);
                // Perform other updates (photo, names) before forced logout
                await performRemainingUpdates(true);
            } else {
                Alert.alert("Pending", "Email not verified yet. Please check your inbox and click the link.");
            }
        } catch (error: any) {
            if (error.code === 'auth/user-token-expired') {
                // This usually means the email update was successful but the session needs refresh
                setConfirmingEmail(false);
                Alert.alert(
                    "Success",
                    "Email address is updated, please re-login with the new email address to continue",
                    [{
                        text: "OK",
                        onPress: async () => {
                            await authService.logout();
                            router.replace('/(auth)/sign-in' as any);
                        }
                    }]
                );
            } else {
                Alert.alert("Error", error.message || "Failed to check verification status.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!firstName || !lastName) {
            Alert.alert("Error", "First and last name are required.");
            return;
        }

        setLoading(true);
        try {
            // 1. Check for Email Change
            if (email.toLowerCase() !== userProfile?.email?.toLowerCase()) {
                if (!email || !validateEmail(email)) {
                    Alert.alert("Error", "Please enter a valid email address.");
                    setLoading(false);
                    return;
                }

                // Check for duplicate email before triggering verification
                try {
                    const functions = getFunctions();
                    const checkUserProvider = httpsCallable(functions, 'checkUserProvider');
                    const result = await checkUserProvider({ email });
                    const emailCheck = result.data as any;

                    if (emailCheck?.exists) {
                        Alert.alert("Error", "Email address is already registered with another user, please use a different email address");
                        setLoading(false);
                        return;
                    }
                } catch (e: any) {
                    Alert.alert("Error", "Failed to check email availability: " + (e.message || "Unknown error"));
                    setLoading(false);
                    return;
                }

                // Native Firebase Verification
                Alert.alert(
                    "Verify New Email",
                    `We will send a verification link to ${email}. The change will only take effect after you verify it. Proceed?`,
                    [
                        { text: "Cancel", style: "cancel", onPress: () => setLoading(false) },
                        {
                            text: "Send Link",
                            onPress: async () => {
                                try {
                                    await authService.verifyNewEmail(email);
                                    setConfirmingEmail(true);
                                    Alert.alert("Verification Sent", "Please check your new email's inbox for the verification link. Once verified, click 'I Have Verified' below.");
                                } catch (e: any) {
                                    Alert.alert("Error", e.message || "Failed to send verification email.");
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }
                    ]
                );
                return;
            }

            // 2. Check for Phone Change
            const currentPhone = userProfile?.phoneNumber || '';
            const newFullPhone = phone.trim() ? (phone.startsWith('+') ? phone : `${selectedCountry.code}${phone}`) : '';

            if (newFullPhone && newFullPhone !== currentPhone && !isPhoneAuth) {
                if (!phone) {
                    Alert.alert("Error", "Phone number cannot be empty.");
                    setLoading(false);
                    return;
                }

                // Check for duplicate phone safely via Cloud Function if phone changed
                try {
                    const exists = await userService.checkPhoneExists(newFullPhone);
                    if (exists) {
                        Alert.alert("Error", "This phone number is already registered with another user, please use a different phone number.");
                        setLoading(false);
                        return;
                    }
                } catch (err) {
                    console.warn("Duplicate phone check failed, proceeding anyway", err);
                }

                // Trigger Phone Verification flow
                await handleSendPhoneCode();
                return;
            }

            await performRemainingUpdates();

        } catch (error: any) {
            console.error("Save Error:", error);
            Alert.alert("Error", error.message || "Failed to save profile.");
            setLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <Stack.Screen
                options={{
                    headerRight: () => (
                        <Appbar.Action
                            icon="check"
                            onPress={handleSave}
                            disabled={loading || confirmingEmail || confirmingPhone}
                            color={theme.colors.primary}
                        />
                    )
                }}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.container}>
                    <RecaptchaVerifierModal
                        ref={recaptchaVerifier}
                        firebaseConfig={auth.app.options}
                        title="Verify you are human"
                        cancelLabel="Close"
                    />

                    {/* Phone Verification Confirmation (Only shown when verifying new phone) */}
                    {confirmingPhone && (
                        <View style={styles.verificationOverlay}>
                            <Text variant="titleMedium">Enter Verification Code</Text>
                            <TextInput
                                label="Code"
                                value={verificationCode}
                                onChangeText={setVerificationCode}
                                mode="outlined"
                                keyboardType="number-pad"
                                style={styles.input}
                            />
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <Button mode="outlined" onPress={() => {
                                    setConfirmingPhone(false);
                                    setPhone(localPhone);
                                }} style={{ flex: 1 }}>Cancel</Button>
                                <Button mode="contained" onPress={handleConfirmPhone} style={{ flex: 1 }} loading={loading}>Verify</Button>
                            </View>
                        </View>
                    )}

                    {/* Email Verification Pending */}
                    {confirmingEmail && (
                        <View style={styles.verificationOverlay}>
                            <Text variant="titleMedium">Email Verification Pending</Text>
                            <Text variant="bodyMedium" style={{ marginVertical: 8 }}>
                                We've sent a link to <Text style={{ fontWeight: 'bold' }}>{email}</Text>. Please verify it to complete the update.
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <Button mode="outlined" onPress={() => {
                                    setConfirmingEmail(false);
                                    setEmail(userProfile?.email || '');
                                }} style={{ flex: 1 }}>Cancel</Button>
                                <Button mode="contained" onPress={handleCheckEmailVerification} style={{ flex: 1 }} loading={loading}>I Have Verified</Button>
                            </View>
                        </View>
                    )}

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

                    {/* Email Field - Editable for Phone Users, Readonly for others usually (or editable but strict) */}
                    <TextInput
                        label={isPhoneAuth ? "Email Address (Required)" : "Email Address"}
                        value={email}
                        onChangeText={setEmail}
                        style={[styles.input, { backgroundColor: theme.colors.surface }]}
                        mode="outlined"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        disabled={userProfile?.provider === 'google' || userProfile?.provider === 'apple'} // Often social logins email is fixed
                        right={isPhoneAuth ? <TextInput.Icon icon="pencil" /> : null}
                    />
                    {isPhoneAuth && (
                        <HelperText type="info" visible>
                            Since you signed in with phone, please add your email for important notifications.
                        </HelperText>
                    )}

                    {/* Phone Field - Side-by-side with Country Selector */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
                        <CountryCodeSelector
                            selectedCountry={selectedCountry}
                            onSelect={setSelectedCountry}
                            disabled={isPhoneAuth}
                        />
                        <TextInput
                            label="Phone Number"
                            value={phone}
                            onChangeText={setPhone}
                            style={[styles.input, { flex: 1, backgroundColor: theme.colors.surface, marginBottom: 0 }]}
                            mode="outlined"
                            keyboardType="phone-pad"
                            disabled={isPhoneAuth} // Phone users cannot change their ID
                            right={isPhoneAuth ? <TextInput.Icon icon="lock" /> : null}
                        />
                    </View>
                    {isPhoneAuth && (
                        <HelperText type="info" visible style={{ marginTop: -12, marginBottom: 12 }}>
                            Phone number cannot be changed as it is your login ID.
                        </HelperText>
                    )}

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
                                Password update not available for {userProfile?.provider} accounts.
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
                        disabled={confirmingEmail || confirmingPhone}
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
    },
    input: {
        marginBottom: 16,
    },
    passwordSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
    },
    saveButton: {
        marginTop: 24,
    },
    verificationOverlay: {
        padding: 20,
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#ccc',
    }
});
