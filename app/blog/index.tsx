import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Head from 'expo-router/head';
import { UniversalWebHeader } from '../../src/components/web/landing/UniversalWebHeader';
import { UniversalWebFooter } from '../../src/components/web/landing/UniversalWebFooter';
import { C, BLOG_CATEGORIES } from '../../src/components/web/landing/LandingData';
import { BLOG_POSTS_DB } from '../../src/data/blogData';

export default function BlogIndexPage() {
    const insets = useSafeAreaInsets();
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

    const featuredPosts = BLOG_POSTS_DB.filter(post =>
        post.id === 'ai-revolution' || post.id === 'skills-2026' || post.id === 'interview-mastery'
    );

    return (
        <View style={styles.container}>
            <Head>
                <title>RiResume Blog | AI Resume & Career Advice</title>
                <meta name="description" content="Expert advice on AI resume optimization, interviewing, cover letters, and career growth. Learn how to beat ATS systems with RiResume." />
                <meta property="og:title" content="RiResume Blog | Career & Resume Expert Advice" />
                <meta property="og:description" content="Expert advice on AI resume optimization, interviewing, cover letters, and career growth." />
                <meta property="og:type" content="website" />
                <meta name="twitter:card" content="summary_large_image" />
            </Head>

            <Stack.Screen options={{ headerShown: false, title: 'RiResume Blog' }} />
            {renderHeader()}

            <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollContent, !isWeb && { paddingTop: insets.top }]}>
                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <Text style={styles.heroTitle}>RiResume Blog</Text>
                    <Text style={styles.heroSubtitle}>Expert advice on AI resume optimization, interviewing, and career growth.</Text>
                </View>

                <View style={styles.contentWrapper}>
                    {/* Featured Posts */}
                    <Text style={styles.sectionTitle}>Featured Articles</Text>
                    <View style={styles.featuredGrid}>
                        {featuredPosts.map((post) => (
                            <Pressable
                                key={post.id}
                                style={styles.featuredCard}
                                onPress={() => router.push(`/blog/${post.id}`)}
                            >
                                <Image source={{ uri: post.image }} style={styles.featuredImage} />
                                <View style={styles.featuredContent}>
                                    <View style={styles.metaRow}>
                                        <Text style={styles.categoryText}>{post.category}</Text>
                                        <Text style={styles.timeText}>{post.readTime}</Text>
                                    </View>
                                    <Text style={styles.cardTitle}>{post.title}</Text>
                                    <Text style={styles.cardDesc} numberOfLines={3}>{post.description}</Text>
                                    <Text style={styles.dateText}>{post.date}</Text>
                                </View>
                            </Pressable>
                        ))}
                    </View>

                    {/* Categories and Topics */}
                    <Text style={[styles.sectionTitle, { marginTop: 40 }]}>Browse by Category</Text>
                    <View style={styles.categoryGrid}>
                        {BLOG_CATEGORIES.map((cat, i) => (
                            <View key={i} style={styles.categoryColumn}>
                                <Text style={styles.categoryTitle}>{cat.title}</Text>
                                <View style={styles.topicList}>
                                    {cat.topics.map((topic, j) => {
                                        // Find matching internal post. We match by label if we don't have direct mapping in BLOG_CATEGORIES
                                        const linkedPost = BLOG_POSTS_DB.find(p => p.title === topic.label);
                                        const route = linkedPost ? linkedPost.id : 'ai-revolution'; // fallback

                                        return (
                                            <Pressable
                                                key={j}
                                                style={styles.topicItem}
                                                onPress={() => router.push(`/blog/${route}`)}
                                            >
                                                <Text style={styles.topicText}>{topic.label}</Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        ))}
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
    scrollContent: { flexGrow: 1 },
    contentWrapper: {
        maxWidth: 1200,
        width: '100%',
        alignSelf: 'center',
        paddingHorizontal: 24,
        paddingBottom: 60,
    },
    heroSection: {
        backgroundColor: C.headerBg,
        paddingVertical: 60,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
    },
    heroTitle: {
        fontSize: 48,
        fontWeight: '800',
        color: C.white,
        marginBottom: 16,
        textAlign: 'center',
    },
    heroSubtitle: {
        fontSize: 18,
        color: C.textMuted,
        textAlign: 'center',
        maxWidth: 600,
        lineHeight: 26,
    },
    sectionTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: C.textPrimary,
        marginBottom: 24,
    },
    featuredGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 24,
    },
    featuredCard: {
        flex: 1,
        minWidth: 300,
        maxWidth: 400,
        backgroundColor: C.white,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    featuredImage: {
        width: '100%',
        height: 200,
        backgroundColor: C.lightGray,
    },
    featuredContent: {
        padding: 24,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    categoryText: {
        fontSize: 12,
        fontWeight: '700',
        color: C.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    timeText: {
        fontSize: 12,
        color: C.textMuted,
        fontWeight: '500',
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: C.textPrimary,
        marginBottom: 12,
        lineHeight: 28,
    },
    cardDesc: {
        fontSize: 15,
        color: C.textSecondary,
        lineHeight: 22,
        marginBottom: 16,
    },
    dateText: {
        fontSize: 13,
        color: C.textMuted,
        fontWeight: '500',
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 32,
    },
    categoryColumn: {
        flex: 1,
        minWidth: 250,
    },
    categoryTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: C.textPrimary,
        marginBottom: 16,
        borderBottomWidth: 2,
        borderBottomColor: C.primaryLight,
        paddingBottom: 8,
        alignSelf: 'flex-start',
    },
    topicList: {
        gap: 12,
    },
    topicItem: {
        paddingVertical: 4,
    },
    topicText: {
        fontSize: 15,
        color: C.textSecondary,
        lineHeight: 22,
    },
    footerContainer: {
        backgroundColor: C.footerBg,
        paddingVertical: 24,
        alignItems: 'center',
        marginTop: 'auto',
    },
    footerText: {
        color: C.textMuted,
        fontSize: 14,
    }
});
