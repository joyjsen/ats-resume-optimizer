// ============================================================
// Landing Page Data Constants
// ============================================================

export const SEO_METADATA = {
    title: 'RiResume | AI-Powered ATS Resume Optimizer & Builder',
    description: 'Optimize your resume for ATS with AI. Get resume analysis, AI rewriting, surgical skill addition, cover letters, and interview prep guides. Land interviews faster.',
    keywords: 'ATS resume optimizer, AI resume writer, resume gap analysis, add skills to resume, resume builder AI, job interview prep, career growth tools',
};

export const HEADER_HEIGHT = 72;

// Color Palette
export const C = {
    headerBg: '#0F0826',
    heroBgStart: '#12082e',
    heroBgEnd: '#1e1145',
    primary: '#7c3aed',
    primaryDark: '#5b21b6',
    primaryLight: '#a78bfa',
    primaryGlow: 'rgba(124, 58, 237, 0.35)',
    accent: '#f59e0b',
    accentLight: '#fbbf24',
    white: '#ffffff',
    offWhite: '#f8f7ff',
    lightGray: '#f3f4f6',
    sectionAlt: '#faf8ff',
    textPrimary: '#1a1a2e',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    footerBg: '#0a0612',
    border: '#e5e7eb',
    borderLight: '#f0eef5',
    cardBg: '#ffffff',
    cardBorder: '#ede9fe',
    starBg: '#fef3c7',
    successGreen: '#10b981',
};

// ============================================================
// Navigation Data
// ============================================================
export type NavDropdownItem = {
    label: string;
    description?: string;
    icon?: string;
    comingSoon?: boolean;
    sectionId?: string;
};

export type BlogPost = {
    id: string;
    title: string;
    description: string;
    date: string;
    image: string;
    category: string;
    readTime: string;
    url: string;
};

export type BlogCategory = {
    title: string;
    icon: string;
    topics: { label: string; url: string }[];
};

export const ANALYSIS_ITEMS: NavDropdownItem[] = [
    { label: 'Resume Analysis', description: 'AI-powered gap analysis against job descriptions', icon: 'file-search', sectionId: 'analysis' },
    { label: 'Resume Rewrite & Optimization', description: 'Smart content rewriting for higher ATS scores', icon: 'file-edit', sectionId: 'optimization' },
    { label: 'Skills Addition', description: 'Surgically insert missing skills into your resume', icon: 'plus-circle', sectionId: 'skills' },
    { label: 'Resume Builder', description: 'Build a job-winning resume from scratch', icon: 'file-plus', comingSoon: true, sectionId: 'builder' },
];

export const ESSENTIALS_ITEMS: NavDropdownItem[] = [
    { label: 'Cover Letter Generation', description: 'Tailored cover letters for each application', icon: 'mail', sectionId: 'cover-letter' },
    { label: 'Prep Guide Generation', description: 'Comprehensive interview prep with company research', icon: 'book-open', sectionId: 'prep-guide' },
    { label: 'Training Guide', description: 'AI-powered learning slideshows for new skills', icon: 'graduation-cap', sectionId: 'training' },
];

export const CONNECT_ITEMS: NavDropdownItem[] = [
    { label: 'Recruitment', description: 'Connect with recruiters looking for your skills', comingSoon: true },
    { label: 'Training', description: 'Access professional training programs', comingSoon: true },
    { label: 'Education', description: 'Partner with educational institutions', comingSoon: true },
];

