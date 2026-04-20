import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Linking } from 'react-native';
import { Text, TextInput, Button, useTheme, Chip, List, ActivityIndicator, Menu, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useProfileStore } from '../../src/store/profileStore';
import { userService } from '../../src/services/firebase/userService';
import { UserProfile } from '../../src/types/profile.types';
import { authService } from '../../src/services/firebase/authService';
import { getFirebaseFunctions, getFirebaseAuth } from '../../src/services/firebase/config';
import { httpsCallable } from 'firebase/functions';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ConfirmationResult } from 'firebase/auth';
import RecaptchaVerifierModal from '../../src/components/auth/RecaptchaVerifierModal';
import { getFirebaseApp } from '../../src/services/firebase/config';
import { CountryCodeSelector } from '../../src/components/auth/CountryCodeSelector';
import { COUNTRY_CALLING_CODES, CountryCallingCode } from '../../src/constants/countries';

const JOB_TITLES = [
    "Software Engineer",
    "Product Manager",
    "Data Scientist",
    "Designer",
    "Marketing Manager",
    "Sales Executive",
    "HR Professional",
    "Financial Analyst",
    "Operations Manager",
    "Other"
];

const INDUSTRIES = [
    "Technology",
    "Finance",
    "Healthcare",
    "Education",
    "Retail",
    "Manufacturing",
    "Consulting",
    "Media & Entertainment",
    "Other"
];

const DropdownSelector = ({ label, value, options, onChange, allowOther, otherValue, onOtherChange, theme }: any) => {
    const [visible, setVisible] = useState(false);
    return (
        <View style={{ marginBottom: 12 }}>
            <Menu
                visible={visible}
                onDismiss={() => setVisible(false)}
                anchor={
                    <TouchableOpacity onPress={() => setVisible(true)}>
                        <View pointerEvents="none">
                            <TextInput
                                mode="outlined"
                                label={label}
                                value={value}
                                right={<TextInput.Icon icon="menu-down" />}
                                editable={false}
                                style={{ backgroundColor: theme.dark ? '#151515' : theme.colors.surfaceVariant }}
                            />
                        </View>
                    </TouchableOpacity>
                }
                contentStyle={{ backgroundColor: theme.colors.surface }}
            >
                <ScrollView style={{ maxHeight: 250 }}>
                    {options.map((opt: string) => (
                        <Menu.Item key={opt} title={opt} onPress={() => { onChange(opt); setVisible(false); }} />
                    ))}
                </ScrollView>
            </Menu>
            {allowOther && value === 'Other' && (
                <TextInput
                    mode="outlined"
                    label={`Specify ${label}`}
                    value={otherValue}
                    onChangeText={onOtherChange}
                    style={{ marginTop: 8, backgroundColor: theme.dark ? '#151515' : theme.colors.surfaceVariant }}
                />
            )}
        </View>
    );
};

