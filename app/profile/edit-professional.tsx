import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, Keyboard, TouchableOpacity, Text } from 'react-native';
import { TextInput, Button, useTheme, Appbar, List, Menu, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useProfileStore } from '../../src/store/profileStore';
import { userService } from '../../src/services/firebase/userService';

export default function EditProfessionalDetailsScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { userProfile, refreshProfile } = useProfileStore();

    const [jobTitle, setJobTitle] = useState(userProfile?.jobTitle || '');
    const [currentOrganization, setCurrentOrganization] = useState(userProfile?.currentOrganization || '');
    const [targetJobTitle, setTargetJobTitle] = useState(userProfile?.targetJobTitle || '');
    const [yearsOfExperience, setYearsOfExperience] = useState(userProfile?.yearsOfExperience || '');
    const [industry, setIndustry] = useState(userProfile?.industry || '');
    const [targetIndustry, setTargetIndustry] = useState(userProfile?.targetIndustry || '');
    const [primaryGoal, setPrimaryGoal] = useState(userProfile?.primaryGoal || '');

    // Dropdown State
    const [showLevelMenu, setShowLevelMenu] = useState(false);
    const [experienceLevel, setExperienceLevel] = useState(userProfile?.experienceLevel || 'mid');

    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!userProfile) return;
        setLoading(true);

        try {
            const updates: any = {
                jobTitle,
                currentOrganization,
                targetJobTitle,
                yearsOfExperience, // Keep as string for flexibility or parse if needed
                experienceLevel,
                industry,
                targetIndustry,
                primaryGoal
            };

            await userService.updateProfile(userProfile.uid, updates);
            await refreshProfile();
            Alert.alert("Success", "Professional details updated.");
            router.back();

        } catch (error: any) {
            console.error("Save Error:", error);
            Alert.alert("Error", "Failed to save details.");
        } finally {
            setLoading(false);
        }
    };

    const levels = [
        { label: 'Entry Level', value: 'entry' },
        { label: 'Mid Level', value: 'mid' },
        { label: 'Senior Level', value: 'senior' },
        { label: 'Executive', value: 'executive' },
    ];

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <Appbar.Header>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title="Professional Details" />
                <Appbar.Action icon="check" onPress={handleSave} disabled={loading} />
            </Appbar.Header>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.container}
                    keyboardShouldPersistTaps="handled"
                >

                    <List.Section title="Current Role">
                        <TextInput
                            label="Current Job Title"
                            value={jobTitle}
                            onChangeText={setJobTitle}
                            style={[styles.input, { backgroundColor: theme.colors.surface }]}
                            mode="outlined"
                        />
                        <TextInput
                            label="Current Organization"
                            value={currentOrganization}
                            onChangeText={setCurrentOrganization}
                            style={[styles.input, { backgroundColor: theme.colors.surface }]}
                            mode="outlined"
                        />
                        <TextInput
                            label="Industry"
                            value={industry}
                            onChangeText={setIndustry}
                            style={[styles.input, { backgroundColor: theme.colors.surface }]}
                            mode="outlined"
                        />
                    </List.Section>

                    <List.Section title="Experience">
                        <TextInput
                            label="Years of Experience"
                            value={yearsOfExperience}
                            onChangeText={setYearsOfExperience}
                            style={[styles.input, { backgroundColor: theme.colors.surface }]}
                            mode="outlined"
                            keyboardType="numeric"
                        />

                        <TouchableOpacity
                            onPress={() => {
                                Keyboard.dismiss();
                                setShowLevelMenu(!showLevelMenu);
                            }}
                        >
                            <View pointerEvents="none">
                                <View style={[styles.input, styles.dropdownTrigger, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
                                    <Text style={{ fontSize: 16, color: theme.colors.onSurface }}>
                                        {levels.find(l => l.value === experienceLevel)?.label || 'Select Level'}
                                    </Text>
                                    <MaterialCommunityIcons name={showLevelMenu ? "chevron-up" : "chevron-down"} size={24} color={theme.colors.onSurfaceVariant} />
                                </View>
                                <View style={{ position: 'absolute', top: -10, left: 10, backgroundColor: theme.colors.background, paddingHorizontal: 4 }}>
                                    <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}>Experience Level</Text>
                                </View>
                            </View>
                        </TouchableOpacity>

                        {showLevelMenu && (
                            <View style={[styles.accordionContent, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
                                {levels.map((level) => (
                                    <TouchableOpacity
                                        key={level.value}
                                        style={[
                                            styles.accordionItem,
                                            { borderBottomColor: theme.colors.outlineVariant },
                                            experienceLevel === level.value && { backgroundColor: theme.colors.secondaryContainer }
                                        ]}
                                        onPress={() => {
                                            setExperienceLevel(level.value as any);
                                            setShowLevelMenu(false);
                                        }}
                                    >
                                        <Text style={{
                                            color: experienceLevel === level.value ? theme.colors.onSecondaryContainer : theme.colors.onSurface,
                                            fontWeight: experienceLevel === level.value ? 'bold' : 'normal'
                                        }}>
                                            {level.label}
                                        </Text>
                                        {experienceLevel === level.value && (
                                            <List.Icon icon="check" color={theme.colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </List.Section>

                    <List.Section title="Career Goals">
                        <TextInput
                            label="Target Job Title"
                            value={targetJobTitle}
                            onChangeText={setTargetJobTitle}
                            style={[styles.input, { backgroundColor: theme.colors.surface }]}
                            mode="outlined"
                        />
                        <TextInput
                            label="Target Industry"
                            value={targetIndustry}
                            onChangeText={setTargetIndustry}
                            style={[styles.input, { backgroundColor: theme.colors.surface }]}
                            mode="outlined"
                        />
                        <TextInput
                            label="Primary Goal"
                            value={primaryGoal}
                            onChangeText={setPrimaryGoal}
                            style={[styles.input, { minHeight: 80, backgroundColor: theme.colors.surface }]}
                            mode="outlined"
                            multiline
                            numberOfLines={3}
                            placeholder="e.g. Transition to product management..."
                        />
                    </List.Section>

                    <Button
                        mode="contained"
                        onPress={handleSave}
                        loading={loading}
                        style={styles.saveButton}
                    >
                        Save Professional Details
                    </Button>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        paddingBottom: 40,
    },
    input: {
        marginBottom: 12,
        // backgroundColor set dynamically
    },
    dropdownTrigger: {
        borderWidth: 1,
        // borderColor set dynamically
        borderRadius: 4,
    },
    saveButton: {
        marginTop: 24,
    },
    accordionContent: {
        // backgroundColor set dynamically
        borderWidth: 1,
        borderTopWidth: 0,
        // borderColor set dynamically
        borderBottomLeftRadius: 4,
        borderBottomRightRadius: 4,
        marginTop: -12, // Overlap slightly or just touch
        overflow: 'hidden',
    },
    accordionItem: {
        padding: 16,
        borderBottomWidth: 1,
        // borderBottomColor set dynamically
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    }
});
