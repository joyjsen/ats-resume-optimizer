import React from 'react';
import { View, ScrollView, useWindowDimensions } from 'react-native';
import { Text, useTheme, Icon, TextInput, Button } from 'react-native-paper'; // Added TextInput, Button
import { useRouter } from 'expo-router';
import { WebLoginForm } from './WebLoginForm'; // Restored
import { webStyles } from '../../styles/web.styles';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { useResumeStore } from '../../store/resumeStore';

export const WebLandingPage: React.FC = () => {
    const theme = useTheme();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isSmallScreen = width < 768;
    const [jobUrl, setJobUrl] = useState('');
    const setPendingSharedUrl = useResumeStore(state => state.setPendingSharedUrl);

    const handleStartNow = () => {
        if (jobUrl) {
            setPendingSharedUrl(jobUrl);
        }
        router.push('/(auth)/sign-in');
    };

    const features = [
        {
            icon: 'shimmer',
            title: 'Resume Optimization',
            description: 'AI-powered resume rewriting that boosts your ATS score and highlights your best qualifications.',
        },
        {
            icon: 'school',
            title: 'Prep Guides',
            description: 'Personalized interview preparation and skill-building tailored to your target role.',
        },
    ];

    return (
        <ScrollView
            style={[webStyles.landingContainer, { backgroundColor: theme.colors.background }]}
            contentContainerStyle={{ flexGrow: 1 }}
        >
            {/* Hero Section */}
            <LinearGradient
                colors={[theme.colors.primary + '15', theme.colors.background]}
                style={[
                    webStyles.heroSection,
                    { flexDirection: isSmallScreen ? 'column' : 'row' },
                ]}
            >
                {/* Hero Text */}
                <View style={[webStyles.heroContent, { paddingRight: isSmallScreen ? 0 : 48 }]}>
                    <Text
                        style={[
                            webStyles.heroTagline,
                            { color: theme.colors.onBackground, fontSize: isSmallScreen ? 28 : 42 },
                        ]}
                    >
                        From Application to Interview in Days, Not Weeks
                    </Text>
                    <Text
                        style={[
                            webStyles.heroSubheadline,
                            { color: theme.colors.onSurfaceVariant, fontSize: isSmallScreen ? 16 : 20 },
                        ]}
                    >
                        RiResume uses AI to perfectly tailor your resume and cover letter, bridge your skill gaps, and create custom interview guides - all designed to help you land your dream job faster.
                    </Text>

                    {/* Job URL Input Section */}
                    <View style={{ marginTop: 32, maxWidth: 500 }}>
                        <Text variant="titleMedium" style={{ marginBottom: 8, fontWeight: 'bold' }}>
                            Ready to start? Paste a job link below
                        </Text>
                        <TextInput
                            mode="outlined"
                            placeholder="https://www.linkedin.com/jobs/view/..."
                            value={jobUrl}
                            onChangeText={setJobUrl}
                            style={{ backgroundColor: theme.colors.surface, marginBottom: 16 }}
                        />
                        <Button
                            mode="contained"
                            onPress={handleStartNow}
                            contentStyle={{ height: 48 }}
                            labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                        >
                            Start Now
                        </Button>
                    </View>
                </View>

                {/* Right Side - Login Form */}
                <View style={{ width: isSmallScreen ? '100%' : 400, justifyContent: 'center' }}>
                    <WebLoginForm />
                </View>
            </LinearGradient>

            {/* Features Section */}
            <View
                style={[
                    webStyles.featuresSection,
                    { backgroundColor: theme.colors.elevation.level1, padding: isSmallScreen ? 24 : 64 },
                ]}
            >
                <Text
                    style={[
                        webStyles.featuresSectionTitle,
                        { color: theme.colors.onBackground, fontSize: isSmallScreen ? 24 : 32 },
                    ]}
                >
                    What You Can Do
                </Text>
                <View style={[webStyles.featuresGrid, { flexDirection: isSmallScreen ? 'column' : 'row' }]}>
                    {features.map((feature, index) => (
                        <View
                            key={index}
                            style={[
                                webStyles.featureCard,
                                {
                                    backgroundColor: theme.colors.elevation.level2,
                                    maxWidth: isSmallScreen ? '100%' : 350,
                                },
                            ]}
                        >
                            <Icon source={feature.icon} size={48} color={theme.colors.primary} />
                            <Text style={[webStyles.featureTitle, { color: theme.colors.onSurface }]}>
                                {feature.title}
                            </Text>
                            <Text style={[webStyles.featureDescription, { color: theme.colors.onSurfaceVariant }]}>
                                {feature.description}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Footer */}
            <View style={[webStyles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
                <Text
                    style={[webStyles.footerLink, { color: theme.colors.primary }]}
                    onPress={() => router.push('/settings/terms')}
                >
                    Terms of Service
                </Text>
                <Text
                    style={[webStyles.footerLink, { color: theme.colors.primary }]}
                    onPress={() => router.push('/settings/privacy')}
                >
                    Privacy Policy
                </Text>
            </View>
        </ScrollView>
    );
};
