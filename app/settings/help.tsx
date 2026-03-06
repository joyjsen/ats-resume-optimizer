import React from 'react';
import { ScrollView, StyleSheet, Linking, View, Alert } from 'react-native';
import { Text, List, Button, useTheme, Card, Divider } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';

type HelpItem = {
    question: string;
    answer: string | (string | { segments: { text: string; link?: string; style?: any }[] })[];
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
                question: "What is RiResume?",
                answer: "RiResume is an AI-powered ATS Resume Optimizer available on web, Android, and iOS. It helps you create job-specific resumes, prepare for interviews, and manage your entire job application lifecycle. Unlike traditional resume scanners that just give you a score, RiResume actively rewrites and optimizes your resume content using advanced AI technology."
            },
            {
                question: "How do I create an account?",
                answer: [
                    "You can sign up using:",
                    "• Google account",
                    "• Apple ID",
                    "• Email and password",
                    "Simply select your preferred method on the welcome screen and follow the prompts."
                ]
            },
            {
                question: "What is the token system?",
                answer: [
                    "RiResume uses a token-based credit system. Tokens are used for AI-powered features:",
                    "• Resume Analysis: 8 tokens (~40 seconds)",
                    "• Resume Optimization: 15 tokens (~60 seconds)",
                    "• Resume Re-optimization (Add skills to resume): 15 tokens (~60 seconds)",
                    "• Cover Letter Generation: 15 tokens (~10 seconds)",
                    "• Prep Guide Generation: 40 tokens (~10 minutes)",
                    "• Prep Guide Re-Generation (activated when skills are added to an existing resume): 40 tokens (~10 minutes)",
                    "• AI-Assisted Skill Learning: 30 tokens (~60 seconds)",
                    "",
                    "You get 110 tokens to begin with, which should be enough for you to Analyze one resume against your job description, rewrite and optimize it, create a cover letter, and learn basics of a missing skill. Take advantage of adding a personalized and comprehensive prep guide too.",
                    "",
                    "Token packages are available for purchase:",
                    "• 100 tokens — $4.99",
                    "• 250 tokens — $9.99",
                    "• 500 tokens — $14.99",
                    "",
                    "You can purchase token packages through the Profile section using Stripe payment processing."
                ]
            },
            {
                question: "How do I share a job posting into RiResume?",
                answer: [
                    "RiResume supports job URL sharing from multiple platforms:",
                    "• LinkedIn job postings",
                    "• Indeed job postings",
                    "• Any valid job URL from other job boards",
                    "",
                    "Simply copy the job URL and paste it into the app. RiResume will automatically scan and extract the job details. If you're not satisfied with what was parsed, you can manually edit the job description before proceeding."
                ]
            }
        ]
    },
    {
        title: "Resume Analysis",
        items: [
            {
                question: "How do I analyze my resume?",
                answer: [
                    "1. Go to the Dashboard",
                    "2. Tap \"Analyze Resume\"",
                    "3. Paste a job URL (LinkedIn, Indeed, or any valid job posting URL)",
                    "4. Review the extracted job details — edit manually if needed",
                    "5. Upload your resume (supported formats: image files, .txt, .docx)",
                    "6. Tap \"Start Analysis\"",
                    "The analysis takes about 40 seconds and costs 8 tokens. You'll receive a push notification when complete."
                ]
            },
            {
                question: "What happens during analysis?",
                answer: [
                    "RiResume compares your resume against the job description and identifies:",
                    "• Matching Skills: Skills you have that match the job requirements",
                    "• Partially Matching Skills: Skills you have that are somewhat relevant",
                    "• Missing Skills: Skills the job requires that aren't on your resume",
                    "• Initial ATS Score: Your baseline score before optimization",
                    "",
                    "This helps you understand where you stand for the role and what improvements are possible."
                ]
            },
            {
                question: "Can I cancel an analysis in progress?",
                answer: "Yes, you can cancel at any time by tapping the cancel button. However, tokens will still be deducted once the analysis has started. This is because the AI processing has already begun."
            },
            {
                question: "What if I leave the app during analysis?",
                answer: "No problem! The analysis continues running in the background. You'll receive a push notification prompting you to return to the app when it's ready. If the task takes longer than expected, we'll notify you to check back."
            },
            {
                question: "What if my analysis fails due to an error?",
                answer: "If the analysis fails due to request timeout or system errors (not user cancellation), please contact our support team through Help & Support with your transaction details. We'll review your case for a potential token refund."
            },
            {
                question: "Where does my analysis appear after completion?",
                answer: [
                    "Once analysis is complete:",
                    "• The application appears on your Dashboard under recent analyses",
                    "• It also appears in My Applications with a \"Locked\" status",
                    "• The application remains locked until you complete the optimization process",
                    "• Your Dashboard shows the application status as \"Pending Resume Update\""
                ]
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
                    {
                        segments: [
                            { text: "1. Open the application from \"" },
                            { text: "Optimize", link: "/(tabs)/optimize", style: { fontWeight: 'bold' } },
                            { text: "\" or \"" },
                            { text: "Applications", link: "/(tabs)/applications", style: { fontWeight: 'bold' } },
                            { text: "\"" }
                        ]
                    },
                    "2. Tap \"Complete Optimization\" or \"Rewrite & Optimize Resume\"",
                    "3. Wait for the optimization to complete (~60 seconds, 15 tokens)",
                    "",
                    "The optimization runs in the background — you'll receive a push notification when it's done. If it's still not completed in 60 seconds, a push notification will ask you to go back to the app to continue.",
                    "",
                    "Your application status will change from \"Pending Resume Update\" to \"Draft Ready.\""
                ]
            },
            {
                question: "What does optimization include?",
                answer: [
                    "RiResume's AI rewrites and enhances:",
                    "• Professional Summary: Tailored to the specific job",
                    "• Experience Sections: Optimized bullet points with relevant keywords",
                    "• Skills Section: Added relevant skills from the job description",
                    "• Overall Content: Improved for ATS compatibility",
                    "",
                    "This guarantees an increase in your ATS score. Further improvement is possible by adding additional skills."
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
                    "1. Review & Edit Changes: Make manual adjustments for free. Your edits will appear in the preview resume.",
                    "2. Preview & Download Resume: View and download the full resume in .docx format (you cannot save from here until you validate).",
                    "3. Reject Changes & Revert: Go back to your original resume and start over. ⚠️ Warning: Tokens already used cannot be refunded.",
                    "4. Validate & Save to Dashboard: Accept the changes and unlock the application in \"My Applications\". Status changes to \"Optimized\"."
                ]
            },
            {
                question: "Can I edit my resume manually?",
                answer: "Yes! Manual editing is always free. At each and every optimization step, you get a chance to manually update your resume at no cost. Even after validation, you can continue editing your resume in \"My Applications.\""
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
                    "4. Choose which section of your resume to add it to (e.g., Skills section, a specific work experience entry)",
                    "Adding a skill triggers automatic re-optimization (15 tokens) to surgically integrate it into the selected section of your resume."
                ]
            },
            {
                question: "How does surgical skill insertion work?",
                answer: [
                    "When you add a skill, RiResume doesn't just append it to a list. The AI:",
                    "• Surgically inserts the skill into your chosen resume section",
                    "• Shows you visual indicators of exactly where and how the skill was integrated",
                    "• Displays original vs updated content so you can see the changes",
                    "• Recalculates your ATS score to reflect the improvement",
                    "",
                    "You can review, manually edit (free), reject, or validate — just like the initial optimization."
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
                    "2. AI-Assisted Learning (30 tokens): Get a personalized learning pathway presented as an interactive slideshow, tailored to the job position. Access resources in the Learning Hub.",
                    "3. Add Without Declaration (Free): Add the skill to your resume without recording it in Learning Hub."
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
                answer: "Yes! If you're not satisfied with the result, tap \"Regenerate\" to create a new version. Each regeneration also costs 15 tokens."
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
                    "A Prep Guide is a comprehensive, personalized interview preparation document that includes:",
                    "• Company Intelligence: Research and insights about the employer (powered by real-time web data)",
                    "• Role Analysis: Deep dive into the position requirements",
                    "• Technical Preparation: Relevant technical topics and questions",
                    "• Behavioral Frameworks: STAR method examples mapped to your actual experiences",
                    "• Story Mapping: Personalized STAR framework outlines drawn from your real resume content to help you craft compelling interview answers",
                    "• Strategic Interview Guidance: Tips specific to this opportunity"
                ]
            },
            {
                question: "How do I create a Prep Guide?",
                answer: [
                    "1. Open an optimized application",
                    "2. Tap \"Generate Prep Guide\"",
                    "3. Wait for generation (~10 minutes, 40 tokens)",
                    "The prep guide is personalized based on your resume content and the job requirements. You'll receive a push notification when it's ready."
                ]
            },
            {
                question: "When can I regenerate a Prep Guide?",
                answer: "The \"Regenerate\" option becomes active when you update skills in your resume. This ensures your prep guide stays aligned with your latest resume content. Each regeneration costs 40 tokens."
            },
            {
                question: "What is Story Mapping?",
                answer: [
                    "Story Mapping is a key section of your Prep Guide that uses the STAR framework (Situation, Task, Action, Result) to help you prepare interview answers:",
                    "• It pulls directly from your actual resume experiences",
                    "• Creates structured outlines for behavioral interview questions",
                    "• Maps your real accomplishments to likely interview questions for the role",
                    "• Helps you articulate your experiences clearly and compellingly",
                    "",
                    "This is one of the most valuable sections of the Prep Guide — it turns your resume bullet points into interview-ready stories."
                ]
            }
        ]
    },
    {
        title: "Learning Hub",
        items: [
            {
                question: "What is the Learning Hub?",
                answer: "The Learning Hub is where you access AI-generated training materials for skills you're developing. It tracks your learning journey and provides personalized resources presented as interactive slideshows."
            },
            {
                question: "How do I access learning materials?",
                answer: [
                    "1. Add a skill to your resume from the analysis results",
                    "2. Select \"AI-Assisted Learning\" (30 tokens)",
                    "3. The AI generates a personalized learning pathway as an interactive slideshow",
                    "4. Access all your generated learning materials anytime in the Learning tab"
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
                    "• Current status (Locked, Pending Resume Update, Draft Ready, Optimized)",
                    "• Date analyzed",
                    "• Quick actions available"
                ]
            },
            {
                question: "What do the application statuses mean?",
                answer: [
                    "• Locked: Analysis complete but optimization not yet started. You cannot use the resume yet.",
                    "• Pending Resume Update: You've initiated but not yet completed the optimization.",
                    "• Draft Ready: Optimization complete. Review, edit, or validate your resume.",
                    "• Optimized: You've validated and saved. Full access to resume, cover letter, prep guide, and skill additions."
                ]
            },
            {
                question: "Why is my application \"locked\"?",
                answer: "Applications remain locked until you complete the optimization process. This ensures you don't accidentally use an unoptimized resume. Once you \"Validate & Save,\" the application unlocks."
            },
            {
                question: "What can I do from \"My Applications\"?",
                answer: [
                    "• View and edit optimized resumes (manual editing is always free)",
                    "• Preview and download resumes in .docx format",
                    "• Generate cover letters",
                    "• Create prep guides",
                    "• Add more skills and re-optimize",
                    "• Track application status"
                ]
            }
        ]
    },
    {
        title: "App Navigation",
        items: [
            {
                question: "What are the main sections of the app?",
                answer: [
                    "RiResume has 5 main tabs:",
                    "1. Home (Dashboard): Your central hub with recent analyses, status cards, and quick actions",
                    "2. Applications: Manage all your analyzed and optimized resumes",
                    "3. Learning: Access your Learning Hub with AI-generated skill training materials",
                    "4. Analytics: Track your job search progress and token usage",
                    "5. Profile: Manage your account, purchase tokens, access settings, and get help"
                ]
            }
        ]
    },
    {
        title: "Dashboard & Analytics",
        items: [
            {
                question: "What's on my Dashboard?",
                answer: [
                    "Your Dashboard provides:",
                    "• Recent Analyses: Quick access to your latest resume analyses",
                    "• Application Status Cards: Overview of pending and completed optimizations with current status",
                    "• Quick Actions: Fast access to analyze new resumes",
                    "• Activity Summary: Recent token usage and tasks"
                ]
            },
            {
                question: "What's in the Analytics tab?",
                answer: [
                    "The Analytics tab gives you insights into your job search journey:",
                    "• Overview of all your applications and their statuses",
                    "• Token usage breakdown by activity type",
                    "• Progress tracking across your job search"
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
                    "3. Select a token package:",
                    "   • 100 tokens — $4.99",
                    "   • 250 tokens — $9.99",
                    "   • 500 tokens — $14.99",
                    "4. Complete payment through Stripe",
                    "Tokens are added to your account immediately."
                ]
            },
            {
                question: "Why tokens instead of a subscription?",
                answer: "We believe in transparent, pay-as-you-go pricing. With tokens, you only pay for what you use — no recurring charges, no hidden fees, and no surprise upsells. You stay in full control of your spending."
            },
            {
                question: "Is my payment information secure?",
                answer: "Yes! RiResume uses Stripe, an industry-leading secure payment processor. We never store your credit card information on our servers. All transactions are PCI compliant."
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
                answer: "Yes! Go to Profile → Settings → Appearance to switch between Light and Dark mode. The entire app adapts to your preference."
            },
            {
                question: "How do I delete my account?",
                answer: "Go to Profile, scroll to bottom, and tap \"Delete Account\". ⚠️ Warning: Account deletion is permanent after the 30-day grace period. All your data, tokens, and history will be lost."
            }
        ]
    },
    {
        title: "Account Management & Restoration",
        items: [
            {
                question: "I was reactivated but can't log in with my old password",
                answer: "If your account was recently reactivated by an admin, you might encounter a login error on the first attempt due to local caching. Please try logging in with the same password a second time — this typically clears the cache and allows you to enter successfully."
            },
            {
                question: "Can I restore a deleted account?",
                answer: [
                    "Yes! You have a 30-day window to change your mind after deleting your account. If you contact support and an admin restores your profile:",
                    "• You may need to tap \"Forgot Password\" to re-verify your access and set a new password.",
                    "• Your account will be restored to the exact state it was in at the time of deletion, preserving all your tokens, resume history, and optimized applications.",
                    "After 30 days, all data is permanently purged and cannot be recovered."
                ]
            },
            {
                question: "I forgot my password",
                answer: [
                    "1. Tap \"Forgot Password\" on the login screen",
                    "2. Enter the email address associated with your account",
                    "3. Check your inbox for a password reset link",
                    "4. Follow the link to set a new password",
                    "",
                    "Note: If you signed up with Google or Apple, you don't have a password — just use the corresponding sign-in button."
                ]
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
                    "• Wait for the push notification (analysis takes ~40 seconds, optimization ~60 seconds)",
                    "• Return to the app if prompted by a notification",
                    "• Contact support if the issue persists beyond 2 minutes"
                ]
            },
            {
                question: "I didn't receive my tokens after purchase",
                answer: [
                    "• Check Purchase History to verify the transaction",
                    "• Refresh the app by pulling down on the screen",
                    "• Wait 1-2 minutes for processing",
                    "• Contact support if tokens don't appear within 5 minutes"
                ]
            },
            {
                question: "The job URL isn't working",
                answer: [
                    "RiResume supports LinkedIn, Indeed, and other valid job posting URLs. If a URL isn't working:",
                    "• Ensure you've copied the complete URL including https://",
                    "• Try copying the URL again directly from the job posting",
                    "• If the URL still doesn't parse correctly, you can manually edit the extracted job description after pasting",
                    "• Some job boards use dynamic URLs that may not parse well — in these cases, try copying the job description text manually"
                ]
            },
            {
                question: "Changes aren't saving",
                answer: [
                    "• Complete the validation: Ensure you tapped \"Validate & Save to Dashboard\"",
                    "• Check your internet connection",
                    "• Try again: Close and reopen the application"
                ]
            },
            {
                question: "I'm not receiving push notifications",
                answer: [
                    "• Make sure notifications are enabled for RiResume in your device settings",
                    "• On iOS: Settings → Notifications → RiResume → Allow Notifications",
                    "• On Android: Settings → Apps → RiResume → Notifications → Enable",
                    "• Ensure the app is not in \"Do Not Disturb\" exceptions if DND is active"
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
                    "RiResume takes your privacy seriously:",
                    "• All data is encrypted in transit and at rest",
                    "• We use Firebase secure authentication",
                    "• Payment processing through Stripe (PCI compliant)",
                    "• We never share your personal information with third parties",
                    "• Resume data is used solely for analysis and optimization purposes"
                ]
            },
            {
                question: "What data do you collect?",
                answer: [
                    "• Account information (name, email)",
                    "• Resume content (for analysis and optimization)",
                    "• Job URLs and descriptions (for matching)",
                    "• Usage analytics (to improve the service)",
                    "• Payment information (processed securely by Stripe — we never store card details)"
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
                    "Email Support: support@riresume.com",
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
                    "4. Our team will review within 48 hours"
                ]
            }
        ]
    },
    {
        title: "About RiResume",
        items: [
            {
                question: "What makes RiResume different?",
                answer: [
                    "Unlike traditional resume scanners that just give you a score, RiResume:",
                    "• Actually rewrites your content using advanced AI",
                    "• Optimizes for specific jobs, not generic templates",
                    "• Surgically inserts missing skills into chosen resume sections",
                    "• Manages your entire job search lifecycle in one place",
                    "• Provides interview prep with Story Mapping based on your actual experiences",
                    "• Offers AI-powered learning slideshows for skill development",
                    "• Uses transparent token-based pricing — no subscriptions or hidden fees",
                    "• Available on web, Android, and iOS"
                ]
            },
            {
                question: "What AI technology does RiResume use?",
                answer: "RiResume uses state-of-the-art language models optimized for resume writing, skill matching, and career content generation. We've carefully selected cost-efficient models that maintain high quality while keeping token prices affordable."
            },
            {
                question: "Does RiResume fabricate information?",
                answer: "No. RiResume is built on ethical AI principles — we help you present your real experiences more effectively. The AI enhances how your existing skills and accomplishments are worded and positioned, but it never fabricates qualifications or experiences you don't have."
            },
            {
                question: "How often is RiResume updated?",
                answer: "We regularly release updates with new features, improvements, and bug fixes. Enable automatic updates in your device settings to always have the latest version."
            },
            {
                question: "What's coming next?",
                answer: [
                    "Upcoming features include:",
                    "• Additional job board API integrations",
                    "• Multiple file format support for downloads",
                    "• Certificate uploads in Learning Hub",
                    "• Localized pricing for international markets",
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
                    "• Use prep guides strategically: Generate them for your most important applications",
                    "• Take advantage of free manual editing: Polish your resume at no extra cost after each optimization"
                ]
            },
            {
                question: "Interview Preparation Best Practices",
                answer: [
                    "• Study your prep guide thoroughly: It's personalized to your situation",
                    "• Practice STAR responses: Use the Story Mapping frameworks provided in your prep guide",
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
                    "Version: 1.0.1",
                    "Last Updated: 02/16/2026"
                ]
            }
        ]
    }
];

