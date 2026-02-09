import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Text, Button, TextInput, useTheme, Appbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Linking, TouchableOpacity } from 'react-native';
import { IconButton } from 'react-native-paper';
import { FontAwesome6 } from '@expo/vector-icons';
import { useProfileStore } from '../src/store/profileStore';
import { useResumeStore } from '../src/store/resumeStore';

const TruthSocialIcon = ({ color }: { color: string }) => {
    const grayColor = '#A0A0A0'; // Matching the gray from the image
    return (
        <View style={{ width: 18, height: 18 }}>
            {/* Top Left Square */}
            <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 5,
                height: 5,
                backgroundColor: color
            }} />

            {/* Top Right Horizontal Bar */}
            <View style={{
                position: 'absolute',
                top: 0,
                left: 7,
                right: 0,
                height: 5,
                backgroundColor: color
            }} />

            {/* Main Vertical Bar */}
            <View style={{
                position: 'absolute',
                top: 0,
                left: 7,
                width: 5,
                bottom: 0,
                backgroundColor: color
            }} />

            {/* Bottom Right Square (Gray) */}
            <View style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 5,
                height: 5,
                backgroundColor: grayColor
            }} />
        </View>
    );
};

export default function LandingPage() {
    const theme = useTheme();
    const router = useRouter();
    const { userProfile } = useProfileStore();
    const { pendingSharedUrl, setPendingSharedUrl } = useResumeStore();
    const [jobUrl, setJobUrl] = useState('');

    // Sync with pending share URL from store (handled by root layout)
    useEffect(() => {
        if (pendingSharedUrl) {
            setJobUrl(pendingSharedUrl);
        }
    }, [pendingSharedUrl]);

    const handleStartNow = () => {
        if (userProfile) {
            // If already logged in, set as pending and go to analyze
            if (jobUrl) setPendingSharedUrl(jobUrl);
            setTimeout(() => router.replace('/(tabs)/analyze'), 0);
        } else {
            // If not logged in, stash the URL and go to sign-in
            if (jobUrl) setPendingSharedUrl(jobUrl);
            setTimeout(() => router.push('/(auth)/sign-in'), 0);
        }
    };

    const handleLogin = () => {
        setTimeout(() => router.push('/(auth)/sign-in'), 0);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={[styles.mainContainer, { backgroundColor: theme.colors.background }]}>
                    <Appbar.Header style={{ backgroundColor: 'transparent', elevation: 0 }}>
                        <View style={styles.headerContent}>
                            <View style={styles.logoContainer}>
                                <Image
                                    source={require('../assets/logo.png')}
                                    style={styles.logo}
                                    resizeMode="contain"
                                />
                                <Text variant="titleLarge" style={styles.logoText}>RiResume</Text>
                            </View>
                            {!userProfile && (
                                <Button mode="text" onPress={handleLogin} textColor={theme.colors.primary}>
                                    Log In
                                </Button>
                            )}
                        </View>
                    </Appbar.Header>

                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        <View style={styles.heroSection}>
                            <Text variant="displaySmall" style={styles.heroTitle}>
                                From Application to Interview in Days, Not Weeks
                            </Text>
                            <Text variant="bodyLarge" style={styles.heroSubtext}>
                                RiResume uses AI to perfectly tailor your resume and cover letter, bridge your skill gaps, and create custom interview guides—all designed to help you land your dream job faster.
                            </Text>
                        </View>

                        <View style={[styles.inputCard, { backgroundColor: theme.colors.elevation.level1 }]}>
                            <Text variant="titleMedium" style={styles.inputLabel}>
                                Ready to start? Paste a job link below
                            </Text>
                            <TextInput
                                mode="outlined"
                                placeholder="https://www.linkedin.com/jobs/view/..."
                                value={jobUrl}
                                onChangeText={setJobUrl}
                                multiline
                                numberOfLines={3}
                                style={styles.textArea}
                            />
                            <Button
                                mode="contained"
                                onPress={handleStartNow}
                                style={styles.startButton}
                                contentStyle={styles.startButtonContent}
                            >
                                Start Now
                            </Button>
                        </View>

                        <View style={styles.footer}>
                            <View style={styles.footerLinks}>
                                <TouchableOpacity onPress={() => Linking.openURL('https://trinationalnexus.com/support')}>
                                    <Text variant="labelMedium" style={styles.footerLink}>Help & Support</Text>
                                </TouchableOpacity>
                                <Text variant="labelMedium" style={styles.footerDivider}>•</Text>
                                <TouchableOpacity onPress={() => Linking.openURL('https://trinationalnexus.com/privacy')}>
                                    <Text variant="labelMedium" style={styles.footerLink}>Privacy Policy</Text>
                                </TouchableOpacity>
                                <Text variant="labelMedium" style={styles.footerDivider}>•</Text>
                                <TouchableOpacity onPress={() => Linking.openURL('https://trinationalnexus.com/terms')}>
                                    <Text variant="labelMedium" style={styles.footerLink}>Terms of Service</Text>
                                </TouchableOpacity>
                                <Text variant="labelMedium" style={styles.footerDivider}>•</Text>
                                <TouchableOpacity onPress={() => Linking.openURL('https://trinationalnexus.com/blog')}>
                                    <Text variant="labelMedium" style={styles.footerLink}>Blog</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.socialContainer}>
                                <TouchableOpacity onPress={() => { }} style={styles.socialIcon}>
                                    <FontAwesome6 name="facebook" size={18} color={theme.colors.onSurface} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { }} style={styles.socialIcon}>
                                    <FontAwesome6 name="instagram" size={18} color={theme.colors.onSurface} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { }} style={styles.socialIcon}>
                                    <FontAwesome6 name="x-twitter" size={18} color={theme.colors.onSurface} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { }} style={styles.socialIcon}>
                                    <FontAwesome6 name="threads" size={18} color={theme.colors.onSurface} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { }} style={styles.socialIcon}>
                                    <FontAwesome6 name="tiktok" size={18} color={theme.colors.onSurface} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { }} style={styles.socialIcon}>
                                    <FontAwesome6 name="linkedin" size={18} color={theme.colors.onSurface} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { }} style={styles.socialIcon}>
                                    <TruthSocialIcon color={theme.colors.onSurface} />
                                </TouchableOpacity>
                            </View>

                            <Text variant="labelSmall" style={styles.copyright}>
                                © 2026 TriNational Nexus LLC. All Rights Reserved.
                            </Text>
                        </View>
                    </ScrollView>
                </View>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
    },
    headerContent: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logo: {
        width: 32,
        height: 32,
        marginRight: 8,
    },
    logoText: {
        fontWeight: 'bold',
    },
    scrollContent: {
        padding: 24,
        paddingTop: 40,
        paddingBottom: 60,
    },
    heroSection: {
        marginBottom: 40,
    },
    heroTitle: {
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
        lineHeight: 44,
    },
    heroSubtext: {
        textAlign: 'center',
        opacity: 0.8,
        lineHeight: 24,
    },
    inputCard: {
        padding: 24,
        borderRadius: 16,
        gap: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    inputLabel: {
        textAlign: 'center',
        fontWeight: '600',
    },
    textArea: {
        minHeight: 80,
    },
    startButton: {
        marginTop: 8,
        borderRadius: 8,
    },
    startButtonContent: {
        height: 48,
    },
    footer: {
        marginTop: 48,
        alignItems: 'center',
        gap: 16,
    },
    footerLinks: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    footerLink: {
        opacity: 0.6,
        textDecorationLine: 'underline',
    },
    footerDivider: {
        opacity: 0.3,
    },
    socialContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0.7,
        gap: 4,
    },
    socialIcon: {
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    copyright: {
        opacity: 0.5,
        textAlign: 'center',
        marginTop: 8,
    },
});
