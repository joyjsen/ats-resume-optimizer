import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Platform, Dimensions } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LazyMarkdown from '../../src/components/common/LazyMarkdown';
import { Ionicons } from '@expo/vector-icons';
import Head from 'expo-router/head';
import { UniversalWebHeader } from '../../src/components/web/landing/UniversalWebHeader';
import { UniversalWebFooter } from '../../src/components/web/landing/UniversalWebFooter';
import { C } from '../../src/components/web/landing/LandingData';
import { BLOG_POSTS_DB } from '../../src/data/blogData';

export function generateStaticParams() {
    return BLOG_POSTS_DB.map(post => ({ id: post.id }));
}

export default function BlogPostPage() {
    const { id } = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const isWeb = Platform.OS === 'web';
    const windowWidth = Dimensions.get('window').width;

    const post = BLOG_POSTS_DB.find(p => p.id === id);

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

    if (!post) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Stack.Screen options={{ title: 'Article Not Found' }} />
                <Text style={styles.notFoundText}>Article not found.</Text>
                <Pressable style={styles.backBtn} onPress={() => router.replace('/blog')}>
                    <Text style={styles.backBtnText}>Return to Blog</Text>
                </Pressable>
            </View>
        );
    }

    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": post.title,
        "description": post.description,
        "image": post.image,
        "datePublished": post.date,
        "author": {
            "@type": "Organization",
            "name": "RiResume",
            "url": "https://www.riresume.com"
        },
        "publisher": {
            "@type": "Organization",
            "name": "RiResume",
            "logo": {
                "@type": "ImageObject",
                "url": "https://www.riresume.com/assets/logo.png"
            }
        },
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": `https://www.riresume.com/blog/${post.id}`
        }
    };

    return (
        <View style={styles.container}>
            <Head>
                <title>{post.title} | RiResume</title>
                <meta name="description" content={post.description} />
                <meta property="og:title" content={post.title} />
                <meta property="og:description" content={post.description} />
                <meta property="og:image" content={post.image} />
                <meta property="og:type" content="article" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={post.title} />
                <meta name="twitter:description" content={post.description} />
                <meta name="twitter:image" content={post.image} />
                <link rel="canonical" href={`https://www.riresume.com/blog/${post.id}`} />
                <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
            </Head>

            <Stack.Screen options={{
                headerShown: !isWeb,
                title: post.category,
                headerBackTitle: 'Blog'
            }} />

            {renderHeader()}

            <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollContent, !isWeb && { paddingTop: insets.top }]}>
                {isWeb && (
                    <View style={styles.breadcrumbBar}>
                        <Pressable onPress={() => router.push('/blog')} style={styles.breadcrumbBtn}>
                            <Ionicons name="arrow-back" size={20} color={C.primary} />
                            <Text style={styles.breadcrumbText}>Back to Blog</Text>
                        </Pressable>
                    </View>
                )}

                <Image
                    source={{ uri: post.image }}
                    style={styles.heroImage}
                    resizeMode="cover"
                />

                <View style={[styles.articleContainer, { paddingHorizontal: isWeb && windowWidth > 800 ? 0 : 24 }]}>
                    <View style={styles.articleHeader}>
                        <View style={styles.metaRow}>
                            <Text style={styles.categoryBadge}>{post.category}</Text>
                            <Text style={styles.timeText}>{post.date} • {post.readTime}</Text>
                        </View>
                    </View>

                    <View style={styles.markdownContainer}>
                        <LazyMarkdown
                            style={{
                                body: { fontSize: 17, lineHeight: 28, color: C.textPrimary, fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto' },
                                heading1: { fontSize: 36, fontWeight: '800', color: C.textPrimary, marginTop: 16, marginBottom: 24, lineHeight: 42 },
                                heading2: { fontSize: 24, fontWeight: '700', color: C.textPrimary, marginTop: 32, marginBottom: 16 },
                                heading3: { fontSize: 20, fontWeight: '600', color: C.textPrimary, marginTop: 24, marginBottom: 12 },
                                paragraph: { marginBottom: 20 },
                                strong: { fontWeight: '700', color: C.textPrimary },
                                blockquote: { borderLeftWidth: 4, borderLeftColor: C.primary, paddingLeft: 16, marginLeft: 0, fontStyle: 'italic', backgroundColor: C.offWhite, paddingVertical: 12, borderRadius: 4 },
                                list_item: { marginBottom: 8, flexDirection: 'row' },
                                bullet_list: { marginBottom: 20 },
                            }}
                        >
                            {post.content}
                        </LazyMarkdown>
                    </View>
                </View>

                {isWeb && <UniversalWebFooter />}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.white },
    flex1: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    breadcrumbBar: {
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    breadcrumbBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    breadcrumbText: {
        color: C.primary,
        fontSize: 15,
        fontWeight: '600',
    },
    heroImage: {
        width: '100%',
        height: 350,
        backgroundColor: C.lightGray,
    },
    articleContainer: {
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
        paddingVertical: 40,
        paddingBottom: 80,
    },
    articleHeader: {
        marginBottom: 24,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    categoryBadge: {
        backgroundColor: C.primaryGlow,
        color: C.primaryDark,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
        overflow: 'hidden',
    },
    timeText: {
        fontSize: 14,
        color: C.textSecondary,
        fontWeight: '500',
    },
    markdownContainer: {
        paddingBottom: 40,
    },
    notFoundText: {
        fontSize: 20,
        color: C.textPrimary,
        marginBottom: 24,
    },
    backBtn: {
        backgroundColor: C.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    backBtnText: {
        color: C.white,
        fontSize: 16,
        fontWeight: '600',
    },
    footerContainer: {
        backgroundColor: C.footerBg,
        paddingVertical: 24,
        alignItems: 'center',
        marginTop: 40,
    },
    footerText: {
        color: C.textMuted,
        fontSize: 14,
    }
});