export default function HelpSupportScreen() {
    const theme = useTheme();
    const router = useRouter();

    const handleEmailSupport = () => {
        const email = 'support@riresume.com';
        const subject = 'Support Request: RiResume';
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

    const handleEmergencyReset = () => {
        Alert.alert(
            "🔄 Emergency Reset",
            "This will reset the app navigation and clear any stuck states. Your data will NOT be deleted.\n\nUse this if the app becomes unresponsive or buttons stop working.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reset App",
                    style: "destructive",
                    onPress: () => {
                        try {
                            // Clear Zustand store
                            const { useResumeStore } = require('../../src/store/resumeStore');
                            useResumeStore.getState().setCurrentAnalysis(null);

                            // Use dismissAll if available, otherwise just navigate
                            if (router.canDismiss()) {
                                router.dismissAll();
                            }

                            // Short delay then navigate to home tab
                            setTimeout(() => {
                                router.navigate('/(tabs)/home');
                                Alert.alert("Reset Complete", "The app has been reset. You can now continue using RiResume.");
                            }, 200);
                        } catch (error) {
                            console.error("Emergency reset error:", error);
                            // Fallback: just try to navigate
                            router.navigate('/(tabs)/home');
                        }
                    }
                }
            ]
        );
    };

    const handlePrivacyEnquiry = () => {
        const email = 'support@riresume.com';
        const subject = 'Privacy Enquiry: RiResume App';
        const body = 'Hello,\n\nI have a privacy-related enquiry regarding the RiResume app:\n\n[Please detail your enquiry here]\n\nAccount Email: [Your account email if different]\nDate: ' + new Date().toLocaleDateString();
        const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        Linking.canOpenURL(url).then(supported => {
            if (supported) {
                Linking.openURL(url);
            } else {
                Alert.alert("Error", "Could not open email client.");
            }
        });
    };
    const renderAnswer = (answer: string | (string | { segments: { text: string; link?: string; style?: any }[] })[]) => {
        if (Array.isArray(answer)) {
            return (
                <View>
                    {answer.map((line, index) => {
                        if (typeof line === 'object' && 'segments' in line) {
                            return (
                                <Text key={index} variant="bodyMedium" style={{ marginBottom: 4 }}>
                                    {line.segments.map((seg, sIdx) => (
                                        <Text
                                            key={sIdx}
                                            style={[
                                                seg.style,
                                                seg.link ? { color: theme.colors.primary, textDecorationLine: 'underline' } : null
                                            ]}
                                            onPress={seg.link ? () => router.push(seg.link as any) : undefined}
                                        >
                                            {seg.text}
                                        </Text>
                                    ))}
                                </Text>
                            );
                        }
                        return (
                            <Text key={index} variant="bodyMedium" style={{ marginBottom: 4 }}>
                                {line as string}
                            </Text>
                        );
                    })}
                </View>
            );
        }
        return (
            <Text variant="bodyMedium">
                {answer as string}
            </Text>
        );
    };

    return (
        <>
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
                            support@riresume.com
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

                <Card style={[styles.card, { borderColor: '#FF5722', borderWidth: 1 }]}>
                    <Card.Content>
                        <Text variant="titleMedium" style={[styles.sectionTitle, { color: '#FF5722' }]}>🔄 App Stuck?</Text>
                        <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                            If buttons stop responding or the app freezes, use the emergency reset to restore functionality without losing any data.
                        </Text>
                        <Button
                            mode="outlined"
                            icon="refresh"
                            onPress={handleEmergencyReset}
                            style={styles.button}
                            textColor="#FF5722"
                        >
                            Emergency Reset
                        </Button>
                    </Card.Content>
                </Card>

                <Card style={styles.card}>
                    <Card.Content>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Privacy Matters</Text>
                        <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                            Have a specific question about your data or privacy? Our team is here to help clarify our practices.
                        </Text>
                        <Button
                            mode="outlined"
                            icon="shield-account"
                            onPress={handlePrivacyEnquiry}
                            style={styles.button}
                        >
                            Privacy Enquiry
                        </Button>
                        <Button
                            mode="outlined"
                            icon="database-remove"
                            onPress={() => Linking.openURL('https://riresume.com/delete-data.html')}
                            style={styles.button}
                            textColor="#FF9800"
                        >
                            Request Data Deletion
                        </Button>
                        <Button
                            mode="outlined"
                            icon="account-remove"
                            onPress={() => Linking.openURL('https://riresume.com/delete-account.html')}
                            style={styles.button}
                            textColor="#F44336"
                        >
                            Request Account Deletion
                        </Button>
                    </Card.Content>
                </Card>

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
