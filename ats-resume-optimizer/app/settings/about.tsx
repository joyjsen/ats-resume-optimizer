import React from 'react';
import { View, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native';
import { Text, useTheme, Card, Divider } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import Markdown from 'react-native-markdown-display';

const ABOUT_CONTENT = `
**What is ResuMate?**
ResuMate is your AI-powered career companion that transforms the job search experience. Unlike traditional resume scanners that only give you a score, ResuMate actively rewrites and optimizes your resume for each specific job, manages your entire application lifecycle, and prepares you for success from application to interview.

**Our Mission**
We believe job searching shouldn't be a guessing game. Our mission is to empower job seekers with intelligent tools that level the playing field, helping you present your best self to every opportunity.

## What Makes Us Different

**True AI Optimization**
We don't just scan—we rewrite. Our advanced AI technology crafts job-specific content that highlights your strengths and matches what employers are looking for.

**Complete Job Search Management**
From initial analysis to interview preparation, ResuMate guides you through every step of your job search journey in one integrated platform.

**Mobile-First Design**
Job search on your terms. Built specifically for mobile, ResuMate lets you optimize resumes, track applications, and prepare for interviews wherever you are.

**Transparent & Affordable**
Our token-based system means you only pay for what you use, with no hidden subscriptions or surprise charges.

## Key Features
* ✨ **Smart Resume Analysis** - Understand exactly where you stand with detailed skill matching and ATS scoring
* ✨ **AI-Powered Optimization** - Get professionally rewritten content tailored to each job description
* ✨ **Interactive Skill Management** - Add skills strategically and see real-time impact on your resume
* ✨ **Interview Prep Guides** - Receive comprehensive preparation materials mapped to your actual experience
* ✨ **Cover Letter Generation** - Create compelling, job-specific cover letters in seconds
* ✨ **Learning Hub** - Access personalized training materials to develop new skills
* ✨ **Application Tracking** - Monitor every application from draft to optimized in one dashboard

## Our Commitment to You
**Privacy First:** Your career information is sensitive. We use industry-leading security measures and never sell your data.
**Quality Focused:** We use premium AI models optimized for professional content, ensuring every optimization meets high standards.
**Continuous Improvement:** We're constantly evolving based on user feedback, industry trends, and technological advances.
**Support Driven:** Our team is here to help. If you encounter issues or have questions, we're just a message away.
`;

export default function AboutScreen() {
    const theme = useTheme();
    const router = useRouter();

    return (
        <>
            <Stack.Screen options={{ title: 'About' }} />
            <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background }]}>

                <View style={styles.logoContainer}>
                    <Image
                        source={require('../../assets/logo.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <Text variant="headlineMedium" style={styles.appName}>ResuMate</Text>
                    <Text variant="titleMedium" style={styles.version}>Version 1.0.0</Text>
                </View>

                <Markdown
                    style={{
                        body: {
                            color: theme.colors.onSurface,
                            fontSize: 14,
                            lineHeight: 22,
                        },
                        heading2: {
                            color: theme.colors.primary,
                            fontSize: 20,
                            marginTop: 16,
                            marginBottom: 8,
                            fontWeight: 'bold',
                        },
                        strong: {
                            fontWeight: 'bold',
                            color: theme.colors.primary,
                        }
                    }}
                >
                    {ABOUT_CONTENT}
                </Markdown>

                <View style={styles.sectionContainer}>
                    <Text variant="titleMedium" style={styles.sectionHeader}>Legal</Text>
                    <TouchableOpacity onPress={() => router.push('./terms')} style={styles.linkContainer}>
                        <Text style={[styles.link, { color: theme.colors.primary }]}>Terms of Service</Text>
                    </TouchableOpacity>
                    <Divider style={{ marginVertical: 8 }} />
                    <TouchableOpacity onPress={() => router.push('./privacy')} style={styles.linkContainer}>
                        <Text style={[styles.link, { color: theme.colors.primary }]}>Privacy Policy</Text>
                    </TouchableOpacity>
                    <Divider style={{ marginVertical: 8 }} />
                    <TouchableOpacity onPress={() => router.push('./help')} style={styles.linkContainer}>
                        <Text style={[styles.link, { color: theme.colors.primary }]}>Contact Us</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text variant="bodySmall" style={styles.copyright}>
                        © 2026 Antigravity. All rights reserved.
                    </Text>
                    <Text variant="bodySmall" style={styles.copyright}>
                        ResuMate - Your AI Career Companion
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 24,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    logo: {
        width: 100,
        height: 100,
        marginBottom: 16,
    },
    appName: {
        fontWeight: 'bold',
        color: '#2196F3',
    },
    version: {
        opacity: 0.6,
        marginTop: 4,
    },
    sectionContainer: {
        marginTop: 32,
        backgroundColor: 'rgba(0,0,0,0.02)',
        padding: 16,
        borderRadius: 12,
    },
    sectionHeader: {
        fontWeight: 'bold',
        marginBottom: 16,
    },
    linkContainer: {
        paddingVertical: 8,
    },
    link: {
        fontSize: 16,
    },
    footer: {
        marginTop: 32,
        alignItems: 'center',
        opacity: 0.6,
    },
    copyright: {
        marginTop: 4,
    }
});
