import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Stack } from 'expo-router';
import Markdown from 'react-native-markdown-display';

const PRIVACY_CONTENT = `
# ResuMate Privacy Policy
**Last Updated:** January 27, 2026
**Effective Date:** January 27, 2026

[Your Company Name] ("we," "us," or "our") operates the ResuMate mobile application (the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.

Please read this Privacy Policy carefully. By using the Service, you agree to the collection and use of information in accordance with this policy. If you do not agree with the terms of this Privacy Policy, please do not access the Service.

## 1. Information We Collect
We collect several types of information from and about users of our Service.

**1.1 Personal Information**
**Account Information:**
When you create an account, we collect:
* Full name
* Email address
* Password (encrypted)
* Profile picture (if provided through third-party authentication)
* Authentication provider information (Google, Apple ID)

**Payment Information:**
* Billing information (processed and stored by Stripe, our payment processor)
* Transaction history
* Token purchase records

We do not directly store credit card numbers or banking information. All payment data is processed securely by Stripe in accordance with PCI DSS standards.

**1.2 User Content**
**Resume and Career Information:**
* Resume files (images, .txt, .docx formats)
* Cover letters
* Job descriptions and URLs (LinkedIn)
* Skills and qualifications
* Work experience and education
* Professional summaries
* Learning hub entries and skill development records

**Generated Content:**
* AI-optimized resumes
* Cover letters
* Interview prep guides
* Learning materials
* ATS scores and analysis results

**1.3 Usage Information**
**Activity Data:**
* Features used and frequency of use
* Token usage by activity type
* Application statuses and tracking
* Timestamps of actions
* Success/failure of operations
* Search queries within the app

**Device Information:**
* Device type and model
* Operating system and version
* Unique device identifiers
* Mobile network information
* App version

**Log Data:**
* IP address
* Browser type (if applicable)
* Pages visited
* Time and date of visits
* Time spent on pages
* Error logs and crash reports

**1.4 Location Information**
We may collect approximate location information based on your IP address to:
* Provide localized services
* Comply with local regulations
* Improve Service performance

We do not collect precise GPS location data.

**1.5 Communications**
* Support requests and correspondence
* Feedback and survey responses
* Push notification preferences
* Email communication preferences

## 2. How We Collect Information
**2.1 Information You Provide Directly**
* Account registration
* Profile updates
* Resume and content uploads
* Support requests
* Feedback submissions
* Payment information (through Stripe)

**2.2 Information Collected Automatically**
* Usage data through analytics tools
* Device information
* Log files
* Cookies and similar technologies (if applicable to web-based features)

**2.3 Information from Third Parties**
**Authentication Providers:**
* Google, Apple (name, email, profile picture)

**Payment Processor:**
* Stripe (transaction status, payment verification)

**Job Posting Platforms:**
* LinkedIn (publicly available job descriptions from URLs you provide)

## 3. How We Use Your Information
We use the collected information for the following purposes:

**3.1 Service Provision**
* Create and manage your account
* Process resume analysis and optimization
* Generate cover letters and prep guides
* Calculate ATS scores
* Match skills with job requirements
* Track application lifecycle
* Provide learning materials
* Process token purchases and manage credits

**3.2 AI Model Training and Improvement**
* Train and improve our AI models for better resume optimization
* Enhance skill matching algorithms
* Improve content generation quality
* Develop new features and capabilities

*Note: We anonymize and aggregate data used for AI training to protect your privacy.*

**3.3 Communication**
* Send transactional emails (account verification, password resets, purchase confirmations)
* Deliver push notifications (task completion, status updates, token alerts)
* Respond to support requests
* Send service announcements and updates
* Request feedback (with your consent)

**3.4 Analytics and Improvement**
* Understand how users interact with the Service
* Identify usage patterns and trends
* Diagnose technical problems
* Monitor and analyze Service performance
* Improve user experience
* Develop new features

**3.5 Security and Fraud Prevention**
* Detect and prevent fraud, spam, and abuse
* Enforce our Terms of Service
* Protect against unauthorized access
* Maintain Service security
* Comply with legal obligations

**3.6 Legal Compliance**
* Comply with applicable laws and regulations
* Respond to legal requests and prevent harm
* Protect our rights and property
* Resolve disputes

## 4. How We Share Your Information
We do not sell your personal information to third parties. We share information only in the following circumstances:

**4.1 Service Providers**
We share information with third-party service providers who perform services on our behalf:
* **Firebase (Google Cloud):** Backend infrastructure. Privacy Policy: https://firebase.google.com/support/privacy
* **Stripe:** Payment processing. Privacy Policy: https://stripe.com/privacy
* **AI Service Providers:** Resume optimization, content generation.
* **Cloud Storage Providers:** File storage and backup.

**4.2 Business Transfers**
If we are involved in a merger, acquisition, asset sale, or bankruptcy, your information may be transferred as part of that transaction.

**4.3 Legal Requirements**
We may disclose your information if required to do so by law or in response to valid legal processes.

**4.4 With Your Consent**
We may share your information with third parties when you explicitly consent to such sharing.

**4.5 Aggregated and Anonymized Data**
We may share aggregated or anonymized data that cannot reasonably be used to identify you.

## 5. Data Retention
**5.1 Active Accounts**
We retain your information for as long as your account is active or as needed to provide you services.

**5.2 Account Deletion**
When you delete your account:
* Personal information is deleted within 30 days
* User Content (resumes, cover letters) is permanently deleted
* Anonymized usage data may be retained for analytics
* Transaction records may be retained for legal and accounting purposes

## 6. Data Security
**6.1 Security Measures**
We implement industry-standard security measures to protect your information:
* **Technical Safeguards:** Encryption in transit (TLS/SSL), Encryption at rest, Secure authentication protocols.
* **Administrative Safeguards:** Limited employee access, Background checks, Security training.
* **Physical Safeguards:** Secure data centers (managed by Firebase/Google Cloud).

**6.2 Your Responsibility**
You are responsible for maintaining the confidentiality of your password and restricting access to your device.

**6.3 Security Limitations**
No system is 100% secure. While we strive to protect your information, we cannot guarantee absolute security. You use the Service at your own risk.

## 7. Your Privacy Rights
Depending on your location, you may have certain rights regarding your personal information.

**7.1 Access and Portability**
You have the right to access your personal information and request a copy of your data in a structured, machine-readable format.
*How to Exercise:* Go to Profile → Settings → Download My Data

**7.2 Correction and Update**
You have the right to correct inaccurate information.
*How to Exercise:* Edit your profile information directly in the app under Profile → Edit Profile

**7.3 Deletion**
You have the right to request deletion of your personal information.
*How to Exercise:* Profile → Delete Account

## 8. Children's Privacy
The Service is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children under 18.2

## 13. Updates to This Privacy Policy
**13.1 Changes**
We may update this Privacy Policy from time to time.

**13.2 Notification**
When we make material changes, we will notify you via email or in-app notification.

**13.3 Acceptance**
Your continued use of the Service after changes take effect constitutes acceptance of the revised Privacy Policy.

## 14. How to Contact Us
If you have questions, concerns, or requests regarding this Privacy Policy or our data practices:
* Email: pjmarket1316@gmail.com
* In-App: Profile → Help & Support → Privacy Inquiry
`;

export default function PrivacyScreen() {
    const theme = useTheme();

    return (
        <>
            <Stack.Screen options={{ title: 'Privacy Policy' }} />
            <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <Markdown
                    style={{
                        body: {
                            color: theme.colors.onSurface,
                            fontSize: 16,
                            lineHeight: 24,
                        },
                        heading1: {
                            color: theme.colors.primary,
                            fontSize: 24,
                            marginTop: 20,
                            marginBottom: 10,
                        },
                        heading2: {
                            color: theme.colors.secondary,
                            fontSize: 20,
                            marginTop: 15,
                            marginBottom: 8,
                        },
                        strong: {
                            fontWeight: 'bold',
                        }
                    }}
                >
                    {PRIVACY_CONTENT}
                </Markdown>
                <View style={{ height: 40 }} />
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
});
