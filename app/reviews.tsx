import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Pressable, TextInput, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import Head from 'expo-router/head';
import { UniversalWebHeader } from '../src/components/web/landing/UniversalWebHeader';
import { UniversalWebFooter } from '../src/components/web/landing/UniversalWebFooter';
import { C, TESTIMONIALS } from '../src/components/web/landing/LandingData';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ReviewsPage() {
    const isWeb = Platform.OS === 'web';

    // Form state
    const [name, setName] = useState('');
    const [rating, setRating] = useState(5);
    const [review, setReview] = useState('');
    const [submitted, setSubmitted] = useState(false);

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

    const handleSubmit = () => {
        if (!name.trim() || !review.trim()) {
            if (isWeb) {
                window.alert('Please fill out your name and review before submitting.');
            } else {
                Alert.alert('Missing Fields', 'Please fill out your name and review before submitting.');
            }
            return;
        }

        // Logic to push review to backend would go here.
        setSubmitted(true);
        setName('');
        setReview('');
        setRating(5);
    };

    return (
        <View style={styles.container}>
            <Head>
                <title>RiResume Customer Reviews & Success Stories</title>
                <meta name="description" content="Read real reviews from job seekers who landed interviews faster using RiResume's AI optimization." />
                <link rel="canonical" href="https://www.riresume.com/reviews" />
            </Head>
            <Stack.Screen options={{ headerShown: false, title: 'Reviews' }} />

            {renderHeader()}

            <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollContent}>
                <View style={styles.contentWrapper}>
                    <Text style={styles.title}>Success Stories</Text>
                    <Text style={styles.subtitle}>See how RiResume is transforming careers and helping professionals land more interviews.</Text>

                    <View style={styles.grid}>
                        {TESTIMONIALS.map((t, i) => (
                            <View key={i} style={styles.reviewCard}>
                                <View style={styles.starsRow}>
                                    {[...Array(5)].map((_, j) => (
                                        <MaterialCommunityIcons key={j} name="star" size={20} color="#FFB800" />
                                    ))}
                                </View>
                                <Text style={styles.reviewText}>"{t.content}"</Text>
                                <View style={styles.authorRow}>
                                    <View>
                                        <Text style={styles.authorName}>{t.name}</Text>
                                        <Text style={styles.authorRole}>{t.role}</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Submission Form */}
                    <View style={styles.submitSection}>
                        <Text style={styles.sectionTitle}>Share Your Experience</Text>
                        <Text style={styles.desc}>Did RiResume help you land your dream job? We'd love to hear about it.</Text>

                        {submitted ? (
                            <View style={styles.successBox}>
                                <MaterialCommunityIcons name="check-circle" size={48} color={C.successGreen} />
                                <Text style={styles.successHeading}>Thank You!</Text>
                                <Text style={styles.successText}>Your review has been submitted and is pending moderation.</Text>
                                <Pressable style={styles.submitAnotherBtn} onPress={() => setSubmitted(false)}>
                                    <Text style={styles.submitAnotherText}>Submit Another Review</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <View style={styles.formContainer}>
                                <Text style={styles.label}>Your Name</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="John Doe"
                                    placeholderTextColor={C.textMuted}
                                    value={name}
                                    onChangeText={setName}
                                />

                                <Text style={styles.label}>Your Rating</Text>
                                <View style={styles.ratingInputRow}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Pressable key={star} onPress={() => setRating(star)}>
                                            <MaterialCommunityIcons
                                                name={star <= rating ? "star" : "star-outline"}
                                                size={32}
                                                color="#FFB800"
                                            />
                                        </Pressable>
                                    ))}
                                </View>

                                <Text style={styles.label}>Your Review</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    placeholder="Tell us how RiResume helped you..."
                                    placeholderTextColor={C.textMuted}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                    value={review}
                                    onChangeText={setReview}
                                />

                                <Pressable style={styles.submitBtn} onPress={handleSubmit}>
                                    <Text style={styles.submitBtnText}>Submit Review</Text>
                                </Pressable>
                            </View>
                        )}
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
        maxWidth: 1200,
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
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 24,
        justifyContent: 'center',
        marginBottom: 64,
    },
    reviewCard: {
        backgroundColor: C.white,
        padding: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.borderLight,
        width: 350,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    starsRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    reviewText: {
        fontSize: 16,
        color: C.textPrimary,
        lineHeight: 24,
        fontStyle: 'italic',
        marginBottom: 24,
        flex: 1,
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    authorName: {
        fontSize: 16,
        fontWeight: '700',
        color: C.textPrimary,
    },
    authorRole: {
        fontSize: 14,
        color: C.textSecondary,
    },
    submitSection: {
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
        backgroundColor: C.white,
        padding: 40,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
    },
    sectionTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: C.textPrimary,
        marginBottom: 8,
        textAlign: 'center',
    },
    desc: {
        fontSize: 16,
        color: C.textSecondary,
        textAlign: 'center',
        marginBottom: 32,
    },
    formContainer: {
        width: '100%',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: C.textPrimary,
        marginBottom: 8,
    },
    input: {
        backgroundColor: C.offWhite,
        borderWidth: 1,
        borderColor: C.borderLight,
        borderRadius: 8,
        padding: 16,
        fontSize: 16,
        color: C.textPrimary,
        marginBottom: 24,
        ...Platform.select({
            web: { outlineStyle: 'none' } as any,
        }),
    },
    textArea: {
        height: 120,
    },
    ratingInputRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 24,
    },
    submitBtn: {
        backgroundColor: C.primary,
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    submitBtnText: {
        color: C.white,
        fontSize: 18,
        fontWeight: '700',
    },
    successBox: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    successHeading: {
        fontSize: 24,
        fontWeight: '700',
        color: C.textPrimary,
        marginTop: 16,
        marginBottom: 8,
    },
    successText: {
        fontSize: 16,
        color: C.textSecondary,
        textAlign: 'center',
        marginBottom: 32,
    },
    submitAnotherBtn: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.primaryLight,
    },
    submitAnotherText: {
        color: C.primary,
        fontSize: 16,
        fontWeight: '600',
    }
});