export const BLOG_CATEGORIES: BlogCategory[] = [
    {
        title: 'Resume Resources',
        icon: 'file-text',
        topics: [
            { label: 'How to Write an ATS-Friendly Resume in 2026', url: '/blog/ats-friendly-resume-2026' },
            { label: 'Resume Formatting Best Practices for Modern Job Markets', url: '/blog/resume-formatting-best-practices' },
            { label: 'Keywords That Get Your Resume Past ATS Scanners', url: '/blog/resume-ats-keywords' },
            { label: 'Quantifying Achievements: The #1 Resume Improvement', url: '/blog/resume-quantify-achievements' },
            { label: 'Common Resume Mistakes That Kill Your ATS Score', url: '/blog/common-resume-mistakes-ats' },
        ],
    },
    {
        title: 'Cover Letter',
        icon: 'mail',
        topics: [
            { label: 'How to Write a Cover Letter That Gets Read', url: '/blog/how-to-write-cover-letter' },
            { label: 'Cover Letter Structure: The Perfect Format', url: '/blog/cover-letter-format' },
            { label: 'Customizing Your Cover Letter for Every Application', url: '/blog/customizing-cover-letter' },
            { label: 'Opening Lines That Hook Hiring Managers', url: '/blog/cover-letter-opening-lines' },
            { label: 'When to Skip the Cover Letter (and When You Can\'t)', url: '/blog/when-to-skip-cover-letter' },
        ],
    },
    {
        title: 'Interview',
        icon: 'message-circle',
        topics: [
            { label: 'Mastering the STAR Method for Behavioral Interviews', url: '/blog/star-method-behavioral-interview' },
            { label: 'How to Research a Company Before Your Interview', url: '/blog/research-company-before-interview' },
            { label: 'Top 20 Interview Questions and How to Answer Them', url: '/blog/top-interview-questions-answers' },
            { label: 'Virtual Interview Best Practices for Remote Roles', url: '/blog/virtual-interview-best-practices' },
            { label: 'Salary Negotiation: How to Get What You\'re Worth', url: '/blog/salary-negotiation' },
        ],
    },
    {
        title: 'Career Growth',
        icon: 'trending-up',
        topics: [
            { label: 'Building a Personal Brand on LinkedIn', url: '/blog/building-personal-brand-linkedin' },
            { label: 'Transitioning Careers: A Step-by-Step Guide', url: '/blog/career-transition-guide' },
            { label: 'Upskilling Strategies for the AI-Powered Workforce', url: '/blog/upskilling-strategies-ai' },
            { label: 'Networking in 2026: Digital-First Approaches', url: '/blog/digital-networking-2026' },
            { label: 'From Individual Contributor to Manager: The Career Leap', url: '/blog/individual-contributor-to-manager' },
        ],
    },
];

// ============================================================
// Features Data
// ============================================================
export type FeatureItem = {
    icon: string;
    iconFamily: 'material' | 'fa6';
    title: string;
    description: string;
    accentColor: string;
};

export const FEATURES: FeatureItem[] = [
    {
        icon: 'file-search-outline',
        iconFamily: 'material',
        title: 'Resume Analysis',
        description: 'Upload your resume and paste a job link. Our AI resume optimizer identifies matching skills, gaps, and gives you a precise ATS score to help you beat ATS filters.',
        accentColor: '#7c3aed',
    },
    {
        icon: 'auto-fix',
        iconFamily: 'material',
        title: 'Resume Optimization',
        description: 'AI rewrites your resume with job-specific keywords, enhanced bullet points, and optimized formatting to maximize your ATS score.',
        accentColor: '#2563eb',
    },
    {
        icon: 'puzzle-plus-outline',
        iconFamily: 'material',
        title: 'Skill Addition',
        description: 'Surgically insert missing skills into specific resume sections. Our AI-powered tool integrates them naturally, not just appending to a list.',
        accentColor: '#059669',
    },
    {
        icon: 'email-edit-outline',
        iconFamily: 'material',
        title: 'Cover Letters',
        description: 'Our cover letter generator creates tailored letters based on your optimized resume and the job description. Edit and download instantly.',
        accentColor: '#dc2626',
    },
    {
        icon: 'book-open-page-variant-outline',
        iconFamily: 'material',
        title: 'Prep Guides',
        description: 'Get comprehensive interview preparation including company research, STAR-method story mapping, and role-specific technical questions for job seekers.',
        accentColor: '#d97706',
    },
    {
        icon: 'school-outline',
        iconFamily: 'material',
        title: 'Learning Hub',
        description: 'AI-generated interactive training slideshows to help you learn new skills and bridge gaps identified in your analysis.',
        accentColor: '#7c3aed',
    },
];

// ============================================================
// How It Works Data
// ============================================================
export type StepItem = {
    number: string;
    icon: string;
    title: string;
    description: string;
};

export const STEPS: StepItem[] = [
    {
        number: '01',
        icon: 'link-variant',
        title: 'Paste a Job Link',
        description: 'Share a job URL from LinkedIn, Indeed, or any job board. Our AI-powered engine extracts the full job description automatically.',
    },
    {
        number: '02',
        icon: 'brain',
        title: 'AI Analyzes & Optimizes',
        description: 'Our AI compares your resume against the job, identifies gaps, and rewrites your content for maximum ATS compatibility.',
    },
    {
        number: '03',
        icon: 'download',
        title: 'Download & Apply',
        description: 'Get your optimized resume, tailored cover letter, and personalized prep guide. Apply with confidence.',
    },
];

// ============================================================
// Pricing Data (from TOKEN_PACKAGES)
// ============================================================
export type PricingTier = {
    id: string;
    name: string;
    tokens: number;
    price: number;
    description: string;
    bonusPercent?: number;
    highlighted?: boolean;
    badge?: string;
};

