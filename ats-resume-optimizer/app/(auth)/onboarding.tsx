import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, useTheme, Chip, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useProfileStore } from '../../src/store/profileStore';
import { userService } from '../../src/services/firebase/userService';
import { UserProfile } from '../../src/types/profile.types';

import { authService } from '../../src/services/firebase/authService';

export default function OnboardingScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { userProfile, setUserProfile } = useProfileStore();

    // ... state ...
    const [firstName, setFirstName] = useState(userProfile?.firstName || '');
    const [lastName, setLastName] = useState(userProfile?.lastName || '');
    const [currentJobTitle, setCurrentJobTitle] = useState('');
    const [targetJobTitle, setTargetJobTitle] = useState('');
    const [industry, setIndustry] = useState(''); // Target Industry
    const [experienceLevel, setExperienceLevel] = useState<'entry' | 'mid' | 'senior' | 'executive'>('mid');
    const [linkedInUrl, setLinkedInUrl] = useState('');
    const [loading, setLoading] = useState(false);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            // Fallback if no history (e.g. direct nav)
            Alert.alert("Notice", "Cannot go back from here.");
        }
    };

    const handleExit = async () => {
        try {
            await authService.logout();
            setUserProfile(null);
            router.replace('/(auth)/sign-in' as any);
        } catch (error) {
            console.error(error);
            router.replace('/(auth)/sign-in' as any);
        }
    };

    const handleComplete = async () => {
        // Enforce First/Last Name if they were missing (e.g. Phone Auth)
        if (!firstName.trim() || !lastName.trim()) {
            Alert.alert("Missing Information", "Please enter your First and Last Name.");
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
                jobTitle: currentJobTitle,
                targetJobTitle: targetJobTitle,
                targetIndustry: industry,
                experienceLevel: experienceLevel,
                linkedInUrl: linkedInUrl,
                profileCompleted: true,
                profileCompletedAt: new Date()
            };

            await userService.updateProfile(userProfile.uid, updates);

            // Update local store immediately to trigger navigation guard
            setUserProfile({ ...userProfile, ...updates });

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
            <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background }]}>
                {/* Navigation Header */}
                <View style={styles.navHeader}>
                    <Button
                        icon="arrow-left"
                        mode="text"
                        onPress={handleBack}
                        contentStyle={{ justifyContent: 'flex-start' }}
                    >
                        Back
                    </Button>
                    <Button
                        icon="exit-to-app"
                        mode="text"
                        onPress={handleExit}
                        textColor={theme.colors.error}
                    >
                        Exit
                    </Button>
                </View>

                <View style={styles.header}>
                    <Text variant="displaySmall" style={styles.title}>Tell us about you</Text>
                    <Text variant="bodyLarge" style={styles.subtitle}>
                        This helps our AI tailor your resume and gap analysis efficiently.
                    </Text>
                </View>

                <View style={styles.form}>
                    {/* Name Inputs (Only if missing) */}
                    {showNameInput && (
                        <View style={styles.section}>
                            <Text variant="titleMedium" style={{ marginBottom: 8, fontWeight: 'bold' }}>
                                Your Name *
                            </Text>
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
                            <HelperText type="info">Required for your profile.</HelperText>
                        </View>
                    )}

                    {/* Target Role - Most Important */}
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={{ marginBottom: 8, fontWeight: 'bold' }}>
                            What is your Target Role? *
                        </Text>
                        <TextInput
                            mode="outlined"
                            placeholder="e.g. Senior Full Stack Engineer"
                            value={targetJobTitle}
                            onChangeText={setTargetJobTitle}
                            style={styles.input}
                        />
                        <HelperText type="info">The job you want to get.</HelperText>
                    </View>

                    {/* Current Role */}
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={{ marginBottom: 8 }}>
                            Current Job Title
                        </Text>
                        <TextInput
                            mode="outlined"
                            placeholder="e.g. Junior Developer"
                            value={currentJobTitle}
                            onChangeText={setCurrentJobTitle}
                            style={styles.input}
                        />
                        <HelperText type="info">Where you are starting from.</HelperText>
                    </View>

                    {/* Experience Level */}
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={{ marginBottom: 8 }}>
                            Experience Level *
                        </Text>
                        <View style={styles.chipContainer}>
                            {(['entry', 'mid', 'senior', 'executive'] as const).map((level) => (
                                <Chip
                                    key={level}
                                    mode={experienceLevel === level ? 'flat' : 'outlined'}
                                    selected={experienceLevel === level}
                                    onPress={() => setExperienceLevel(level)}
                                    style={styles.chip}
                                    showSelectedOverlay
                                >
                                    {level.charAt(0).toUpperCase() + level.slice(1)}
                                </Chip>
                            ))}
                        </View>
                    </View>

                    {/* Target Industry */}
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={{ marginBottom: 8 }}>
                            Target Industry *
                        </Text>
                        <TextInput
                            mode="outlined"
                            placeholder="e.g. Tech, Finance, Healthcare"
                            value={industry}
                            onChangeText={setIndustry}
                            style={styles.input}
                        />
                    </View>

                    {/* LinkedIn URL */}
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={{ marginBottom: 8 }}>
                            LinkedIn URL (Optional)
                        </Text>
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
                        <HelperText type="info">We can use this to fetch your details later.</HelperText>
                    </View>

                    <Button
                        mode="contained"
                        onPress={handleComplete}
                        loading={loading}
                        disabled={loading}
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
        // Move negative margin to pull it up into the padding area if desired, 
        // but simple spacing is safer.
    }
});
