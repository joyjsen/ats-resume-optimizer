import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Text, Button, TextInput, useTheme, Appbar, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Linking, TouchableOpacity } from 'react-native';
import { IconButton } from 'react-native-paper';
import { FontAwesome6 } from '@expo/vector-icons';
import { useProfileStore } from '../src/store/profileStore';
import { useResumeStore } from '../src/store/resumeStore';
import { horizontalScale, verticalScale, moderateScale, scaleFont } from '../src/utils/responsive';
import { ThemeToggle } from '../src/components/common/ThemeToggle';
import { useAppTheme } from '../src/context/ThemeContext';
import Svg, { Path } from 'react-native-svg';

// BlueSky butterfly icon — filled in dark mode, outline in light mode
const BlueSkyIcon = ({ color, isDark, size = 18 }: { color: string; isDark: boolean; size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 568 501" fill="none">
        {isDark ? (
            // Filled silhouette (dark mode)
            <Path
                fill={color}
                d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.209C491.866-1.611 568-28.906 568 57.947c0 17.346-9.945 145.713-15.781 166.555-20.275 72.453-94.155 90.933-159.875 79.748C507.907 325.135 527.667 370.333 488 398c-73.631 52.548-141.131-13.148-159.883-63.051-2.976-8.087-4.374-11.831-4.117-11.831.258 0-.918 3.978-4.117 11.831C301.131 384.852 233.631 450.548 160 398c-39.667-27.667-19.907-72.865 95.656-93.75-65.72 11.185-139.6-7.295-159.875-79.748C89.945 203.66 80 75.293 80 57.947c0-86.853 76.134-59.558 43.121-24.283z"
            />
        ) : (
            // Outline stroke (light mode)
            <Path
                stroke={color}
                strokeWidth="36"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.209C491.866-1.611 568-28.906 568 57.947c0 17.346-9.945 145.713-15.781 166.555-20.275 72.453-94.155 90.933-159.875 79.748C507.907 325.135 527.667 370.333 488 398c-73.631 52.548-141.131-13.148-159.883-63.051-2.976-8.087-4.374-11.831-4.117-11.831.258 0-.918 3.978-4.117 11.831C301.131 384.852 233.631 450.548 160 398c-39.667-27.667-19.907-72.865 95.656-93.75-65.72 11.185-139.6-7.295-159.875-79.748C89.945 203.66 80 75.293 80 57.947c0-86.853 76.134-59.558 43.121-24.283z"
            />
        )}
    </Svg>
);

const TruthSocialIcon = ({ color }: { color: string }) => {
    const grayColor = '#A0A0A0'; // Matching the gray from the image
    return (
        <View style={{ width: moderateScale(18), height: moderateScale(18) }}>
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
    const { isDark } = useAppTheme();
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

    // Handle Apple Auth Relay for Android
    useEffect(() => {
        if (Platform.OS === 'web') {
            const hash = window.location.hash;
            if (hash && hash.includes('id_token=')) {
                // We've received an ID token from Apple. Redirect back to the native app.
                // Format: riresume://apple-auth#id_token=...
                const appUrl = `riresume://apple-auth${hash}`;
                console.log("[Apple Relay] Redirecting to:", appUrl);
                window.location.href = appUrl;
            }
        }
    }, []);

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
            <View style={[styles.mainContainer, { backgroundColor: theme.colors.background }]}>
                {/* Auth transition overlay — blocks all interaction while routing to onboarding/home */}
                {userProfile && (
                    <View style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: theme.colors.background,
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 999,
                    }}>
                        <Image
                            source={require('../assets/logo.png')}
                            style={{ width: 80, height: 80, marginBottom: 24, borderRadius: 40 }}
                            resizeMode="contain"
                        />
                        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginBottom: 16 }} />
                        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, textAlign: 'center' }}>
                            Setting up your experience...
                        </Text>
                    </View>
                )}
                <Appbar.Header style={{ backgroundColor: 'transparent', elevation: 0, height: verticalScale(64) }}>
                    <View style={[styles.headerContent, { height: verticalScale(64) }]}>
                        <View style={styles.logoContainer}>
                            <Image
                                source={require('../assets/logo.png')}
                                style={styles.logo}
                                resizeMode="contain"
                            />
                            <Text variant="titleLarge" style={styles.logoText} adjustsFontSizeToFit numberOfLines={1}>RiResume</Text>
                        </View>
                        {!userProfile && (
                            <View style={{ flexShrink: 0, flexDirection: 'row', alignItems: 'center' }}>
                                <Button
                                    mode="text"
                                    onPress={handleLogin}
                                    textColor={theme.colors.primary}
                                    compact={true}
                                    uppercase={false}
                                    labelStyle={{ fontSize: scaleFont(14), fontWeight: '600' }}
                                    style={{ minWidth: horizontalScale(70) }}
                                >
                                    Log In
                                </Button>
                                <ThemeToggle size={22} />
                            </View>
                        )}
                    </View>
                </Appbar.Header>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    overScrollMode="never"
                >
                    <View style={styles.heroSection}>
                        <Text variant="displaySmall" style={styles.heroTitle}>
                            From Application to Interview in Days,{'\n'}Not Weeks
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
                            <TouchableOpacity onPress={() => Linking.openURL('https://riresume.com/settings/help')}>
                                <Text variant="labelMedium" style={styles.footerLink}>Help & Support</Text>
                            </TouchableOpacity>
                            <Text variant="labelMedium" style={styles.footerDivider}>•</Text>
                            <TouchableOpacity onPress={() => Linking.openURL('https://riresume.com/settings/privacy')}>
                                <Text variant="labelMedium" style={styles.footerLink}>Privacy Policy</Text>
                            </TouchableOpacity>
                            <Text variant="labelMedium" style={styles.footerDivider}>•</Text>
                            <TouchableOpacity onPress={() => Linking.openURL('https://riresume.com/settings/terms')}>
                                <Text variant="labelMedium" style={styles.footerLink}>Terms of Service</Text>
                            </TouchableOpacity>
                            <Text variant="labelMedium" style={styles.footerDivider}>•</Text>
                            <TouchableOpacity onPress={() => Linking.openURL('https://riresume.com/blog')}>
                                <Text variant="labelMedium" style={styles.footerLink}>Blog</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.socialContainer}>
                            <TouchableOpacity onPress={() => Linking.openURL('https://www.facebook.com/share/1HrAgt1KUB/?mibextid=wwXIfr')} style={styles.socialIcon}>
                                <FontAwesome6 name="facebook" size={moderateScale(18)} color={theme.colors.onSurface} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => Linking.openURL('https://www.instagram.com/riresume?igsh=YjU4MTJ5N205Y2V1')} style={styles.socialIcon}>
                                <FontAwesome6 name="instagram" size={moderateScale(18)} color={theme.colors.onSurface} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => Linking.openURL('https://x.com/riresume?s=21&t=YyZ_r5xFMEYCKAWlqJVxFA')} style={styles.socialIcon}>
                                <FontAwesome6 name="x-twitter" size={moderateScale(18)} color={theme.colors.onSurface} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => Linking.openURL('https://www.threads.com/@riresume?igshid=NTc4MTIwNjQ2YQ==')} style={styles.socialIcon}>
                                <FontAwesome6 name="threads" size={moderateScale(18)} color={theme.colors.onSurface} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => Linking.openURL('https://www.tiktok.com/@riresume?_r=1&_t=ZT-94r59srZ1mo')} style={styles.socialIcon}>
                                <FontAwesome6 name="tiktok" size={moderateScale(18)} color={theme.colors.onSurface} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { /* LinkedIn URL Pending */ }} style={styles.socialIcon}>
                                <FontAwesome6 name="linkedin" size={moderateScale(18)} color={theme.colors.onSurface} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => Linking.openURL('https://truthsocial.com')} style={styles.socialIcon}>
                                <TruthSocialIcon color={theme.colors.onSurface} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => Linking.openURL('https://bsky.app/profile/riresume.bsky.social')} style={styles.socialIcon}>
                                <BlueSkyIcon color={theme.colors.onSurface} isDark={isDark} size={moderateScale(18)} />
                            </TouchableOpacity>
                        </View>

                        <Text variant="labelSmall" style={styles.copyright}>
                            Copyright 2026 RiResume Inc., All Rights Reserved
                        </Text>
                    </View>
                </ScrollView>
            </View>
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
        paddingHorizontal: horizontalScale(16),
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        marginRight: horizontalScale(8),
    },
    logo: {
        width: moderateScale(32),
        height: moderateScale(32),
        marginRight: horizontalScale(8),
        borderRadius: moderateScale(16),
    },
    logoText: {
        fontWeight: 'bold',
        fontSize: scaleFont(18),
        maxWidth: horizontalScale(140),
    },
    scrollContent: {
        flexGrow: 1,
        padding: horizontalScale(24),
        paddingTop: verticalScale(20),
        paddingBottom: verticalScale(40),
    },
    heroSection: {
        marginBottom: verticalScale(40),
    },
    heroTitle: {
        fontWeight: 'bold',
        fontSize: scaleFont(32),
        marginBottom: verticalScale(16),
        textAlign: 'center',
        lineHeight: scaleFont(42),
        maxWidth: 800,
        alignSelf: 'center',
    },
    heroSubtext: {
        textAlign: 'center',
        fontSize: scaleFont(16),
        opacity: 0.8,
        lineHeight: scaleFont(24),
    },
    inputCard: {
        padding: horizontalScale(24),
        borderRadius: moderateScale(16),
        gap: verticalScale(16),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    inputLabel: {
        textAlign: 'center',
        fontWeight: '600',
        fontSize: scaleFont(16),
    },
    textArea: {
        minHeight: verticalScale(80),
    },
    startButton: {
        marginTop: verticalScale(8),
        borderRadius: moderateScale(8),
    },
    startButtonContent: {
        height: verticalScale(48),
    },
    footer: {
        marginTop: verticalScale(48),
        alignItems: 'center',
        gap: verticalScale(16),
    },
    footerLinks: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: horizontalScale(8),
    },
    footerLink: {
        opacity: 0.6,
        textDecorationLine: 'underline',
        fontSize: scaleFont(12),
    },
    footerDivider: {
        opacity: 0.3,
    },
    socialContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0.7,
        gap: horizontalScale(4),
    },
    socialIcon: {
        padding: moderateScale(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    copyright: {
        opacity: 0.5,
        textAlign: 'center',
        fontSize: scaleFont(10),
        marginTop: verticalScale(8),
    },
});