export const PRICING_TIERS: PricingTier[] = [
    {
        id: 'starter',
        name: 'Starter Pack',
        tokens: 100,
        price: 4.99,
        description: 'Perfect for a single job application.',
    },
    {
        id: 'pro',
        name: 'Pro Pack',
        tokens: 250,
        price: 9.99,
        description: '20% bonus tokens for multiple applications.',
        bonusPercent: 20,
        highlighted: true,
        badge: 'Most Popular',
    },
    {
        id: 'premium',
        name: 'Premium Pack',
        tokens: 500,
        price: 14.99,
        description: '40% bonus tokens for the complete job search.',
        bonusPercent: 40,
        badge: 'Best Value',
    },
];

export const TOKEN_COSTS = [
    { action: 'Resume Analysis', cost: 8 },
    { action: 'Resume Optimization', cost: 15 },
    { action: 'Cover Letter', cost: 15 },
    { action: 'Prep Guide', cost: 40 },
    { action: 'AI Learning', cost: 30 },
];

// ============================================================
// Detailed Feature Sections Data
// ============================================================
export type DetailedFeature = {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    btnText: string;
    benefits: string[];
    accentColor: string;
    icon: string;
};

export const DETAILED_FEATURES: DetailedFeature[] = [
    {
        id: 'analysis',
        title: 'Deep Resume Gap Analysis',
        subtitle: 'See exactly what Recruiters and ATS see in your resume.',
        description: 'Our proprietary AI analyzes your resume against any job description, identifying critical keyword gaps and calculating your real-time ATS compatibility score. Don\'t apply blindly — know exactly where you stand.',
        btnText: 'Analyze Resume',
        benefits: [
            'Real-time ATS score calculation',
            'Full keyword gap identification',
            'Formatting & structure audit',
            'Role-specific relevance mapping'
        ],
        accentColor: '#7c3aed',
        icon: 'file-search-outline',
    },
    {
        id: 'optimization',
        title: 'AI-Powered Resume Optimization',
        subtitle: 'Smarter rewriting for the modern job market.',
        description: 'Transform your existing experience into a job-winning narrative. Our AI doesn\'t just spin words; it strategically rewrites your professional summary and bullet points to emphasize the exact achievements hiring managers are looking for.',
        btnText: 'Optimize Resume',
        benefits: [
            'Strategic keyword integration',
            'Action-oriented bullet point enhancement',
            'Professional tone adjustment',
            'Side-by-side original vs optimized view'
        ],
        accentColor: '#2563eb',
        icon: 'auto-fix',
    },
    {
        id: 'skills',
        title: 'Surgical Skill Addition',
        subtitle: 'Bridge your experience gaps naturally.',
        description: 'When our analysis identifies a missing skill, don\'t just add it to a list. Our "Surgical Insertion" technology integrates the skill naturally into your professional experience, explaining how you\'ve used it in a relevant context that convinces recruiters.',
        btnText: 'Add Skills',
        benefits: [
            'Contextual skill integration',
            'Authentic achievement-based wording',
            'Interactive section selection',
            'Automatic ATS score recalculation'
        ],
        accentColor: '#059669',
        icon: 'puzzle-plus-outline',
    },
    {
        id: 'builder',
        title: 'Next-Gen Resume Builder',
        subtitle: 'Build from scratch with an AI resume builder at your side.',
        description: 'Starting from zero? Use our intelligent builder to create a perfectly formatted, high-converting resume in minutes. We provide real-time suggestions based on current industry trends and your specific target roles.',
        btnText: 'Build Resume',
        benefits: [
            'Dynamic section templates',
            'Industry-specific wording prompts',
            'Modern, professional formatting',
            'One-click export to .docx'
        ],
        accentColor: '#f59e0b',
        icon: 'file-plus-outline',
    },
    {
        id: 'cover-letter',
        title: 'Precision Cover Letters',
        subtitle: 'An AI cover letter generator that echoes the role requirements.',
        description: 'Stop using generic templates. Our AI scans the job description and your resume to generate a high-impact cover letter that highlights why you\'re the perfect fit, matching the company\'s tone precisely.',
        btnText: 'Generate Cover Letter',
        benefits: [
            'Role-specific contextual matching',
            'Tone of voice customization',
            'One-click format alignment',
            'Ready-to-send professional templates'
        ],
        accentColor: '#ec4899',
        icon: 'email-edit-outline',
    },
    {
        id: 'prep-guide',
        title: 'Interview Preparation Guides',
        subtitle: 'Interview preparation tools to walk in with confidence.',
        description: 'We generate custom interview guides based on the specific job you\'re applying for. Get potential questions, "Best Response" strategies, and behavioral prompts tailored to your background and the role.',
        btnText: 'Get Prep Guide',
        benefits: [
            'Top 10 predicted questions',
            'S.T.A.R. method response coaching',
            'Company research talking points',
            'Soft skill emphasis strategies'
        ],
        accentColor: '#8b5cf6',
        icon: 'lightbulb-on-outline',
    },
    {
        id: 'training',
        title: 'Career Advancement Hub',
        subtitle: 'Upskill with curated learning paths.',
        description: 'Our AI identifies the skills you need to reach the next level in your career and provides curated training slides and material to help you bridge those gaps quickly and efficiently.',
        btnText: 'Access Training',
        benefits: [
            'Personalized learning roadmaps',
            'Bite-sized training modules',
            'Progress tracking & certification',
            'Direct industry relevance focus'
        ],
        accentColor: '#3b82f6',
        icon: 'school-outline',
    }
];

