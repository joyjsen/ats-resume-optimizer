import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import Head from 'expo-router/head';
import { UniversalWebHeader } from '../src/components/web/landing/UniversalWebHeader';
import { UniversalWebFooter } from '../src/components/web/landing/UniversalWebFooter';
import { C } from '../src/components/web/landing/LandingData';

export default function CareersPage() {
    const isWeb = Platform.OS === 'web';

    const renderHeader = () => {
        if (!isWeb) return null;
        return (
            <UniversalWebHeader
                isSmall={false}
                onSignIn={() => router.push('/(auth)/sign-in')}
                onGetStarted={() => router.push('/(auth)/sign-up')}
                onPricing={() => router.push('/#pricing-section')}
            />
        );
    };

    return (
        <View style={styles.container}>
            <Head>
                <title>Careers at RiResume | Join Our Mission</title>
                <meta name="description" content="Explore career opportunities at RiResume. We're building the future of AI-powered ATS resume optimization." />
                <link rel="canonical" href="https://www.riresume.com/careers" />
            </Head>
            <Stack.Screen options={{ headerShown: false, title: 'Careers' }} />

            {renderHeader()}

            <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollContent}>
                <View style={styles.contentWrapper}>
                    <Text style={styles.title}>Join Our Team</Text>
                    <Text style={styles.subtitle}>We're currently scaling our operations and building the future of AI-driven career growth.</Text>

                    <View style={styles.card}>
                        <Text style={styles.comingSoon}>Coming Soon</Text>
                        <Text style={styles.desc}>Our open positions board is currently under construction. Check back soon for engineering, marketing, and product roles!</Text>
                    </View>
                </View>

                {isWeb && <UniversalWebFooter />}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.offWhite },
    flex1: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingTop: 120 },
    contentWrapper: {
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
        paddingHorizontal: 24,
        paddingBottom: 80,
        alignItems: 'center',
    },
    title: {
        fontSize: 48,
        fontWeight: '800',
        color: C.textPrimary,
        marginBottom: 16,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 18,
        color: C.textSecondary,
        textAlign: 'center',
        lineHeight: 28,
        marginBottom: 48,
    },
    card: {
        backgroundColor: C.white,
        padding: 40,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.borderLight,
        alignItems: 'center',
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    comingSoon: {
        fontSize: 24,
        fontWeight: '700',
        color: C.primary,
        marginBottom: 16,
    },
    desc: {
        fontSize: 16,
        color: C.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    }
});
