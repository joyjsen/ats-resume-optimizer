import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, ProgressBar, useTheme, Avatar, Switch, List } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useProfileStore } from '../../src/store/profileStore';
import { locationService } from '../../src/services/locationService';
import { userService } from '../../src/services/firebase/userService';
import { auth } from '../../src/services/firebase/config';

export default function ProfileCompletionScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { userProfile, setUserProfile, refreshProfile } = useProfileStore();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [company, setCompany] = useState('');
    const [industry, setIndustry] = useState('');
    const [experience, setExperience] = useState('');
    const [locationEnabled, setLocationEnabled] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    useEffect(() => {
        if (userProfile) {
            setFirstName(userProfile.firstName || userProfile.displayName?.split(' ')[0] || '');
            setLastName(userProfile.lastName || userProfile.displayName?.split(' ').slice(1).join(' ') || '');
            setJobTitle(userProfile.jobTitle || '');
            setCompany(userProfile.currentOrganization || '');
        }
    }, [userProfile]);

    const handleNext = async () => {
        if (step === 1) {
            if (!firstName.trim() || !lastName.trim()) {
                Alert.alert("Required", "Please enter your first and last name.");
                return;
            }
            setStep(2);
        } else if (step === 2) {
            setStep(3);
        } else if (step === 3) {
            submitProfile();
        }
    };

    const toggleLocation = async (value: boolean) => {
        setLocationEnabled(value);
        if (value) {
            const hasPermission = await locationService.requestPermissions();
            if (!hasPermission) {
                Alert.alert("Permission Denied", "Please enable location in settings to use this feature.");
                setLocationEnabled(false);
            }
        }
    };

    const submitProfile = async () => {
        if (!auth.currentUser) return;
        setLoading(true);

        try {
            let locationData = undefined;
            if (locationEnabled) {
                locationData = await locationService.getCurrentLocation();
            }

            const updates: any = {
                firstName,
                lastName,
                displayName: `${firstName} ${lastName}`.trim(),
                jobTitle,
                currentOrganization: company,
                industry,
                yearsOfExperience: experience,
                location: locationData || null,
                locationTrackingEnabled: locationEnabled,
                notificationsEnabled,
                profileCompleted: true, // MARK AS COMPLETE
                profileCompletedAt: new Date()
            };

            await userService.updateProfile(auth.currentUser.uid, updates);
            await refreshProfile();

            // Navigate to Main App
            router.replace('/(tabs)/');

        } catch (error) {
            console.error("Profile Completion Error:", error);
            Alert.alert("Error", "Failed to save profile. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <View style={styles.container}>
                <ProgressBar progress={step / 3} color={theme.colors.primary} style={styles.progress} />

                <View style={styles.header}>
                    <Text variant="headlineMedium" style={styles.title}>
                        {step === 1 ? "Let's get to know you" :
                            step === 2 ? "Professional Profile" : "Preferences"}
                    </Text>
                    <Text variant="bodyMedium" style={styles.subtitle}>
                        Step {step} of 3
                    </Text>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {step === 1 && (
                        <>
                            <View style={styles.avatarContainer}>
                                {userProfile?.photoURL ? (
                                    <Avatar.Image size={80} source={{ uri: userProfile.photoURL }} />
                                ) : (
                                    <Avatar.Text size={80} label={firstName.charAt(0) || "U"} />
                                )}
                            </View>

                            <TextInput
                                label="First Name"
                                value={firstName}
                                onChangeText={setFirstName}
                                mode="outlined"
                                style={styles.input}
                            />
                            <TextInput
                                label="Last Name"
                                value={lastName}
                                onChangeText={setLastName}
                                mode="outlined"
                                style={styles.input}
                            />
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <TextInput
                                label="Current Job Title (Optional)"
                                value={jobTitle}
                                onChangeText={setJobTitle}
                                mode="outlined"
                                style={styles.input}
                            />
                            <TextInput
                                label="Current Company (Optional)"
                                value={company}
                                onChangeText={setCompany}
                                mode="outlined"
                                style={styles.input}
                            />
                            <TextInput
                                label="Industry"
                                value={industry}
                                onChangeText={setIndustry}
                                mode="outlined"
                                style={styles.input}
                                placeholder="e.g. Technology, Finance"
                            />
                            <TextInput
                                label="Years of Experience"
                                value={experience}
                                onChangeText={setExperience}
                                mode="outlined"
                                style={styles.input}
                                keyboardType="numeric"
                            />
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <List.Section>
                                <List.Subheader>Location Services</List.Subheader>
                                <List.Item
                                    title="Enable Location"
                                    description="Get local job insights (Optional)"
                                    right={() => <Switch value={locationEnabled} onValueChange={toggleLocation} />}
                                />
                            </List.Section>

                            <List.Section>
                                <List.Subheader>Notifications</List.Subheader>
                                <List.Item
                                    title="Push Notifications"
                                    description="Stay updated on optimization tasks"
                                    right={() => <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />}
                                />
                            </List.Section>
                        </>
                    )}
                </ScrollView>

                <View style={styles.footer}>
                    <Button
                        mode="contained"
                        onPress={handleNext}
                        loading={loading}
                        disabled={loading}
                        style={styles.button}
                    >
                        {step === 3 ? "Complete Profile" : "Continue"}
                    </Button>
                    {step > 1 && (
                        <Button mode="text" onPress={() => setStep(step - 1)} disabled={loading} style={styles.backButton}>
                            Back
                        </Button>
                    )}
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    progress: {
        height: 4,
    },
    header: {
        padding: 24,
        paddingBottom: 0,
    },
    title: {
        fontWeight: 'bold',
        marginBottom: 4,
    },
    subtitle: {
        color: '#666',
    },
    content: {
        padding: 24,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    input: {
        marginBottom: 16,
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    button: {
        paddingVertical: 6,
    },
    backButton: {
        marginTop: 8,
    }
});