// ============================================================
// Value Proposition Grid Data
// ============================================================
export const VALUE_PROPS = [
    { title: 'Superfast Job Match', desc: 'Find the perfect role-matching keywords in under 30 seconds.', icon: 'lightning-bolt' },
    { title: 'Unlimited CV Downloads', desc: 'Optimize and download as many versions as you need for various roles.', icon: 'download' },
    { title: 'Match Keywords', desc: 'Automatically scan & match critical keywords from job descriptions.', icon: 'filter-variant' },
    { title: 'AI Customization', desc: 'Intelligent resume tailoring that adapts to any industry or seniority level.', icon: 'robot' },
    { title: 'Smart Content', desc: 'Dynamic text generation that understands the nuance of your achievements.', icon: 'brain' },
    { title: 'Improve Existing', desc: 'Don\'t start over; let our AI polish and enhance your current resume.', icon: 'pencil-box-multiple-outline' },
    { title: 'Proven Formulae', desc: 'Built on industry-standard resume success frameworks and recruiter preferences.', icon: 'check-decagram' },
    { title: 'AI Bullet Generation', desc: 'Transform boring duties into high-impact, achievement-based bullet points.', icon: 'format-list-bulleted-type' },
    { title: 'Refine Bullets', desc: 'Surgically edit specific bullets for maximum impact and relevance.', icon: 'auto-fix' },
    { title: 'Smart Suggestions', desc: 'Get real-time feedback and corrections as you build or optimize.', icon: 'comment-quote-outline' },
    { title: 'Recruiter Approved', desc: 'Templates and wording designed to pass through the hands of top hiring teams.', icon: 'account-check' },
    { title: 'Highlight Requirements', desc: 'See instantly which job requirements your resume is currently missing.', icon: 'bullseye-arrow' },
    { title: 'AI Recommendations', desc: 'Get proactive advice on how to structure your experience for specific paths.', icon: 'star-shooting-outline' },
    { title: 'Custom Adjustments', desc: 'Fine-tune AI suggestions with your own personal touch and style.', icon: 'tune-vertical' },
    { title: 'Measurable Results', desc: 'Watch your ATS score climb with every single optimization step.', icon: 'trending-up' },
    { title: 'AI Skill Extraction', desc: 'Our AI finds the hidden skills in your work history you didn\'t know you had.', icon: 'magnify-expand' },
    { title: 'Critical Skills Focus', desc: 'Prioritize the skills that matter most to hiring managers for each role.', icon: 'alert-decagram' },
    { title: 'ATS Score Boost', desc: 'Designed specifically to help you rank #1 in automated screening systems.', icon: 'rocket-launch' },
];

// ============================================================
// Testimonials Data
// ============================================================
export const TESTIMONIALS = [
    {
        name: 'Sarah Jenkins',
        role: 'Software Engineer',
        content: 'I was applying for months with no luck. After using RiResume as my AI resume optimizer, I got 3 callbacks in my first week. Radical difference.',
        avatar: 'SJ'
    },
    {
        name: 'Michael Chen',
        role: 'Product Manager',
        content: 'The "Surgical Skill Addition" is a game changer. It helped me bridge my technical gaps without sounding like I was just keyword stuffing.',
        avatar: 'MC'
    },
    {
        name: 'Elena Rodriguez',
        role: 'Marketing Lead',
        content: 'The interview prep guides were spot-on. I felt so much more prepared walking in knowing exactly what they were looking for.',
        avatar: 'ER'
    }
];

// ============================================================
// FAQ Data (curated from help.tsx)
// ============================================================
export type FAQItem = {
    question: string;
    answer: string;
};

