import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import Head from 'expo-router/head';
import { UniversalWebHeader } from '../src/components/web/landing/UniversalWebHeader';
import { UniversalWebFooter } from '../src/components/web/landing/UniversalWebFooter';
import { C } from '../src/components/web/landing/LandingData';

export default function LlmInfoPage() {
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
                <title>RiResume AI Technology | LLM Information</title>
                <meta name="description" content="Learn about the advanced Large Language Models powering RiResume's industry-leading ATS optimization." />
                <link rel="canonical" href="https://www.riresume.com/llm_info" />
            </Head>
            <Stack.Screen options={{ headerShown: false, title: 'AI Tech' }} />

            {renderHeader()}

            <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollContent}>
                <View style={styles.contentWrapper}>
                    <Text style={styles.title}>Our AI Technology</Text>
                    <Text style={styles.subtitle}>RiResume is powered by a proprietary AI orchestration layer built on top of the world's most advanced Large Language Models, ensuring your resume speaks directly to ATS systems and hiring managers alike.</Text>

                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Model Intelligence Architecture</Text>
                        <Text style={styles.desc}>We utilize a multi-model approach, intelligently routing specific analysis and rewriting tasks to the LLMs best suited for them. For deep analytical reasoning and structural parsing of complex job descriptions, we rely on advanced reasoning engines. For nuanced creative rewriting and human-like cover letter generation, our system leverages state-of-the-art conversational models.</Text>

                        <Text style={styles.sectionTitle}>Proprietary Optimization Engine</Text>
                        <Text style={styles.desc}>RiResume does not rely on simple prompt wrappers. Instead, it utilizes a sophisticated multi-agent graph—breaking down your resume and the job description into discrete analytical steps. This ensures strict adherence to professional formats, zero AI hallucinations, and perfect ATS keyword density.</Text>

                        <Text style={styles.sectionTitle}>Data Privacy & Security</Text>
                        <Text style={styles.desc}>We maintain strict data privacy standards. Your personal resume data is never used to train these foundational conversational models. All API requests to our LLM providers are made through secure, zero-retention enterprise endpoints. Your career history is yours alone.</Text>
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
        maxWidth: 700,
        alignSelf: 'center'
    },
    card: {
        backgroundColor: C.white,
        padding: 40,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.borderLight,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: C.primaryDark,
        marginBottom: 16,
        marginTop: 24,
    },
    desc: {
        fontSize: 16,
        color: C.textSecondary,
        lineHeight: 26,
        marginBottom: 8,
    }
});
