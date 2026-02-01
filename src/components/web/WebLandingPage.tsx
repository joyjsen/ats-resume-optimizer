import React from 'react';
import { View, ScrollView, useWindowDimensions } from 'react-native';
import { Text, useTheme, Icon } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { WebLoginForm } from './WebLoginForm';
import { webStyles } from '../../styles/web.styles';
import { LinearGradient } from 'expo-linear-gradient';

export const WebLandingPage: React.FC = () => {
    const theme = useTheme();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isSmallScreen = width < 768;

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
                        ATS Resume Checker & Optimizer
                    </Text>
                    <Text
                        style={[
                            webStyles.heroSubheadline,
                            { color: theme.colors.onSurfaceVariant, fontSize: isSmallScreen ? 16 : 20 },
                        ]}
                    >
                        Boost Your Job Application Score. Analyze, optimize, and land your dream job with AI-powered resume tools.
                    </Text>
                </View>

                {/* Login Form */}
                <View style={{ width: isSmallScreen ? '100%' : 400 }}>
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