export const FAQ_ITEMS: FAQItem[] = [
    {
        question: 'What is RiResume?',
        answer: 'RiResume is an AI-powered ATS Resume Optimizer available on web, Android, and iOS. It analyzes your resume against job descriptions, rewrites and optimizes your content, generates tailored cover letters, creates interview prep guides, and helps you learn new skills — all in one platform.',
    },
    {
        question: 'How does resume analysis work?',
        answer: 'Paste a job URL from LinkedIn, Indeed, or any job board. Upload your resume (image, .txt, or .docx). Our AI extracts the job requirements, compares them against your resume, identifies matching, partially matching, and missing skills, and calculates your ATS compatibility score — all in about 40 seconds.',
    },
    {
        question: 'What does AI-powered optimization include?',
        answer: 'The AI rewrites your professional summary, enhances experience bullet points with relevant keywords, adds missing skills naturally into your content, and optimizes overall formatting for ATS compatibility. You can see a side-by-side comparison of original vs. optimized content before accepting.',
    },
    {
        question: 'How does skill addition work?',
        answer: 'Unlike other tools that just append skills to a list, RiResume surgically inserts missing skills into the specific resume sections you choose. The AI integrates them naturally into your experience descriptions, maintaining readability while improving your ATS score.',
    },
    {
        question: 'What is a Prep Guide?',
        answer: 'A Prep Guide is a comprehensive interview preparation document that includes company research powered by real-time web data, role analysis, technical preparation topics, behavioral question frameworks using the STAR method mapped to your actual experiences, and strategic interview tips.',
    },
    {
        question: 'How much does it cost?',
        answer: 'RiResume uses transparent, pay-as-you-go token pricing. You get 110 free tokens to start — enough for a full analysis, optimization, cover letter, and more. Token packages range from $4.99 (100 tokens) to $14.99 (500 tokens). No subscriptions, no hidden fees.',
    },
    {
        question: 'Why tokens instead of a subscription?',
        answer: 'We believe in transparent pricing where you only pay for what you use. With tokens, there are no recurring charges, no hidden fees, and no surprise upsells. You stay in full control of your spending and can purchase more whenever you need them.',
    },
    {
        question: 'Does RiResume fabricate information?',
        answer: 'No. RiResume is built on ethical AI principles. We help you present your real experiences more effectively. The AI enhances how your existing skills and accomplishments are worded and positioned, but it never fabricates qualifications or experiences you don\'t have.',
    },
    {
        question: 'What makes RiResume different from other tools?',
        answer: 'Unlike traditional resume scanners that just give you a score, RiResume actually rewrites your content using advanced AI. It optimizes for specific jobs (not generic templates), surgically inserts skills, manages your entire job search lifecycle, provides interview prep with Story Mapping, and offers AI-powered learning — all with transparent token-based pricing.',
    },
    {
        question: 'Is my data secure?',
        answer: 'Yes. All data is encrypted in transit and at rest. We use Firebase secure authentication, payments are processed through Stripe (PCI compliant), and we never share your personal information with third parties. Resume data is used solely for analysis and optimization.',
    },
    {
        question: 'What is an ATS score?',
        answer: 'An ATS (Applicant Tracking System) score measures how well your resume matches a job description. Most companies use ATS software to filter resumes before a human ever sees them. RiResume analyzes your resume against the job posting and gives you a score from 0-100, showing exactly which skills match, partially match, or are missing.',
    },
    {
        question: 'How does AI resume optimization work?',
        answer: 'RiResume\'s AI analyzes both your resume and the target job description, identifying gaps between your experience and what the employer is looking for. It then rewrites and optimizes your resume content, surgically adds missing skills, and ensures proper keyword density to pass ATS filters — all while keeping your information accurate and authentic.',
    },
    {
        question: 'Is RiResume free to use?',
        answer: 'Yes — RiResume is free to start with 110 tokens included on signup. Tokens are used for AI-powered features like resume analysis (8 tokens), optimization (15 tokens), and cover letter generation (15 tokens). Additional token packs start at just $4.99.',
    },
    {
        question: 'Which job boards does RiResume support?',
        answer: 'RiResume works with any job posting from any platform. Simply paste the job URL from LinkedIn, Indeed, Glassdoor, or any other job board, and RiResume automatically extracts the job details for analysis and optimization.',
    },
    {
        question: 'How long does resume optimization take?',
        answer: 'RiResume optimizes your resume in under 60 seconds. Our AI analyzes the job description, identifies gaps, and rewrites your resume content instantly — no waiting, no back-and-forth.',
    },
];

// ============================================================
// Social Proof Stats
// ============================================================
export type StatItem = {
    value: string;
    label: string;
    icon: string;
};

