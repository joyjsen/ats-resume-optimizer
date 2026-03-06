import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, useTheme, Chip, HelperText, Menu, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useProfileStore } from '../../src/store/profileStore';
import { userService } from '../../src/services/firebase/userService';
import { UserProfile } from '../../src/types/profile.types';

import { authService } from '../../src/services/firebase/authService';
import { ConfirmationResult } from 'firebase/auth';
import { auth } from '../../src/services/firebase/config';
import RecaptchaVerifierModal from '../../src/components/auth/RecaptchaVerifierModal';
import { CountryCodeSelector } from '../../src/components/auth/CountryCodeSelector';
import { COUNTRY_CALLING_CODES, CountryCallingCode } from '../../src/constants/countries';
import { COMMON_ROLES, COMMON_INDUSTRIES } from '../../src/constants/onboarding';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Keyboard, TouchableOpacity } from 'react-native';

export default function OnboardingScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { userProfile, setUserProfile } = useProfileStore();

    // Ref for reCAPTCHA
    const recaptchaVerifier = useRef(null);

    // Name Fallbacks
    const getInitialNames = () => {
        let fName = userProfile?.firstName || '';
        let lName = userProfile?.lastName || '';

        // Only use displayName if it's not the default "User" placeholder
        if (!fName && userProfile?.displayName && userProfile.displayName !== 'User') {
            const parts = userProfile.displayName.split(' ');
            fName = parts[0];
            lName = parts.slice(1).join(' ');
        }
        return { fName, lName };
    };

    const initialNames = getInitialNames();
    const [firstName, setFirstName] = useState(initialNames.fName);
    const [lastName, setLastName] = useState(initialNames.lName);
    const [currentJobTitle, setCurrentJobTitle] = useState(userProfile?.jobTitle || '');
    const [targetJobTitle, setTargetJobTitle] = useState(userProfile?.targetJobTitle || '');
    const [industry, setIndustry] = useState(userProfile?.targetIndustry || userProfile?.industry || ''); // Pre-fill from either
    const [experienceLevel, setExperienceLevel] = useState<'entry' | 'mid' | 'senior' | 'executive'>(userProfile?.experienceLevel as any || 'mid');
    const [linkedInUrl, setLinkedInUrl] = useState(userProfile?.linkedInUrl || '');
    const [loading, setLoading] = useState(false);

    // Mandatory Contact Info State
    const [email, setEmail] = useState(userProfile?.email || '');
    const [phone, setPhone] = useState(userProfile?.phoneNumber || '');
    const [selectedCountry, setSelectedCountry] = useState<CountryCallingCode>(
        COUNTRY_CALLING_CODES.find(c => phone.startsWith(c.code)) ||
        COUNTRY_CALLING_CODES.find(c => c.iso === 'US') ||
        COUNTRY_CALLING_CODES[0]
    );
    const [verificationStep, setVerificationStep] = useState<'idle' | 'sending' | 'pending'>('idle');
    const [verificationCode, setVerificationCode] = useState('');
    const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
    const [isEmailVerified, setIsEmailVerified] = useState(userProfile?.emailVerified || false);
    const [isPhoneVerified, setIsPhoneVerified] = useState(userProfile?.phoneVerified || false);

    // Menu States
    const [showTargetRoleMenu, setShowTargetRoleMenu] = useState(false);
    const [showCurrentJobMenu, setShowCurrentJobMenu] = useState(false);
    const [showIndustryMenu, setShowIndustryMenu] = useState(false);

    // Sync Verification States with Store
    useEffect(() => {
        if (userProfile) {
            setIsEmailVerified(userProfile.emailVerified || false);
            setIsPhoneVerified(userProfile.phoneVerified || false);
        }
    }, [userProfile?.emailVerified, userProfile?.phoneVerified]);

    // Force refresh profile on mount to get latest flags
    useEffect(() => {
        const refresh = async () => {
            const profile = await authService.refreshProfile();
            if (profile) setUserProfile(profile);
        };
        refresh();
    }, []);

    const isPhoneAuth = userProfile?.provider === 'phone';
    const needsEmail = !isEmailVerified;
    const needsPhone = !isPhoneVerified;

    const handleExit = async () => {
        Alert.alert(
            "Exit Onboarding",
            "WARNING: Your account will be DELETED forever if you exit now without completing your profile. Are you sure?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete Account & Exit",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setLoading(true);
                            if (userProfile?.uid) {
                                await userService.hardDeleteAccount(userProfile.uid);
                            }
                            // Delete auth user as well
                            try {
                                await authService.deleteUser();
                            } catch (authError: any) {
                                console.warn("Could not delete Auth user (requires recent login), but Firestore cleaned up:", authError);
                                if (authError.code === 'auth/requires-recent-login') {
                                    Alert.alert(
                                        "Account Partially Deleted",
                                        "Your profile data was removed, but your login session was too old to fully delete the account. You have been logged out safely."
                                    );
                                }
                            }
                            await authService.logout();
                            setUserProfile(null);
                            router.replace('/' as any);
                        } catch (error) {
                            console.error("Exit Error:", error);
                            router.replace('/' as any);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleSendEmailLink = async () => {
        if (!email.trim() || !validateEmail(email)) {
            Alert.alert("Error", "Please enter a valid email address.");
            return;
        }

        setLoading(true);
        try {
            // Duplicate check
            const check = await userService.checkEmailExists(email);
            if (check?.exists) {
                Alert.alert("Error", "Email address is already registered with another user, please use a different email address");
                setLoading(false);
                return;
            }

            await authService.verifyNewEmail(email);
            setVerificationStep('pending');
            Alert.alert("Verification Sent", "Please check your inbox for the verification link. Once verified, click 'Check Verification' below.");
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to send verification email.");
        } finally {
            setLoading(false);
        }
    };

    const handleCheckEmailVerified = async () => {
        if (!userProfile?.uid) return;
        setLoading(true);
        try {
            const user = authService.currentUser;
            if (user) {
                await user.reload();
                if (user.emailVerified) {
                    setIsEmailVerified(true);
                    setVerificationStep('idle');
                    Alert.alert("Success", "Email verified successfully!");
                } else {
                    Alert.alert("Not Verified", "Please click the link in your email first.");
                }
            }
        } catch (error: any) {
            Alert.alert("Error", "Failed to check status.");
        } finally {
            setLoading(false);
        }
    };

    const handleSendPhoneOTP = async () => {
        if (!phone || phone.length < 7) {
            Alert.alert("Error", "Please enter a valid phone number.");
            return;
        }

        setVerificationStep('sending');
        try {
            // Check for duplicate phone safely via Cloud Function
            const exists = await userService.checkPhoneExists(phone);
            if (exists?.exists) {
                Alert.alert("Error", "This phone number is already registered with another user, please use a different phone number.");
                setVerificationStep('idle');
                return;
            }

            // Combine selected country code and phone number
            let formattedNumber = phone.replace(/\s+/g, '').replace(/-/g, '').replace(/\(|\)/g, '');
            const cleanNumber = formattedNumber.startsWith('+') ? formattedNumber : `${selectedCountry.code}${formattedNumber}`;

            const verifier = Platform.OS === 'web' ? undefined : (recaptchaVerifier.current as any);
            const confirmationResult = await authService.requestPhoneVerification(cleanNumber, verifier);

            setConfirmation(confirmationResult);
            setVerificationStep('pending');
            Alert.alert("OTP Sent", "A verification code has been sent to your phone.");
        } catch (error: any) {
            console.error('[Onboarding] Phone OTP Error:', error);
            Alert.alert("Error", error.message || "Failed to send verification code.");
            setVerificationStep('idle');
        }
    };

    const handleVerifyPhoneOTP = async () => {
        if (!verificationCode || !confirmation) return;
        setLoading(true);
        try {
            await confirmation.confirm(verificationCode);
            setIsPhoneVerified(true);
            setVerificationStep('idle');
            Alert.alert("Success", "Phone verified successfully!");
        } catch (error: any) {
            Alert.alert("Error", "Invalid code. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const validateEmail = (email: string) => {
        return /\S+@\S+\.\S+/.test(email);
    };

    const handleComplete = async () => {
        if (!firstName.trim() || !lastName.trim()) {
            Alert.alert("Missing Information", "Please enter your First and Last Name.");
            return;
        }

        if (needsEmail && !isEmailVerified) {
            Alert.alert("Verification Required", "Please verify your email address before continuing.");
            return;
        }

        if (needsPhone && !isPhoneVerified) {
            Alert.alert("Verification Required", "Please verify your phone number before continuing.");
            return;
        }

        if (!targetJobTitle || !experienceLevel || !industry) {
            Alert.alert("Missing Information", "Please fill in the required fields (Target Role, Experience, Industry).");
            return;
        }

        if (!userProfile?.uid) return;

        setLoading(true);
        try {
            const updates: Partial<UserProfile> = {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                displayName: `${firstName} ${lastName}`.trim(),
                email: email.trim(),
                phoneNumber: phone.trim(),
                emailVerified: isEmailVerified,
                phoneVerified: isPhoneVerified,
                jobTitle: currentJobTitle,
                targetJobTitle: targetJobTitle,
                targetIndustry: industry,
                experienceLevel: experienceLevel,
                linkedInUrl: linkedInUrl,
                profileCompleted: true,
                profileCompletedAt: new Date()
            };

            await userService.updateProfile(userProfile.uid, updates);
            setUserProfile({ ...userProfile, ...updates });
            router.replace('/(tabs)' as any);

        } catch (error: any) {
            console.error("Onboarding Error:", error);
            Alert.alert("Error", "Failed to save profile details.");
        } finally {
            setLoading(false);
        }
    };

    const showNameInput = !userProfile?.firstName || !userProfile?.lastName;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <ScrollView contentContainerStyle={styles.container}>
                <RecaptchaVerifierModal
                    ref={recaptchaVerifier}
                    firebaseConfig={auth.app.options}
                    title="Verify you are human"
                    cancelLabel="Close"
                />

                <View style={styles.navHeader}>
                    <View />
                    <Button
                        icon="exit-to-app"
                        mode="text"
                        onPress={handleExit}
                        textColor={theme.colors.error}
                    >Exit</Button>
                </View>
                <View style={styles.header}>
                    <Text variant="displaySmall" style={styles.title}>Tell us about you</Text>
                    <Text variant="bodyLarge" style={styles.subtitle}>
                        This helps our AI tailor your resume and gap analysis efficiently.
                    </Text>
                </View>

                <View style={styles.form}>
                    {/* Name Inputs */}
                    {showNameInput && (
                        <View style={styles.section}>
                            <Text variant="titleMedium" style={styles.label}>Your Name *</Text>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TextInput
                                    mode="outlined"
                                    placeholder="First Name"
                                    value={firstName}
                                    onChangeText={setFirstName}
                                    style={[styles.input, { flex: 1 }]}
                                />
                                <TextInput
                                    mode="outlined"
                                    placeholder="Last Name"
                                    value={lastName}
                                    onChangeText={setLastName}
                                    style={[styles.input, { flex: 1 }]}
                                />
                            </View>
                        </View>
                    )}

                    {/* Mandatory Contact Verification */}
                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text variant="titleMedium" style={styles.label}>Mandatory Email *</Text>
                            {isEmailVerified && (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="check-circle" size={20} color={theme.colors.primary} />
                                    <Text style={{ marginLeft: 4, color: theme.colors.primary, fontWeight: 'bold' }}>Verified</Text>
                                </View>
                            )}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TextInput
                                mode="outlined"
                                placeholder="email@example.com"
                                value={email}
                                onChangeText={setEmail}
                                style={[styles.input, { flex: 1 }]}
                                autoCapitalize="none"
                                disabled={loading || isEmailVerified}
                            />
                            {!isEmailVerified && (
                                <>
                                    {verificationStep !== 'pending' ? (
                                        <Button mode="contained-tonal" onPress={handleSendEmailLink} loading={loading}>
                                            Verify
                                        </Button>
                                    ) : (
                                        <Button mode="contained" onPress={handleCheckEmailVerified} loading={loading}>
                                            I Have Verified
                                        </Button>
                                    )}
                                </>
                            )}
                        </View>
                        {!isEmailVerified && <HelperText type="info">Link will be sent to your inbox.</HelperText>}
                    </View>

                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text variant="titleMedium" style={styles.label}>Mandatory Phone *</Text>
                            {isPhoneVerified && (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="check-circle" size={20} color={theme.colors.primary} />
                                    <Text style={{ marginLeft: 4, color: theme.colors.primary, fontWeight: 'bold' }}>Verified</Text>
                                </View>
                            )}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                            <CountryCodeSelector
                                selectedCountry={selectedCountry}
                                onSelect={(country) => {
                                    setSelectedCountry(country);
                                    if (isPhoneVerified) setIsPhoneVerified(false);
                                    if (verificationStep === 'pending') setVerificationStep('idle');
                                }}
                                disabled={loading || isPhoneVerified}
                            />
                            <TextInput
                                mode="outlined"
                                placeholder="Phone Number"
                                value={phone}
                                onChangeText={(text) => {
                                    setPhone(text);
                                    if (isPhoneVerified) setIsPhoneVerified(false);
                                    if (verificationStep === 'pending') setVerificationStep('idle');
                                }}
                                keyboardType="phone-pad"
                                style={[styles.input, { flex: 1 }]}
                                disabled={loading || isPhoneVerified}
                            />
                            {!isPhoneVerified && (
                                <Button
                                    mode="contained-tonal"
                                    onPress={handleSendPhoneOTP}
                                    loading={verificationStep === 'sending'}
                                    disabled={loading || !phone || phone.length < 7}
                                >
                                    {verificationStep === 'pending' ? 'Resend' : 'Verify'}
                                </Button>
                            )}
                        </View>

                        {verificationStep === 'pending' && !isPhoneVerified && (
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
                                <TextInput
                                    mode="outlined"
                                    placeholder="Enter OTP Code"
                                    value={verificationCode}
                                    onChangeText={setVerificationCode}
                                    style={[styles.input, { flex: 1 }]}
                                    keyboardType="number-pad"
                                    autoFocus
                                />
                                <Button
                                    mode="contained"
                                    onPress={handleVerifyPhoneOTP}
                                    loading={loading}
                                    disabled={!verificationCode || verificationCode.length < 6}
                                >
                                    Confirm
                                </Button>
                            </View>
                        )}

                        {!isPhoneVerified && (
                            <HelperText type="info">
                                {verificationStep === 'pending' ? 'Enter the 6-digit code sent to your phone.' : "We'll send an OTP to your phone."}
                            </HelperText>
                        )}
                    </View>

                    {/* Target Role */}
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={styles.label}>Target Role *</Text>
                        <Menu
                            visible={showTargetRoleMenu}
                            onDismiss={() => setShowTargetRoleMenu(false)}
                            anchor={
                                <TextInput
                                    mode="outlined"
                                    placeholder="e.g. Senior Full Stack Engineer"
                                    value={targetJobTitle}
                                    onChangeText={(text) => {
                                        setTargetJobTitle(text);
                                        setShowTargetRoleMenu(false);
                                    }}
                                    style={styles.input}
                                    right={
                                        <TextInput.Icon
                                            icon="chevron-down"
                                            onPress={() => {
                                                Keyboard.dismiss();
                                                setShowTargetRoleMenu(true);
                                            }}
                                        />
                                    }
                                />
                            }
                            contentStyle={{ backgroundColor: theme.colors.elevation.level3 }}
                        >
                            <ScrollView style={{ maxHeight: 300 }}>
                                {COMMON_ROLES.map((role) => (
                                    <Menu.Item
                                        key={role}
                                        onPress={() => {
                                            setTargetJobTitle(role);
                                            setShowTargetRoleMenu(false);
                                        }}
                                        title={role}
                                    />
                                ))}
                                <Divider />
                                <Menu.Item
                                    onPress={() => {
                                        setTargetJobTitle('');
                                        setShowTargetRoleMenu(false);
                                    }}
                                    title="Other (Type manually)"
                                    leadingIcon="pencil"
                                />
                            </ScrollView>
                        </Menu>
                    </View>

                    {/* Current Role */}
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={styles.label}>Current Job Title (Optional)</Text>
                        <Menu
                            visible={showCurrentJobMenu}
                            onDismiss={() => setShowCurrentJobMenu(false)}
                            anchor={
                                <TextInput
                                    mode="outlined"
                                    placeholder="e.g. Junior Developer"
                                    value={currentJobTitle}
                                    onChangeText={(text) => {
                                        setCurrentJobTitle(text);
                                        setShowCurrentJobMenu(false);
                                    }}
                                    style={styles.input}
                                    right={
                                        <TextInput.Icon
                                            icon="chevron-down"
                                            onPress={() => {
                                                Keyboard.dismiss();
                                                setShowCurrentJobMenu(true);
                                            }}
                                        />
                                    }
                                />
                            }
                            contentStyle={{ backgroundColor: theme.colors.elevation.level3 }}
                        >
                            <ScrollView style={{ maxHeight: 300 }}>
                                {COMMON_ROLES.map((role) => (
                                    <Menu.Item
                                        key={role}
                                        onPress={() => {
                                            setCurrentJobTitle(role);
                                            setShowCurrentJobMenu(false);
                                        }}
                                        title={role}
                                    />
                                ))}
                                <Divider />
                                <Menu.Item
                                    onPress={() => {
                                        setCurrentJobTitle('');
                                        setShowCurrentJobMenu(false);
                                    }}
                                    title="Other (Type manually)"
                                    leadingIcon="pencil"
                                />
                            </ScrollView>
                        </Menu>
                    </View>

                    {/* Experience Level */}
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={styles.label}>Experience Level *</Text>
                        <View style={styles.chipContainer}>
                            {(['entry', 'mid', 'senior', 'executive'] as const).map((level) => (
                                <Chip
                                    key={level}
                                    mode={experienceLevel === level ? 'flat' : 'outlined'}
                                    selected={experienceLevel === level}
                                    onPress={() => setExperienceLevel(level)}
                                    style={styles.chip}
                                >
                                    {level.charAt(0).toUpperCase() + level.slice(1)}
                                </Chip>
                            ))}
                        </View>
                    </View>

                    {/* Target Industry */}
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={styles.label}>Target Industry *</Text>
                        <Menu
                            visible={showIndustryMenu}
                            onDismiss={() => setShowIndustryMenu(false)}
                            anchor={
                                <TextInput
                                    mode="outlined"
                                    placeholder="e.g. Tech, Finance, Healthcare"
                                    value={industry}
                                    onChangeText={(text) => {
                                        setIndustry(text);
                                        setShowIndustryMenu(false);
                                    }}
                                    style={styles.input}
                                    right={
                                        <TextInput.Icon
                                            icon="chevron-down"
                                            onPress={() => {
                                                Keyboard.dismiss();
                                                setShowIndustryMenu(true);
                                            }}
                                        />
                                    }
                                />
                            }
                            contentStyle={{ backgroundColor: theme.colors.elevation.level3 }}
                        >
                            <ScrollView style={{ maxHeight: 300 }}>
                                {COMMON_INDUSTRIES.map((ind) => (
                                    <Menu.Item
                                        key={ind}
                                        onPress={() => {
                                            setIndustry(ind);
                                            setShowIndustryMenu(false);
                                        }}
                                        title={ind}
                                    />
                                ))}
                                <Divider />
                                <Menu.Item
                                    onPress={() => {
                                        setIndustry('');
                                        setShowIndustryMenu(false);
                                    }}
                                    title="Other (Type manually)"
                                    leadingIcon="pencil"
                                />
                            </ScrollView>
                        </Menu>
                    </View>

                    {/* LinkedIn URL */}
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={styles.label}>LinkedIn URL (Optional)</Text>
                        <TextInput
                            mode="outlined"
                            placeholder="https://linkedin.com/in/yourname"
                            value={linkedInUrl}
                            onChangeText={setLinkedInUrl}
                            keyboardType="url"
                            autoCapitalize="none"
                            style={styles.input}
                            right={<TextInput.Icon icon="linkedin" />}
                        />
                    </View>

                    <Button
                        mode="contained"
                        onPress={handleComplete}
                        loading={loading}
                        disabled={loading || (needsEmail && !isEmailVerified) || (needsPhone && !isPhoneVerified)}
                        contentStyle={{ paddingVertical: 8 }}
                        style={{ marginTop: 20 }}
                    >
                        Complete Setup
                    </Button>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 24,
        paddingTop: 60,
    },
    header: {
        marginBottom: 32,
    },
    title: {
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        opacity: 0.7,
        lineHeight: 24,
    },
    form: {
        gap: 20,
    },
    section: {
        marginBottom: 4,
    },
    label: {
        marginBottom: 8,
        fontWeight: 'bold',
    },
    input: {
        backgroundColor: 'transparent',
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        // margin: 4,
    },
    navHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    }
});
