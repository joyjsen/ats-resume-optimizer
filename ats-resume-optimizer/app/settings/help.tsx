import React from 'react';
import { ScrollView, StyleSheet, Linking, View, Alert } from 'react-native';
import { Text, List, Button, useTheme, Card, Divider } from 'react-native-paper';
import { Stack } from 'expo-router';

type HelpItem = {
    question: string;
    answer: string | string[];
};

type HelpSection = {
    title: string;
    items: HelpItem[];
};

const HELP_CONTENT: HelpSection[] = [
    {
        title: "Getting Started",
        items: [
            {
                question: "What is ResuMate?",
                answer: "ResuMate is an AI-powered ATS Resume Optimizer that helps you create job-specific resumes, prepare for interviews, and manage your entire job application lifecycle. Unlike traditional resume scanners, ResuMate actually rewrites and optimizes your resume content using advanced AI technology."
            },
            {
                question: "How do I create an account?",
                answer: [
                    "You can sign up using:",
                    "• Google account",
                    "• Facebook account",
                    "• Apple ID",
                    "• Email and password",
                    "Simply select your preferred method on the welcome screen and follow the prompts."
                ]
            },
            {
                question: "What is the token system?",
                answer: [
                    "ResuMate uses a token-based credit system. Tokens are used for AI-powered features:",
                    "• Resume Analysis: 8 tokens (~40 seconds)",
                    "• Resume Optimization: 15 tokens (~60 seconds)",
                    "• Resume Re-optimization: 15 tokens",
                    "• Cover Letter Generation: 15 tokens",
                    "• Prep Guide Generation: 40 tokens",
                    "• AI-Assisted Skill Learning: 30 tokens",
                    "You can purchase token packages through the Profile section using Stripe payment processing."
                ]
            }
        ]
    },
    {
        title: "Resume Analysis & Optimization",
        items: [
            {
                question: "How do I analyze my resume?",
                answer: [
                    "1. Go to the Dashboard",
                    "2. Tap \"Analyze Resume\"",
                    "3. Paste a LinkedIn job URL",
                    "4. Upload your resume (supported formats: image files, .txt, .docx)",
                    "5. Tap \"Start Analysis\"",
                    "The analysis takes about 40 seconds and costs 8 tokens. You'll receive a push notification when complete."
                ]
            },
            {
                question: "What happens during analysis?",
                answer: [
                    "ResuMate compares your resume against the job description and identifies:",
                    "• Matching Skills: Skills you have that match the job requirements",
                    "• Partially Matching Skills: Skills you have that are somewhat relevant",
                    "• Missing Skills: Skills the job requires that aren't on your resume",
                    "• Initial ATS Score: Your baseline score before optimization"
                ]
            },
            {
                question: "Can I cancel an analysis in progress?",
                answer: "Yes, you can cancel at any time by tapping the cancel button. However, tokens will still be deducted once the analysis has started. This is because the AI processing has already begun."
            },
            {
                question: "What if I leave the app during analysis?",
                answer: "No problem! The analysis continues in the background. You'll receive a push notification prompting you to return to the app. If the task takes longer than expected, we'll notify you to check back."
            },
            {
                question: "What if my analysis fails due to an error?",
                answer: "If the analysis fails due to request timeout or system errors (not user cancellation), please contact our admin team through Help & Support with your transaction details. We'll review your case for a potential token refund."
            }
        ]
    },
    {
        title: "Resume Optimization",
        items: [
            {
                question: "How do I optimize my resume?",
                answer: [
                    "After completing an analysis:",
                    "1. Open the application from \"My Applications\" or \"Recent Analyses\"",
                    "2. Tap \"Complete Optimization\" or \"Rewrite & Optimize Resume\"",
                    "3. Wait for the optimization to complete (~60 seconds, 15 tokens)",
                    "Your application status will change from \"Pending Resume Update\" to \"Draft Ready.\""
                ]
            },
            {
                question: "What does optimization include?",
                answer: [
                    "ResuMate's AI rewrites and enhances:",
                    "• Professional Summary: Tailored to the specific job",
                    "• Experience Sections: Optimized bullet points with relevant keywords",
                    "• Skills Section: Added relevant skills from the job description",
                    "• Overall Content: Improved for ATS compatibility"
                ]
            },
            {
                question: "Can I see what changed?",
                answer: [
                    "Absolutely! The Optimization Preview shows:",
                    "• Old vs New ATS Score: See your improvement",
                    "• Original vs Optimized Content: Side-by-side comparison",
                    "• Section-by-section Changes: See exactly what was added, modified, or removed"
                ]
            },
            {
                question: "What are my options after optimization?",
                answer: [
                    "You have four choices:",
                    "1. Review & Edit Changes: Make manual adjustments. Your edits will appear in the preview resume.",
                    "2. Preview Resume: View the full resume with changes (you cannot save from here until you validate).",
                    "3. Reject Changes & Revert: Go back to your original resume and start over. ⚠️ Warning: Tokens already used cannot be refunded.",
                    "4. Validate & Save to Dashboard: Accept the changes and unlock the application in \"My Applications\". Status changes to \"Optimized\"."
                ]
            },
            {
                question: "Can I edit my resume after validating?",
                answer: "Yes! Even after validation, you can continue editing your resume in \"My Applications.\" The resume remains flexible for your needs."
            }
        ]
    },
    {
        title: "Skill Management",
        items: [
            {
                question: "How do I add skills to my resume?",
                answer: [
                    "1. Open an analyzed application",
                    "2. Review the \"Partially Matching\" or \"Missing Skills\" sections",
                    "3. Tap on a skill you want to add",
                    "4. Choose where in your resume to add it (e.g., Skills section, specific experience)",
                    "Adding a skill triggers automatic re-optimization (15 tokens) to integrate it naturally into your resume."
                ]
            },
            {
                question: "What if a skill is already in my resume?",
                answer: "The app will notify you that the \"Skill already present\" and won't charge you for adding it again."
            },
            {
                question: "What are the learning options when adding a skill?",
                answer: [
                    "When you add a skill, you'll see three options:",
                    "1. Self-Learning (Free): Declare that you've learned this skill on your own. Entry saved in your Learning Hub.",
                    "2. AI-Assisted Learning (30 tokens): Get personalized training materials tailored to the job position. Access resources in the Learning Hub.",
                    "3. Add Without Declaration (Free): Add the skill to your resume without recording it in Learning Hub."
                ]
            },
            {
                question: "What happens during re-optimization?",
                answer: [
                    "After adding a skill:",
                    "• The AI re-optimizes your resume with the new skill (15 tokens)",
                    "• You'll see visual indicators showing exactly where and how the skill was integrated",
                    "• Original vs updated content is displayed",
                    "• You can review, edit, reject, or validate just like the initial optimization"
                ]
            },
            {
                question: "Can I add multiple skills at once?",
                answer: [
                    "You can add skills one at a time. After each addition and re-optimization, you can:",
                    "• Continue adding more skills immediately",
                    "• Save and add more skills later",
                    "Each skill addition triggers a separate re-optimization (15 tokens each)."
                ]
            }
        ]
    },
    {
        title: "Cover Letters",
        items: [
            {
                question: "How do I generate a cover letter?",
                answer: [
                    "1. Open an optimized application from \"My Applications\"",
                    "2. Tap \"Generate Cover Letter\"",
                    "3. Wait for generation to complete (15 tokens)",
                    "The cover letter is tailored to the specific job and your optimized resume."
                ]
            },
            {
                question: "Can I regenerate a cover letter?",
                answer: "Yes! If you're not satisfied with the result, tap \"Regenerate\" to create a new version. Each generation costs 15 tokens."
            },
            {
                question: "Can I edit the cover letter?",
                answer: "Yes, you can edit the generated cover letter before downloading or using it."
            }
        ]
    },
    {
        title: "Interview Prep Guides",
        items: [
            {
                question: "What is a Prep Guide?",
                answer: [
                    "A Prep Guide is a comprehensive interview preparation document that includes:",
                    "• Company Intelligence: Research and insights about the employer",
                    "• Role Analysis: Deep dive into the position requirements",
                    "• Technical Preparation: Relevant technical topics and questions",
                    "• Behavioral Frameworks: STAR method examples mapped to your experiences",
                    "• Strategic Interview Guidance: Tips specific to this opportunity"
                ]
            },
            {
                question: "How do I create a Prep Guide?",
                answer: [
                    "1. Open an optimized application",
                    "2. Tap \"Generate Prep Guide\"",
                    "3. Wait for generation (~40 tokens)",
                    "The prep guide is personalized based on your resume content and the job requirements."
                ]
            },
            {
                question: "When can I regenerate a Prep Guide?",
                answer: "The \"Regenerate\" option becomes active when you update skills in your resume. This ensures your prep guide stays aligned with your latest resume content. Each generation costs 40 tokens."
            }
        ]
    },
    {
        title: "Learning Hub",
        items: [
            {
                question: "What is the Learning Hub?",
                answer: "The Learning Hub is where you access AI-generated training materials for skills you're developing. It tracks your learning journey and provides personalized resources."
            },
            {
                question: "How do I access learning materials?",
                answer: [
                    "1. Add a skill to your resume from the analysis results",
                    "2. Select \"AI-Assisted Learning\" (30 tokens)",
                    "3. Access your personalized training materials in the Learning Hub"
                ]
            },
            {
                question: "Can I track my learning progress?",
                answer: [
                    "Yes! When you choose self-learning or AI-assisted learning, the entry is recorded in your Learning Hub with:",
                    "• The skill name",
                    "• Date obtained",
                    "• Learning method chosen",
                    "• Associated job applications"
                ]
            }
        ]
    },
    {
        title: "My Applications",
        items: [
            {
                question: "What is \"My Applications\"?",
                answer: [
                    "This is your central hub for managing all analyzed and optimized resumes. Each application card shows:",
                    "• Company name and position",
                    "• Current status (Locked, Pending, Draft Ready, Optimized)",
                    "• Date analyzed",
                    "• Quick actions available"
                ]
            },
            {
                question: "Why is my application \"locked\"?",
                answer: "Applications remain locked until you complete the optimization process. This ensures you don't accidentally use an unoptimized resume. Once you \"Validate & Save,\" the application unlocks."
            },
            {
                question: "What can I do from \"My Applications\"?",
                answer: [
                    "• View and edit optimized resumes",
                    "• Download resumes in various formats",
                    "• Generate cover letters",
                    "• Create prep guides",
                    "• Add more skills and re-optimize",
                    "• Track application status"
                ]
            }
        ]
    },
    {
        title: "Dashboard & Activity Tracking",
        items: [
            {
                question: "What's on my Dashboard?",
                answer: [
                    "Your Dashboard provides:",
                    "• Recent Analyses: Quick access to your latest resume analyses",
                    "• Application Status Cards: Overview of pending and completed optimizations",
                    "• Quick Actions: Fast access to analyze new resumes",
                    "• Activity Summary: Recent token usage and tasks"
                ]
            },
            {
                question: "How do I view my token usage?",
                answer: [
                    "Go to Profile → Available Tokens. You can view:",
                    "• Number of activities performed",
                    "• Tokens used by activity type",
                    "• Activity history with filters"
                ]
            }
        ]
    },
    {
        title: "Token Management & Purchases",
        items: [
            {
                question: "How do I check my token balance?",
                answer: "Your available token balance is always visible in the Profile section at the top of the screen."
            },
            {
                question: "How do I purchase more tokens?",
                answer: [
                    "1. Go to Profile",
                    "2. Tap \"Purchase Tokens\"",
                    "3. Select a token package",
                    "4. Complete payment through Stripe",
                    "Tokens are added to your account immediately."
                ]
            },
            {
                question: "Is my payment information secure?",
                answer: "Yes! ResuMate uses Stripe, a industry-leading secure payment processor. We never store your credit card information on our servers."
            },
            {
                question: "What happens if I run out of tokens?",
                answer: "If you attempt to perform an action without sufficient tokens, you'll receive an alert notifying you that your credits have expired. As a one-time courtesy, we may allow the current transaction to proceed."
            }
        ]
    },
    {
        title: "Profile & Settings",
        items: [
            {
                question: "How do I update my profile?",
                answer: "Go to Profile → Edit Profile. Update your name, email, or other details and save changes."
            },
            {
                question: "Can I change the app's appearance?",
                answer: "Yes! Go to Profile → Settings → Appearance to switch between Light and Dark mode."
            },
            {
                question: "How do I delete my account?",
                answer: "Go to Profile, scroll to bottom, and tap \"Delete Account\". ⚠️ Warning: Account deletion is permanent. All your data will be lost."
            }
        ]
    },
    {
        title: "Troubleshooting",
        items: [
            {
                question: "My analysis is stuck or taking too long",
                answer: [
                    "• Check your internet connection",
                    "• Wait for the notification (some tasks take up to 60s)",
                    "• Return to the app if prompted",
                    "• Contact support if issue persists > 2 mins"
                ]
            },
            {
                question: "I didn't receive my tokens after purchase",
                answer: [
                    "• Check Purchase History to verify transaction",
                    "• Refresh the app",
                    "• Wait 1-2 minutes for processing",
                    "• Contact support if tokens don't appear within 5 mins"
                ]
            },
            {
                question: "The job URL isn't working",
                answer: [
                    "• LinkedIn URLs only: Currently, we only support LinkedIn job postings",
                    "• Check the URL format: Ensure you've copied the complete URL",
                    "• Try copying again"
                ]
            },
            {
                question: "Changes aren't saving",
                answer: [
                    "• Complete the validation: Ensure you tapped \"Validate & Save to Dashboard\"",
                    "• Check your connection",
                    "• Try again: Close and reopen the application"
                ]
            }
        ]
    },
    {
        title: "Privacy & Security",
        items: [
            {
                question: "How is my data protected?",
                answer: [
                    "ResuMate takes your privacy seriously:",
                    "• All data is encrypted in transit and at rest",
                    "• We use Firebase secure authentication",
                    "• Payment processing through Stripe (PCI compliant)",
                    "• We never share your personal information with third parties"
                ]
            },
            {
                question: "What data do you collect?",
                answer: [
                    "• Account information (name, email)",
                    "• Resume content (for analysis and optimization)",
                    "• Job URLs (for matching)",
                    "• Usage analytics (to improve the service)",
                    "• Payment information (processed securely by Stripe)"
                ]
            },
            {
                question: "Can I see your Privacy Policy?",
                answer: "Yes! Access it from Profile → Privacy Policy"
            },
            {
                question: "Where are the Terms of Service?",
                answer: "Find them at Profile → Terms of Service"
            }
        ]
    },
    {
        title: "Contact & Support",
        items: [
            {
                question: "How do I get help?",
                answer: [
                    "In-App Support:",
                    "• Go to Profile → Help & Support",
                    "• Browse FAQs and help articles",
                    "• Submit a support request if needed",
                    "",
                    "Email Support: support@resumate.ai",
                    "Response Time: We typically respond within 24-48 hours"
                ]
            },
            {
                question: "What information should I include in a support request?",
                answer: [
                    "• Your account email",
                    "• Description of the issue",
                    "• Screenshots (if applicable)",
                    "• Transaction ID or activity ID (for token/payment issues)",
                    "• Device and app version"
                ]
            },
            {
                question: "How do I request a token refund?",
                answer: [
                    "Token refunds are only available for:",
                    "• System errors (timeouts, crashes)",
                    "• Failed transactions where you were charged but didn't receive service",
                    "",
                    "Not eligible for refund:",
                    "• User-initiated cancellations",
                    "• Rejected optimizations (after reviewing results)",
                    "• Dissatisfaction with AI-generated content",
                    "",
                    "To request a refund:",
                    "1. Go to Help & Support",
                    "2. Select \"Request Token Refund\"",
                    "3. Provide transaction details and error description",
                    "4. Our admin team will review within 48 hours"
                ]
            }
        ]
    },
    {
        title: "About ResuMate",
        items: [
            {
                question: "What makes ResuMate different?",
                answer: [
                    "Unlike traditional resume scanners that just give you a score, ResuMate:",
                    "• Actually rewrites your content using advanced AI",
                    "• Optimizes for specific jobs, not generic templates",
                    "• Manages your entire job search lifecycle in one place",
                    "• Provides interview prep mapped to your actual experiences",
                    "• Mobile-first design for job searching on the go"
                ]
            },
            {
                question: "What AI technology does ResuMate use?",
                answer: "ResuMate uses state-of-the-art language models optimized for resume writing, skill matching, and career content generation. We've carefully selected cost-efficient models that maintain high quality while keeping token prices affordable."
            },
            {
                question: "How often is ResuMate updated?",
                answer: "We regularly release updates with new features, improvements, and bug fixes. Enable automatic updates in your device settings to always have the latest version."
            },
            {
                question: "What's coming next?",
                answer: [
                    "Upcoming features include:",
                    "• Multiple file format support for downloads",
                    "• Certificate uploads in Learning Hub",
                    "• Affiliate course integration",
                    "• Advanced payment method management",
                    "• Enhanced analytics and insights"
                ]
            }
        ]
    },
    {
        title: "Tips for Success",
        items: [
            {
                question: "Maximize Your ATS Score",
                answer: [
                    "• Be honest: Only add skills you actually have or are willing to learn",
                    "• Use keywords from the JD: Pay attention to how the job is worded",
                    "• Quantify achievements: Numbers make your accomplishments stand out",
                    "• Customize for each job: Don't use the same resume for every application",
                    "• Update regularly: As you add skills, re-optimize your resume"
                ]
            },
            {
                question: "Make the Most of Your Tokens",
                answer: [
                    "• Analyze first: Review the analysis before optimizing to see if the job is a good fit",
                    "• Batch skill additions: Add multiple skills in one session if possible",
                    "• Review carefully before rejecting: Rejecting costs you the tokens already spent",
                    "• Use prep guides strategically: Generate them for your most important applications"
                ]
            },
            {
                question: "Interview Preparation Best Practices",
                answer: [
                    "• Study your prep guide thoroughly: It's personalized to your situation",
                    "• Practice STAR responses: Use the frameworks provided",
                    "• Research the company: Go beyond what's in the prep guide",
                    "• Review your optimized resume: Be ready to discuss everything on it",
                    "• Track your learning: Use the Learning Hub to document your progress"
                ]
            }
        ]
    },
    {
        title: "Need More Help?",
        items: [
            {
                question: "Contact Us",
                answer: [
                    "If you couldn't find what you're looking for, please contact us through Profile → Help & Support. We're here to help you succeed in your job search!",
                    "",
                    "Version: 1.0",
                    "Last Updated: 01/28/2026"
                ]
            }
        ]
    }
];