export const STATS: StatItem[] = [
    { value: '95%', label: 'Avg. ATS Score After Optimization', icon: 'chart-line' },
    { value: '10+', label: 'AI-Powered Features', icon: 'sparkles' },
    { value: '3', label: 'Platforms (Web, iOS, Android)', icon: 'devices' },
    { value: '<60s', label: 'Optimization Time', icon: 'lightning-bolt' },
];

// ============================================================
// Footer Data
// ============================================================
export const FOOTER_COLUMNS = [
    {
        title: 'Product',
        links: [
            { label: 'Resume Analysis', href: '#analysis' },
            { label: 'Resume Optimization', href: '#optimization' },
            { label: 'Cover Letters', href: '#cover-letter' },
            { label: 'Prep Guides', href: '#prep-guide' },
            { label: 'Learning Hub', href: '#training' },
            { label: 'Optimization Guide', href: '/optimize' },
        ],
    },
    {
        title: 'Company',
        links: [
            { label: 'About Us', href: '/settings/about' },
            { label: 'Careers', href: '/careers' },
            { label: 'Reviews', href: '/reviews' },
            { label: 'Contact Us', href: 'mailto:support@riresume.com' },
        ],
    },
    {
        title: 'Legal',
        links: [
            { label: 'Terms & Conditions', href: '/settings/terms' },
            { label: 'Privacy Policy', href: '/settings/privacy' },
            { label: 'LLM info', href: '/llm_info' },
        ],
    },
    {
        title: 'Resources',
        links: [
            { label: 'Help & Support', href: '/settings/help' },
            { label: 'Blog', href: '/blog' },
            { label: 'FAQ', href: '#faq-section' },
            { label: 'Pricing', href: '#pricing-section' },
        ],
    },
];

export const BLOG_POSTS: BlogPost[] = [
    {
        id: 'how-to-beat-ats-filters-2026',
        title: 'How to Beat ATS Filters in 2026: The Complete Guide',
        description: 'Learn exactly how ATS systems work and the proven strategies to optimize your resume and get past automated screening filters in 2026.',
        date: 'Mar 20, 2026',
        image: '',
        category: 'ATS Optimization',
        readTime: '8 min read',
        url: '/blog/how-to-beat-ats-filters-2026'
    },
    {
        id: 'what-is-an-ats-score',
        title: 'What is an ATS Score and How to Improve It',
        description: 'Your ATS score determines whether your resume gets seen by a human. Learn what it means and exactly how to improve yours.',
        date: 'Mar 18, 2026',
        image: '',
        category: 'ATS Optimization',
        readTime: '6 min read',
        url: '/blog/what-is-an-ats-score'
    },
    {
        id: 'how-to-tailor-resume-for-every-job',
        title: 'How to Tailor Your Resume for Every Job Application',
        description: 'Stop sending the same resume to every job. Learn how to customize your resume for each application without starting from scratch.',
        date: 'Mar 15, 2026',
        image: '',
        category: 'Resume Tips',
        readTime: '7 min read',
        url: '/blog/how-to-tailor-resume-for-every-job'
    },
];