export default function OnboardingScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { userProfile, setUserProfile } = useProfileStore();
    const recaptchaVerifier = React.useRef(null);

    // Field States
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    
    const [currentJobTitle, setCurrentJobTitle] = useState('');
    const [targetJobTitle, setTargetJobTitle] = useState('');
    const [industry, setIndustry] = useState('');
    
    // Explicit custom "Other" fields
    const [currentJobTitleOther, setCurrentJobTitleOther] = useState('');
    const [targetJobTitleOther, setTargetJobTitleOther] = useState('');
    const [industryOther, setIndustryOther] = useState('');
    
    const [experienceLevel, setExperienceLevel] = useState<'entry' | 'mid' | 'senior' | 'executive'>('mid');
    const [linkedInUrl, setLinkedInUrl] = useState('');
    
    // UI States
    const [loading, setLoading] = useState(false);
    const [isRoadmapLoading, setIsRoadmapLoading] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [isAccordionExpanded, setIsAccordionExpanded] = useState(false);

    // Phone Verification States
    const [verificationStep, setVerificationStep] = useState<'idle' | 'sending' | 'pending'>('idle');
    const [verificationCode, setVerificationCode] = useState('');
    const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
    const [isPhoneVerified, setIsPhoneVerified] = useState(false);
    
    // Country Code State
    const [selectedCountry, setSelectedCountry] = useState<CountryCallingCode>(
        COUNTRY_CALLING_CODES.find(c => phone.startsWith(c.code)) ||
        COUNTRY_CALLING_CODES.find(c => c.iso === 'US') ||
        COUNTRY_CALLING_CODES[0]
    );

    // Initial Population
    useEffect(() => {
        if (userProfile) {
            setFirstName(userProfile.firstName || '');
            setLastName(userProfile.lastName || '');
            setEmail(userProfile.email || '');
            setPhone(userProfile.phoneNumber || '');
            
            if (userProfile.jobTitle) {
                if (!JOB_TITLES.includes(userProfile.jobTitle)) {
                    setCurrentJobTitle('Other');
                    setCurrentJobTitleOther(userProfile.jobTitle);
                } else {
                    setCurrentJobTitle(userProfile.jobTitle);
                }
            }
            if (userProfile.targetJobTitle) {
                if (!JOB_TITLES.includes(userProfile.targetJobTitle)) {
                    setTargetJobTitle('Other');
                    setTargetJobTitleOther(userProfile.targetJobTitle);
                } else {
                    setTargetJobTitle(userProfile.targetJobTitle);
                }
            }
            const savedIndustry = userProfile.targetIndustry || userProfile.industry || '';
            if (savedIndustry) {
                if (!INDUSTRIES.includes(savedIndustry)) {
                    setIndustry('Other');
                    setIndustryOther(savedIndustry);
                } else {
                    setIndustry(savedIndustry);
                }
            }

            if (userProfile.experienceLevel) setExperienceLevel(userProfile.experienceLevel as any);
            setLinkedInUrl(userProfile.linkedInUrl || '');
            setIsPhoneVerified(userProfile.phoneVerified || false);
        }
    }, [userProfile]);

    const isPhoneAuth = userProfile?.provider === 'phone';
    const isEmailOrSocialAuth = !isPhoneAuth;

    const handleSendPhoneOTP = async () => {
        if (!phone || phone.length < 7) {
            Alert.alert("Error", "Please enter a valid phone number.");
            return;
        }

        setVerificationStep('sending');
        try {
            let formattedNumber = phone.replace(/\s+/g, '').replace(/-/g, '').replace(/\(|\)/g, '');
            // Build the final number with the selected country code
            const cleanNumber = formattedNumber.startsWith('+') ? formattedNumber : `${selectedCountry.code}${formattedNumber}`;

            const exists = await userService.checkPhoneExists(cleanNumber);
            if (exists?.exists && cleanNumber !== userProfile?.phoneNumber) {
                Alert.alert("Error", "This phone number is already registered with another user.");
                setVerificationStep('idle');
                return;
            }

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
                            setIsExiting(true);
                            try {
                                const functions = await getFirebaseFunctions();
                                const sendExitEmail = httpsCallable(functions, 'sendOnboardingExitEmail');
                                await sendExitEmail({ 
                                    email: email.trim() || undefined,
                                    phone: phone.trim() || userProfile?.phoneNumber || undefined,
                                    provider: userProfile?.provider || undefined,
                                    firstName: firstName.trim() || undefined,
                                    lastName: lastName.trim() || undefined,
                                });
                            } catch (emailError) {
                                console.warn("Could not send onboarding exit email:", emailError);
                            }

                            if (userProfile?.uid) {
                                await userService.hardDeleteAccount(userProfile.uid);
                            }
                            
                            try {
                                await authService.deleteUser();
                            } catch (authError: any) {
                                console.warn("Could not delete Auth user (requires recent login), but Firestore cleaned up:", authError);
                                if (authError.code === 'auth/requires-recent-login') {
                                    Alert.alert(
                                        "Account Permanently Deleted",
                                        "Your profile data was completely removed. For your security, your login session was too old to fully delete the structural account, but you have been logged out safely."
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
                            setIsExiting(false);
                        }
                    }
                }
            ]
        );
    };
    const handleGenerateFreeRoadmap = async () => {
        setIsRoadmapLoading(true);
        try {
            const { httpsCallable } = await import('firebase/functions');
            const { getFirebaseFunctions } = await import('../../src/services/firebase/config');
            const functions = await getFirebaseFunctions();
            const generateFunc = httpsCallable(functions, 'generateFreeOnboardingRoadmapV1');
            
            await generateFunc({
                currentJob: currentJobTitle === 'Other' ? currentJobTitleOther : currentJobTitle,
                targetJob: targetJobTitle === 'Other' ? targetJobTitleOther : targetJobTitle,
                industry: industry === 'Other' ? industryOther : industry,
                expLevel: experienceLevel
            });
            
            Alert.alert("Success! 🚀", "Your free personalized career roadmap has been generated and sent to your email.");
        } catch (error: any) {
            if (error?.message?.includes('already been sent')) {
                Alert.alert("Notice", "You have already claimed your free career roadmap.");
            } else {
                Alert.alert("Generation Failed", error.message || "An error occurred while generating career guidance.");
            }
        } finally {
            setIsRoadmapLoading(false);
        }
    };

    const handleSkipOrSave = async () => {
        if (!userProfile?.uid) return;
        setLoading(true);
        try {
            const updates: Partial<UserProfile> = {
                firstName: firstName.trim() || userProfile.firstName,
                lastName: lastName.trim() || userProfile.lastName,
                displayName: `${firstName} ${lastName}`.trim() || userProfile.displayName,
                email: email.trim() || userProfile.email,
                phoneNumber: phone.trim() ? (phone.startsWith('+') ? phone.trim() : `${selectedCountry.code}${phone.trim()}`) : userProfile.phoneNumber,
                jobTitle: currentJobTitle === 'Other' ? currentJobTitleOther.trim() : currentJobTitle,
                targetJobTitle: targetJobTitle === 'Other' ? targetJobTitleOther.trim() : targetJobTitle,
                targetIndustry: industry === 'Other' ? industryOther.trim() : industry,
                experienceLevel: experienceLevel,
                linkedInUrl: linkedInUrl,
                profileCompleted: true,
                profileCompletedAt: userProfile.profileCompletedAt || new Date()
            };

            await userService.updateProfile(userProfile.uid, updates);
            setUserProfile({ ...userProfile, ...updates });
            router.replace('/(tabs)/home' as any);
        } catch (error: any) {
            console.error("Onboarding Save Error:", error);
            Alert.alert("Error", "Failed to finalize account setup.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: theme.colors.background }}
        >
            <RecaptchaVerifierModal
                ref={recaptchaVerifier}
                getApp={getFirebaseApp}
                title="Verify you are human"
                cancelLabel="Close"
            />

            {isExiting && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 30 }]}>
                    <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginBottom: 24 }} />
                    <Text variant="titleLarge" style={{ fontWeight: 'bold', textAlign: 'center', marginBottom: 12 }}>
                        Securely deleting your profile...
                    </Text>
                    <Text variant="bodyMedium" style={{ textAlign: 'center', opacity: 0.7 }}>
                        Please wait while your personal information is permanently removed from our systems.
                    </Text>
                </View>
            )}

            <ScrollView contentContainerStyle={styles.container} style={{ backgroundColor: theme.colors.background }}>
                {/* Header Actions */}
                <View style={styles.navHeader}>
                    <View />
                    <Button
                        icon="exit-to-app"
                        mode="text"
                        onPress={handleExit}
                        textColor={theme.colors.error}
                    >Exit</Button>
                </View>

                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <Chip style={styles.chip} icon="star-four-points-outline" selectedColor={theme.colors.primary}>
                        FREE TO GET STARTED
                    </Chip>
                    <Text style={styles.heroTitleMain}>Beat the bots.</Text>
                    <Text style={[styles.heroTitleSub, { color: theme.colors.primary }]}>Land the interview.</Text>
                    
                    <Text style={styles.heroDescription}>
                        RiResume's AI rewrites your resume so it clears ATS filters and reaches real hiring managers. No credit card needed to get started.
                    </Text>

                    <View style={[styles.featuresCard, { backgroundColor: theme.colors.surfaceVariant }]}>
                        <View style={styles.featureRow}>
                            <MaterialCommunityIcons name="check-circle-outline" size={20} color={theme.colors.primary} />
                            <Text style={styles.featureText}>🎁 Free tokens on signup</Text>
                        </View>
                        <View style={styles.featureRow}>
                            <MaterialCommunityIcons name="check-circle-outline" size={20} color={theme.colors.primary} />
                            <Text style={styles.featureText}>🚫 No credit card required</Text>
                        </View>
                        <View style={styles.featureRow}>
                            <MaterialCommunityIcons name="check-circle-outline" size={20} color={theme.colors.primary} />
                            <Text style={styles.featureText}>🔒 Your data stays private</Text>
                        </View>
                    </View>

                    <Button 
                        mode="contained" 
                        onPress={handleSkipOrSave} 
                        style={styles.mainCTA}
                        labelStyle={{ fontSize: 16, fontWeight: 'bold', paddingVertical: 4 }}
                        loading={loading && !isExiting}
                        disabled={loading || isExiting}
                    >
                        Get Started Free ➔
                    </Button>
                    <Text style={styles.ctaSubtext}>Takes 30 seconds • No credit card required</Text>
                </View>

                {/* Profile Personalization Accordion */}
                <View style={styles.personalizeSection}>
                    <Text variant="titleMedium" style={styles.personalizeTitle}>Personalize Your Experience</Text>
                    <Text variant="bodyMedium" style={{ marginBottom: 16, opacity: 0.8 }}>
                        Fill up the below details to receive a personalized career roadmap completely FREE.
                    </Text>
                    
                    <List.Accordion
                        title="Set up profile"
                        description="Better AI results with a few details"
                        expanded={isAccordionExpanded}
                        onPress={() => setIsAccordionExpanded(!isAccordionExpanded)}
                        style={[styles.accordionHeader, { backgroundColor: theme.colors.surfaceVariant }]}
                        titleStyle={styles.accordionTitle}
                        descriptionStyle={styles.accordionDesc}
                    >
                        <View style={[styles.formContainer, { backgroundColor: theme.dark ? '#151515' : theme.colors.surfaceVariant }]}>
                            <Text style={styles.formContextText}>All fields optional — add what you like</Text>

                            {/* Contact Info (Read-only depending on auth type) */}
                            <View style={styles.contactSection}>
                                <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                                    <TextInput
                                        mode="outlined"
                                        label="First Name"
                                        value={firstName}
                                        style={[styles.input, { flex: 1, backgroundColor: theme.dark ? '#151515' : theme.colors.surfaceVariant }]}
                                        disabled={true}
                                    />
                                    <TextInput
                                        mode="outlined"
                                        label="Last Name"
                                        value={lastName}
                                        style={[styles.input, { flex: 1, backgroundColor: theme.dark ? '#151515' : theme.colors.surfaceVariant }]}
                                        disabled={true}
                                    />
                                </View>
                                
                                <TextInput
                                    mode="outlined"
                                    label="Email"
                                    value={email}
                                    style={[styles.input, { backgroundColor: theme.dark ? '#151515' : theme.colors.surfaceVariant }]}
                                    disabled={true}
                                    right={isEmailOrSocialAuth ? <TextInput.Icon icon="check-decagram" color={theme.colors.primary} /> : null}
                                />

                                <View style={{ gap: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <CountryCodeSelector
                                            selectedCountry={selectedCountry}
                                            onSelect={setSelectedCountry}
                                            disabled={isPhoneAuth}
                                        />
                                        <TextInput
                                            mode="outlined"
                                            label="Phone Number"
                                            value={phone}
                                            onChangeText={(text) => {
                                                const cleanText = text.replace(/[^0-9]/g, '');
                                                setPhone(cleanText);
                                                if (userProfile?.phoneNumber && cleanText !== userProfile.phoneNumber) {
                                                    setIsPhoneVerified(false);
                                                }
                                            }}
                                            style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: theme.dark ? '#151515' : theme.colors.surfaceVariant }]}
                                            disabled={isPhoneAuth}
                                            placeholder="5550000000"
                                            keyboardType="phone-pad"
                                        />
                                        {isPhoneVerified ? (
                                            <MaterialCommunityIcons name="check-decagram" size={24} color={theme.colors.primary} />
                                        ) : (
                                            phone && !isPhoneAuth && (
                                                <Button 
                                                    mode="text" 
                                                    onPress={handleSendPhoneOTP} 
                                                    disabled={verificationStep === 'sending' || verificationStep === 'pending'}
                                                >
                                                    Verify
                                                </Button>
                                            )
                                        )}
                                    </View>
                                    
                                    {verificationStep === 'pending' && !isPhoneVerified && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                            <TextInput
                                                mode="outlined"
                                                label="6-Digit OTP"
                                                value={verificationCode}
                                                onChangeText={(text) => setVerificationCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
                                                keyboardType="number-pad"
                                                style={{ flex: 1, height: 44, backgroundColor: theme.dark ? '#151515' : theme.colors.surfaceVariant }}
                                                maxLength={6}
                                            />
                                            <Button mode="contained-tonal" onPress={handleVerifyPhoneOTP} disabled={verificationCode.length !== 6 || loading}>
                                                Confirm
                                            </Button>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Optional Details */}
                            <Text style={styles.labelSectionTitle}>EXPERIENCE LEVEL <Text style={styles.optionalText}>optional</Text></Text>
                            <View style={styles.chipRow}>
                                {['entry', 'mid', 'senior', 'executive'].map((level) => (
                                    <Chip
                                        key={level}
                                        selected={experienceLevel === level}
                                        onPress={() => setExperienceLevel(level as any)}
                                        style={[
                                            styles.experienceChip,
                                            experienceLevel === level && { backgroundColor: theme.colors.primaryContainer }
                                        ]}
                                        textStyle={{ textTransform: 'capitalize' }}
                                    >
                                        {level}
                                    </Chip>
                                ))}
                            </View>

                            <DropdownSelector
                                label="Target Role (optional)"
                                value={targetJobTitle}
                                options={JOB_TITLES}
                                onChange={setTargetJobTitle}
                                allowOther={true}
                                otherValue={targetJobTitleOther}
                                onOtherChange={setTargetJobTitleOther}
                                theme={theme}
                            />

                            <DropdownSelector
                                label="Current Job Title (optional)"
                                value={currentJobTitle}
                                options={JOB_TITLES}
                                onChange={setCurrentJobTitle}
                                allowOther={true}
                                otherValue={currentJobTitleOther}
                                onOtherChange={setCurrentJobTitleOther}
                                theme={theme}
                            />

                            <DropdownSelector
                                label="Target Industry (optional)"
                                value={industry}
                                options={INDUSTRIES}
                                onChange={setIndustry}
                                allowOther={true}
                                otherValue={industryOther}
                                onOtherChange={setIndustryOther}
                                theme={theme}
                            />

                            <TextInput
                                mode="outlined"
                                label="LinkedIn URL (optional)"
                                placeholder="https://linkedin.com/in/yourname"
                                value={linkedInUrl}
                                onChangeText={setLinkedInUrl}
                                style={styles.input}
                                keyboardType="url"
                                autoCapitalize="none"
                            />
                            
                            <View style={{ marginBottom: 20 }}>
                                <Button
                                    mode="text"
                                    icon="magic-staff"
                                    onPress={handleGenerateFreeRoadmap}
                                    disabled={!targetJobTitle || !currentJobTitle || !industry || isRoadmapLoading}
                                    loading={isRoadmapLoading}
                                    textColor={theme.colors.primary}
                                >
                                    FREE Career Guidance - Click Now !
                                </Button>
                                {(!targetJobTitle || !currentJobTitle || !industry) && (
                                    <HelperText type="info" visible style={{ textAlign: 'center', marginTop: -5 }}>
                                        Fill in Target Role, Current Job, and Industry to unlock
                                    </HelperText>
                                )}
                            </View>
                            
                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 20 }}>
                                <Button 
                                    mode="outlined" 
                                    onPress={handleSkipOrSave}
                                    style={{ flex: 1 }}
                                >
                                    Skip for Now
                                </Button>
                                <Button 
                                    mode="contained" 
                                    onPress={handleSkipOrSave}
                                    style={{ flex: 1 }}
                                >
                                    Save Profile
                                </Button>
                            </View>
                        </View>
                    </List.Accordion>
                </View>

                {/* Footer Legal */}
                <View style={styles.footerContainer}>
                    <Text style={styles.footerText}>
                        By continuing you agree to our <Text 
                            style={[styles.footerLink, { color: theme.colors.primary }]}
                            onPress={() => Linking.openURL('https://www.riresume.com/settings/terms')}
                        >Terms of Service</Text> and <Text 
                            style={[styles.footerLink, { color: theme.colors.primary }]}
                            onPress={() => Linking.openURL('https://www.riresume.com/settings/privacy')}
                        >Privacy Policy</Text>.
                    </Text>
                    <Text style={styles.footerText}>
                        You can update your profile anytime from Settings.
                    </Text>
                </View>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    navHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 10 : 20,
    },
    heroSection: {
        marginTop: 10,
        marginBottom: 30,
        alignItems: 'flex-start',
    },
    chip: {
        marginBottom: 16,
        alignSelf: 'flex-start',
    },
    heroTitleMain: {
        fontSize: 36,
        fontWeight: '900',
        letterSpacing: -0.5,
        lineHeight: 42,
    },
    heroTitleSub: {
        fontSize: 36,
        fontWeight: '900',
        letterSpacing: -0.5,
        lineHeight: 42,
        marginBottom: 12,
    },
    heroDescription: {
        fontSize: 16,
        opacity: 0.8,
        lineHeight: 24,
        marginBottom: 24,
    },
    featuresCard: {
        backgroundColor: '#1C1C1E', // Darker elegant block
        borderRadius: 16,
        padding: 20,
        width: '100%',
        marginBottom: 24,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    featureText: {
        marginLeft: 12,
        fontSize: 15,
        fontWeight: '500',
    },
    mainCTA: {
        width: '100%',
        borderRadius: 30,
        paddingVertical: 4,
        marginBottom: 12,
    },
    ctaSubtext: {
        fontSize: 12,
        opacity: 0.5,
        alignSelf: 'center',
    },
    personalizeSection: {
        width: '100%',
        marginBottom: 40,
    },
    personalizeTitle: {
        fontWeight: 'bold',
        marginBottom: 12,
    },
    accordionHeader: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
    },
    accordionTitle: {
        fontWeight: 'bold',
    },
    accordionDesc: {
        opacity: 0.6,
        fontSize: 12,
    },
    formContainer: {
        paddingHorizontal: 16,
        backgroundColor: '#151515',
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        paddingBottom: 16,
    },
    formContextText: {
        opacity: 0.5,
        fontSize: 12,
        marginBottom: 16,
        marginTop: 8,
    },
    contactSection: {
        marginBottom: 24,
        gap: 12,
    },
    input: {
        marginBottom: 12,
    },
    labelSectionTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        opacity: 0.7,
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    optionalText: {
        fontWeight: 'normal',
        opacity: 0.5,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 20,
    },
    experienceChip: {
        borderRadius: 8,
    },
    footerContainer: {
        alignItems: 'center',
        marginTop: 'auto',
    },
    footerText: {
        fontSize: 12,
        opacity: 0.5,
        textAlign: 'center',
        marginBottom: 4,
    },
    footerLink: {
        fontWeight: 'bold',
    }
});