export default function HelpSupportScreen() {
    const theme = useTheme();

    const handleEmailSupport = () => {
        const email = 'pjmarket1316@gmail.com';
        const subject = 'Support Request: ATS Resume Optimizer';
        const body = 'Please describe your issue here...';
        const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        Linking.canOpenURL(url).then(supported => {
            if (supported) {
                Linking.openURL(url);
            } else {
                Alert.alert("Error", "Could not open email client.");
            }
        });
    };
    const renderAnswer = (answer: string | string[]) => {
        if (Array.isArray(answer)) {
            return (
                <View>
                    {answer.map((line, index) => (
                        <Text key={index} variant="bodyMedium" style={{ marginBottom: 4 }}>
                            {line}
                        </Text>
                    ))}
                </View>
            );
        }
        return (
            <Text variant="bodyMedium">
                {answer}
            </Text>
        );
    };

    return (
        <>
            <Stack.Screen options={{ title: 'Help & Support' }} />
            <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>

                <Card style={styles.card}>
                    <Card.Content>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Contact Us</Text>
                        <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                            We are here to help! If you have any questions or issues, please reach out.
                        </Text>

                        <Button
                            mode="contained"
                            icon="email"
                            onPress={handleEmailSupport}
                            style={styles.button}
                        >
                            Email Support
                        </Button>
                        <Text variant="bodySmall" style={{ textAlign: 'center', marginTop: 4, color: theme.colors.outline }}>
                            pjmarket1316@gmail.com
                        </Text>
                    </Card.Content>
                </Card>

                <Divider style={styles.divider} />

                {HELP_CONTENT.map((section, index) => (
                    <View key={index} style={{ marginBottom: 24 }}>
                        <Text variant="titleLarge" style={styles.header}>{section.title}</Text>
                        <List.AccordionGroup>
                            {section.items.map((item, itemIndex) => (
                                <List.Accordion
                                    key={itemIndex}
                                    title={item.question}
                                    id={`${index}-${itemIndex}`}
                                    titleNumberOfLines={2}
                                >
                                    <View style={styles.answerContainer}>
                                        {renderAnswer(item.answer)}
                                    </View>
                                </List.Accordion>
                            ))}
                        </List.AccordionGroup>
                        {index < HELP_CONTENT.length - 1 && <Divider style={{ marginTop: 16 }} />}
                    </View>
                ))}

                <View style={{ height: 40 }} />
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    header: {
        marginBottom: 8,
        fontWeight: 'bold',
        color: '#2196F3'
    },
    sectionTitle: {
        marginBottom: 8,
        fontWeight: 'bold',
    },
    card: {
        marginBottom: 24,
    },
    button: {
        marginVertical: 4,
    },
    divider: {
        marginBottom: 24,
    },
    answerContainer: {
        padding: 16,
        backgroundColor: 'rgba(0,0,0,0.02)'
    }
});