/* Complete list of every blog post for the /blog index page */
export const ALL_BLOG_POSTS: BlogPost[] = [
    ...BLOG_POSTS,
    // Resume Resources
    { id: 'ats-friendly-resume-2026', title: 'How to Write an ATS-Friendly Resume in 2026', description: 'Step-by-step guide to building a resume that gets past applicant tracking systems.', date: 'Mar 20, 2026', image: '', category: 'Resume Resources', readTime: '9 min read', url: '/blog/ats-friendly-resume-2026' },
    { id: 'resume-formatting-best-practices', title: 'Resume Formatting Best Practices for Modern Job Markets', description: 'Master the formatting techniques that make your resume ATS-compatible and visually appealing.', date: 'Mar 20, 2026', image: '', category: 'Resume Resources', readTime: '8 min read', url: '/blog/resume-formatting-best-practices' },
    { id: 'resume-ats-keywords', title: 'Keywords That Get Your Resume Past ATS Scanners', description: 'Learn how to identify and strategically place the right keywords for high ATS scores.', date: 'Mar 20, 2026', image: '', category: 'Resume Resources', readTime: '8 min read', url: '/blog/resume-ats-keywords' },
    { id: 'resume-quantify-achievements', title: 'Quantifying Achievements: The #1 Resume Improvement', description: 'Transform vague resume bullets into powerful, data-driven achievements.', date: 'Mar 20, 2026', image: '', category: 'Resume Resources', readTime: '8 min read', url: '/blog/resume-quantify-achievements' },
    { id: 'common-resume-mistakes-ats', title: 'Common Resume Mistakes That Kill Your ATS Score', description: 'Avoid the most frequent resume errors that cause ATS rejections.', date: 'Mar 20, 2026', image: '', category: 'Resume Resources', readTime: '8 min read', url: '/blog/common-resume-mistakes-ats' },
    // Cover Letter
    { id: 'how-to-write-cover-letter', title: 'How to Write a Cover Letter That Gets Read', description: 'Proven structure, tone, and content strategies for compelling cover letters.', date: 'Mar 20, 2026', image: '', category: 'Cover Letter', readTime: '9 min read', url: '/blog/how-to-write-cover-letter' },
    { id: 'cover-letter-format', title: 'Cover Letter Structure: The Perfect Format', description: 'Master the ideal cover letter format with proven structure and visual hierarchy.', date: 'Mar 20, 2026', image: '', category: 'Cover Letter', readTime: '8 min read', url: '/blog/cover-letter-format' },
    { id: 'customizing-cover-letter', title: 'Customizing Your Cover Letter for Every Application', description: 'Efficient strategies to customize your cover letter without starting from scratch.', date: 'Mar 20, 2026', image: '', category: 'Cover Letter', readTime: '8 min read', url: '/blog/customizing-cover-letter' },
    { id: 'cover-letter-opening-lines', title: 'Opening Lines That Hook Hiring Managers', description: 'Proven cover letter opening formulas that grab attention from line one.', date: 'Mar 20, 2026', image: '', category: 'Cover Letter', readTime: '8 min read', url: '/blog/cover-letter-opening-lines' },
    { id: 'when-to-skip-cover-letter', title: "When to Skip the Cover Letter (and When You Can't)", description: 'Learn when to include a cover letter and when to focus your energy elsewhere.', date: 'Mar 20, 2026', image: '', category: 'Cover Letter', readTime: '8 min read', url: '/blog/when-to-skip-cover-letter' },
    // Interview
    { id: 'star-method-behavioral-interview', title: 'Mastering the STAR Method for Behavioral Interviews', description: 'Answer behavioral interview questions with confidence using the STAR framework.', date: 'Mar 20, 2026', image: '', category: 'Interview', readTime: '9 min read', url: '/blog/star-method-behavioral-interview' },
    { id: 'research-company-before-interview', title: 'How to Research a Company Before Your Interview', description: 'Stand out in interviews with thorough company research using the 5-layer framework.', date: 'Mar 20, 2026', image: '', category: 'Interview', readTime: '8 min read', url: '/blog/research-company-before-interview' },
    { id: 'top-interview-questions-answers', title: 'Top 20 Interview Questions and How to Answer Them', description: 'Prepare for your next interview with the most common questions and expert strategies.', date: 'Mar 20, 2026', image: '', category: 'Interview', readTime: '10 min read', url: '/blog/top-interview-questions-answers' },
    { id: 'virtual-interview-best-practices', title: 'Virtual Interview Best Practices for Remote Roles', description: 'Master remote interviews with proven best practices for video calls and engagement.', date: 'Mar 20, 2026', image: '', category: 'Interview', readTime: '8 min read', url: '/blog/virtual-interview-best-practices' },
    { id: 'salary-negotiation', title: "Salary Negotiation: How to Get What You're Worth", description: 'Master salary negotiation with data-driven strategies to maximize your package.', date: 'Mar 20, 2026', image: '', category: 'Interview', readTime: '9 min read', url: '/blog/salary-negotiation' },
    // Career Growth
    { id: 'building-personal-brand-linkedin', title: 'Building a Personal Brand on LinkedIn', description: 'Transform your LinkedIn profile into a powerful personal brand for career growth.', date: 'Mar 20, 2026', image: '', category: 'Career Growth', readTime: '9 min read', url: '/blog/building-personal-brand-linkedin' },
    { id: 'career-transition-guide', title: 'Transitioning Careers: A Step-by-Step Guide', description: 'Successfully change careers with a structured approach to transferable skills.', date: 'Mar 20, 2026', image: '', category: 'Career Growth', readTime: '9 min read', url: '/blog/career-transition-guide' },
    { id: 'upskilling-strategies-ai', title: 'Upskilling Strategies for the AI-Powered Workforce', description: 'Stay competitive in the AI era with targeted upskilling and credentialing strategies.', date: 'Mar 20, 2026', image: '', category: 'Career Growth', readTime: '9 min read', url: '/blog/upskilling-strategies-ai' },
    { id: 'digital-networking-2026', title: 'Networking in 2026: Digital-First Approaches', description: 'Master digital networking with strategies that build real professional relationships.', date: 'Mar 20, 2026', image: '', category: 'Career Growth', readTime: '8 min read', url: '/blog/digital-networking-2026' },
    { id: 'individual-contributor-to-manager', title: 'From Individual Contributor to Manager: The Career Leap', description: 'Navigate the IC to manager transition with mindset shifts and leadership skills.', date: 'Mar 20, 2026', image: '', category: 'Career Growth', readTime: '9 min read', url: '/blog/individual-contributor-to-manager' },
];

