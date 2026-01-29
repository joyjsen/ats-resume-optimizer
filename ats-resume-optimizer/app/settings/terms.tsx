import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Stack } from 'expo-router';
import Markdown from 'react-native-markdown-display';

const TERMS_CONTENT = `
# ResuMate Terms of Service
**Last Updated:** January 27, 2026
**Effective Date:** January 27, 2026

Please read these Terms of Service ("Terms", "Terms of Service") carefully before using the ResuMate mobile application (the "Service") operated by [Your Company Name] ("us", "we", or "our").

Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms. These Terms apply to all visitors, users, and others who access or use the Service.

By accessing or using the Service you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service.

## 1. Definitions
**1.1** "Service" refers to the ResuMate mobile application and all related services, features, content, and applications offered by us.
**1.2** "User," "you," and "your" refer to the individual person, company, or organization that has visited or is using the Service.
**1.3** "Content" means text, graphics, images, music, software, audio, video, works of authorship of any kind, and information or other materials that are posted, generated, provided, or otherwise made available through the Service.
**1.4** "User Content" means any Content that you upload, submit, post, or otherwise make available through the Service, including but not limited to resumes, cover letters, job descriptions, and profile information.
**1.5** "Tokens" refers to the virtual credits used within the Service to access AI-powered features.

## 2. Account Registration and Eligibility
**2.1 Eligibility**
You must be at least 18 years of age to use the Service. By agreeing to these Terms, you represent and warrant that you are at least 18 years old and have the legal capacity to enter into these Terms.

**2.2 Account Creation**
To access certain features of the Service, you must create an account. You may register using:
* Google account
* Facebook account
* Apple ID
* Email and password

**2.3 Account Responsibility**
You are responsible for:
* Maintaining the confidentiality of your account credentials
* All activities that occur under your account
* Notifying us immediately of any unauthorized use of your account
* Ensuring that your account information is accurate and current

**2.4 Account Termination**
We reserve the right to suspend or terminate your account at any time for violation of these Terms, fraudulent activity, or any other reason we deem necessary to protect the Service and other users.

## 3. Token System and Payments
**3.1 Token Purchase**
Tokens are purchased through the Service using Stripe payment processing. Token packages and pricing are displayed within the app and may be changed at our discretion with notice to users.

**3.2 Token Usage**
Tokens are consumed when you use AI-powered features:
* Resume Analysis: 8 tokens
* Resume Optimization: 15 tokens
* Resume Re-optimization: 15 tokens
* Cover Letter Generation: 15 tokens
* Prep Guide Generation: 40 tokens
* AI-Assisted Skill Learning: 30 tokens

**3.3 Token Consumption**
Tokens are deducted when a task is initiated, regardless of whether you cancel the task mid-process. Once AI processing has begun, tokens are non-refundable except as specified in Section 3.5.

**3.4 Non-Transferability**
Tokens are non-transferable and have no cash value. Tokens cannot be transferred between accounts or redeemed for cash.

**3.5 Refund Policy**
Eligible for Refund:
* System errors (server timeouts, crashes, technical failures on our end)
* Failed transactions where tokens were deducted but no service was provided
* Duplicate charges due to payment processing errors

Not Eligible for Refund:
* User-initiated cancellations after processing has begun
* Rejected optimization results after reviewing the content
* Dissatisfaction with AI-generated content quality
* Change of mind after purchasing tokens

To request a refund, contact our support team within 7 days of the transaction with your transaction ID and a description of the issue.

**3.6 Payment Processing**
All payments are processed securely through Stripe. We do not store your payment information on our servers. By making a purchase, you agree to Stripe's Terms of Service and Privacy Policy.

**3.7 Pricing Changes**
We reserve the right to modify token pricing at any time. Price changes will not affect tokens you have already purchased, but will apply to future purchases.

## 4. Use of the Service
**4.1 License**
Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal, non-commercial use.

**4.2 Acceptable Use**
You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree NOT to:
* Use the Service in any way that violates any applicable federal, state, local, or international law or regulation
* Impersonate or attempt to impersonate us, our employees, another user, or any other person or entity
* Engage in any conduct that restricts or inhibits anyone's use or enjoyment of the Service
* Use any robot, spider, or other automatic device, process, or means to access the Service for any purpose
* Introduce any viruses, trojan horses, worms, logic bombs, or other material that is malicious or technologically harmful
* Attempt to gain unauthorized access to, interfere with, damage, or disrupt any parts of the Service
* Use the Service to generate content that is defamatory, obscene, harassing, or violates any third party's rights
* Sell, rent, lease, or otherwise commercialize access to the Service or tokens
* Reverse engineer, decompile, or disassemble any portion of the Service
* Remove, alter, or obscure any proprietary notices on the Service
* Use the Service to create competing products or services

**4.3 Job Application Submissions**
You are solely responsible for:
* The accuracy of information in your resumes and cover letters
* Verifying that optimized content accurately represents your qualifications
* Any representations you make to potential employers
* Compliance with employer application requirements

We are not responsible for the success or failure of your job applications.

## 5. User Content
**5.1 Ownership**
You retain all ownership rights to your User Content. By uploading User Content to the Service, you do not transfer ownership to us.

**5.2 License to Us**
By providing User Content to the Service, you grant us a worldwide, non-exclusive, royalty-free, sublicensable license to use, reproduce, modify, adapt, publish, and display such User Content solely for the purpose of:
* Providing and improving the Service
* Generating AI-powered resume optimizations, cover letters, and prep guides
* Training and improving our AI models
* Analyzing usage patterns to enhance the Service

This license terminates when you delete your User Content or account, except for Content that has been shared or used in accordance with these Terms.

**5.3 Responsibility for User Content**
You are solely responsible for your User Content and the consequences of posting or publishing it. You represent and warrant that:
* You own or have the necessary rights to your User Content
* Your User Content does not violate any third-party rights
* Your User Content is accurate and not misleading
* Your User Content complies with these Terms and applicable laws

**5.4 Prohibited Content**
You may not upload User Content that:
* Contains false, fraudulent, or misleading information
* Infringes on any intellectual property or other rights of any other person
* Contains confidential or proprietary information of third parties
* Contains malicious code, viruses, or harmful components

**5.5 Content Removal**
We reserve the right to remove or refuse to process any User Content that violates these Terms or that we find objectionable for any reason.

## 6. AI-Generated Content
**6.1 Nature of AI Content**
The Service uses artificial intelligence to generate and optimize resumes, cover letters, prep guides, and learning materials. AI-generated content is created based on your inputs and job descriptions.

**6.2 No Guarantees**
While we strive to provide high-quality AI-generated content, we make no guarantees regarding:
* Accuracy or completeness of AI-generated content
* Success in job applications using optimized resumes
* Interview performance based on prep guides
* Skill acquisition from learning materials
* ATS score improvements or job matching results

**6.3 Review Responsibility**
You are solely responsible for reviewing, editing, and approving all AI-generated content before using it. You should:
* Verify that all information is accurate
* Ensure content represents your actual qualifications
* Edit content to match your personal style and voice
* Confirm that optimized content meets your standards

**6.4 Professional Advice Disclaimer**
The Service does not provide professional career counseling, legal advice, or employment advice. AI-generated content should not be considered professional advice. For professional guidance, consult with qualified career counselors or employment professionals.

## 7. Intellectual Property Rights
**7.1 Our Intellectual Property**
The Service and its original content (excluding User Content), features, and functionality are and will remain the exclusive property of [Your Company Name] and its licensors. The Service is protected by copyright, trademark, and other laws of both the United States and foreign countries.

**7.2 Trademarks**
ResuMate and related logos, graphics, and service names are trademarks of [Your Company Name]. You may not use these trademarks without our prior written permission.

**7.3 Feedback**
If you provide us with any feedback, suggestions, or ideas about the Service ("Feedback"), you grant us a perpetual, irrevocable, worldwide, royalty-free license to use, modify, and incorporate such Feedback into the Service without any obligation to you.

## 8. Third-Party Services and Links
**8.1 Third-Party Authentication**
The Service allows you to authenticate using third-party services (Google, Facebook, Apple). Your use of these services is governed by their respective terms of service and privacy policies.

**8.2 Payment Processing**
Payments are processed by Stripe. Your payment information is subject to Stripe's Terms of Service and Privacy Policy. We are not responsible for Stripe's services or any issues arising from their payment processing.

**8.3 Third-Party Links**
The Service may contain links to third-party websites or services (such as LinkedIn for job postings). We are not responsible for the content, privacy policies, or practices of any third-party sites or services.

## 9. Privacy and Data Protection
**9.1 Privacy Policy**
Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference. Please review our Privacy Policy to understand our practices regarding your personal data.

## 10. Disclaimers and Limitations of Liability
**10.1 Service "As Is"**
THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.

**10.4 Maximum Liability**
TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU HAVE PAID US IN THE PAST TWELVE (12) MONTHS, OR (B) ONE HUNDRED DOLLARS ($100).

## 12. Dispute Resolution
**12.1 Governing Law**
These Terms shall be governed by and construed in accordance with the laws of [Your State/Country].

**12.2 Arbitration Agreement**
Any dispute shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.

**12.3 Class Action Waiver**
YOU AGREE THAT ANY ARBITRATION OR PROCEEDING SHALL BE LIMITED TO THE DISPUTE BETWEEN YOU AND US INDIVIDUALLY.

## 16. Contact Information
If you have any questions about these Terms, please contact us:
* By Email: [Your Support Email]
* Through the App: Profile → Help & Support
`;

export default function TermsScreen() {
    const theme = useTheme();

    return (
        <>
            <Stack.Screen options={{ title: 'Terms of Service' }} />
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
                    {TERMS_CONTENT}
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