export const SOCIAL_LINKS = [
    { icon: 'facebook', url: 'https://www.facebook.com/share/1HrAgt1KUB/?mibextid=wwXIfr', label: 'Follow RiResume on Facebook' },
    { icon: 'instagram', url: 'https://www.instagram.com/riresume?igsh=YjU4MTJ5N205Y2V1', label: 'Follow RiResume on Instagram' },
    { icon: 'threads', url: 'https://www.threads.com/@riresume?igshid=NTc4MTIwNjQ2YQ==', label: 'Follow RiResume on Threads' },
    { icon: 'x-twitter', url: 'https://x.com/riresume?s=21&t=YyZ_r5xFMEYCKAWlqJVxFA', label: 'Follow RiResume on X' },
    { icon: 'bluesky', url: 'https://bsky.app/profile/riresume.bsky.social', label: 'Follow RiResume on Bluesky' },
    { icon: 'tiktok', url: 'https://www.tiktok.com/@riresume?_r=1&_t=ZT-94r59srZ1mo', label: 'Follow RiResume on TikTok' },
    { icon: 'linkedin', url: '#', label: 'Follow RiResume on LinkedIn' },
];

// ============================================================
// Inline Copy (extracted from WebLandingPage.tsx)
// ============================================================
export const INLINE_COPY = {
    hero: {
        headline: 'AI Resume Optimizer: From Application to Interview in Days,',
        headlineHighlight: 'Not Weeks',
        subtext: 'RiResume is the AI resume optimizer that helps job seekers beat ATS filters. Tailor your resume, generate cover letters, bridge skill gaps, and ace interview preparation — all designed to help you land your dream job faster.',
        cta: 'Start Now →',
        ctaSecondary: 'Read the complete guide →',
        ctaSecondaryUrl: '/optimize',
        ctaSubtext: 'Free to start · 110 tokens included · No subscription required',
        inputPlaceholder: 'Paste a job link from LinkedIn, Indeed...',
    },
    sections: {
        features: {
            title: 'Everything You Need to Land the Job',
            subtitle: 'From analysis to interview prep, RiResume covers your entire job application lifecycle with AI-powered tools.',
        },
        howItWorks: {
            title: 'How It Works',
            subtitle: 'Three simple steps to a job-winning job application',
        },
        pricing: {
            title: 'Simple, Transparent Pricing',
            subtitle: 'Pay only for what you use. No subscriptions, no hidden fees. Start free with 110 tokens.',
            tokenCostsLabel: 'Token costs per action:',
        },
        faq: {
            title: 'Frequently Asked Questions',
            subtitle: 'Everything you need to know about RiResume',
        },
        testimonials: {
            title: 'Trusted by Thousands',
            subtitle: 'See what professionals are saying about RiResume.',
        },
        blog: {
            title: 'From Our Blog',
            subtitle: 'Expert advice on resume optimization and landing your next role.',
            seeAll: 'See All Articles →',
        },
    },
    detailedFeature: {
        tryItLabel: 'Try it now: Paste a job URL',
        inputPlaceholder: 'Paste your job link here...',
        loginNote: 'Requires login to start processing',
    },
    mobileBanner: {
        title: 'Get the Best Experience on Mobile',
        subtitle: 'Download RiResume on your phone for a faster, smoother experience with push notifications, one-tap optimization, and offline access to your resumes.',
        appStoreSmall: 'Available on the',
        appStoreBig: 'App Store',
        playStoreSmall: 'Android App on',
        playStoreBig: 'Google Play',
        appStoreUrl: 'https://apps.apple.com/us/app/riresume/id6757821173',
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.jsn22.riresume&pcampaignid=web_share',
    },
    footer: {
        brandName: 'RiResume',
        brandDesc: 'AI-powered ATS resume optimization. Tailored resumes, cover letters, and interview prep — all in one platform.',
        copyright: '© 2026 RiResume. All rights reserved.',
    },
    cta: {
        getStarted: 'Get Started',
        signIn: 'Sign In',
        viewAllReviews: 'View All Reviews',
    },
};

// ============================================================
// External App URLs
// ============================================================
export const APP_URLS = {
    base: 'https://app.riresume.com',
    login: 'https://app.riresume.com/sign-in',
    getStarted: 'https://app.riresume.com/sign-up',
    withJobUrl: (jobUrl: string) => `https://app.riresume.com/sign-in?jobUrl=${encodeURIComponent(jobUrl)}`,
};
