import React, { useState, useCallback } from 'react';
import { View, ScrollView, Pressable, Image, Text, Linking, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useResumeStore } from '../../../store/resumeStore';
import { FontAwesome6 } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
    C, HEADER_HEIGHT,
    ANALYSIS_ITEMS, ESSENTIALS_ITEMS, CONNECT_ITEMS, BLOG_CATEGORIES,
    FEATURES, STEPS, PRICING_TIERS, TOKEN_COSTS, FAQ_ITEMS, STATS,
    FOOTER_COLUMNS, SOCIAL_LINKS, DETAILED_FEATURES, SEO_METADATA,
    VALUE_PROPS, TESTIMONIALS, BLOG_POSTS,
    type NavDropdownItem, type BlogCategory, type BlogPost,
} from './LandingData';
import Head from 'expo-router/head';
import { ls } from './LandingStyles';

// ============================================================
// HEADER COMPONENT
// ============================================================
type DropdownKey = 'analysis' | 'essentials' | 'blog' | 'connect' | null;

const NAV_ITEMS: { key: DropdownKey; label: string }[] = [
    { key: 'analysis', label: 'Analysis & Optimization' },
    { key: 'essentials', label: 'Job Application Essentials' },
    { key: 'blog', label: 'Blog' },
    { key: 'connect', label: 'Connect' },
];

const LandingHeader: React.FC<{
    activeDropdown: DropdownKey;
    setActiveDropdown: (key: DropdownKey) => void;
    onSignIn: () => void;
    onGetStarted: () => void;
    onPricing: () => void;
    isSmall: boolean;
    toggleMobileMenu: () => void;
}> = ({ activeDropdown, setActiveDropdown, onSignIn, onGetStarted, onPricing, isSmall, toggleMobileMenu }) => {
    const toggleDropdown = (key: DropdownKey) => {
        setActiveDropdown(activeDropdown === key ? null : key);
    };

    return (
        <View style={[ls.header, { position: 'fixed' as any, top: 0, left: 0, right: 0 }]}>
            {/* Logo */}
            <View style={ls.headerLogo}>
                <Image source={require('../../../../assets/logo.png')} style={ls.headerLogoImg} resizeMode="contain" />
                <Text style={ls.headerLogoText}>RiResume</Text>
            </View>

            {/* Nav Items (Desktop) */}
            {!isSmall && (
                <View style={ls.headerNav}>
                    {NAV_ITEMS.map(item => (
                        <Pressable
                            key={item.key}
                            style={[ls.headerNavItem, activeDropdown === item.key && { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                            onPress={() => toggleDropdown(item.key)}
                        >
                            <Text style={ls.headerNavText}>{item.label}</Text>
                            <Text style={ls.headerNavChevron}>{activeDropdown === item.key ? '▲' : '▼'}</Text>
                        </Pressable>
                    ))}
                    <Pressable style={ls.headerNavItem} onPress={onPricing}>
                        <Text style={ls.headerNavText}>Pricing</Text>
                    </Pressable>
                </View>
            )}

            {/* Actions */}
            <View style={ls.headerActions}>
                {!isSmall && (
                    <Pressable style={ls.signInBtn} onPress={onSignIn}>
                        <Text style={ls.signInText}>Sign In</Text>
                    </Pressable>
                )}
                <Pressable style={ls.getStartedBtn} onPress={onGetStarted}>
                    <Text style={ls.getStartedText}>Get Started</Text>
                </Pressable>
                {isSmall && (
                    <Pressable style={ls.menuBtn} onPress={toggleMobileMenu}>
                        <MaterialCommunityIcons name="menu" size={28} color={C.white} />
                    </Pressable>
                )}
            </View>
        </View>
    );
};

// ============================================================
// MOBILE MENU
// ============================================================
const MobileMenu: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSignIn: () => void;
    onPricing: () => void;
    onItemClick: (sectionId?: string) => void;
}> = ({ isOpen, onClose, onSignIn, onPricing, onItemClick }) => {
    if (!isOpen) return null;

    return (
        <View style={ls.mobileNavOverlay}>
            <Pressable style={{ flex: 1 }} onPress={onClose} />
            <View style={ls.mobileNavContent}>
                <View style={ls.mobileNavHeader}>
                    <Text style={ls.headerLogoText}>Menu</Text>
                    <Pressable onPress={onClose}>
                        <MaterialCommunityIcons name="close" size={28} color={C.white} />
                    </Pressable>
                </View>

                <Text style={ls.mobileNavSectionTitle}>Analysis & Optimization</Text>
                {ANALYSIS_ITEMS.map((item, i) => (
                    <Pressable key={i} style={ls.mobileNavSubLink} onPress={() => onItemClick(item.sectionId)}>
                        <Text style={ls.mobileNavLinkText}>{item.label}</Text>
                    </Pressable>
                ))}

                <Text style={[ls.mobileNavSectionTitle, { marginTop: 20 }]}>Job Application Essentials</Text>
                {ESSENTIALS_ITEMS.map((item, i) => (
                    <Pressable key={i} style={ls.mobileNavSubLink} onPress={() => onItemClick(item.sectionId)}>
                        <Text style={ls.mobileNavLinkText}>{item.label}</Text>
                    </Pressable>
                ))}

                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 20 }} />

                <Pressable style={ls.mobileNavLink} onPress={() => { onPricing(); onClose(); }}>
                    <Text style={ls.mobileNavLinkText}>Pricing</Text>
                </Pressable>
                <Pressable style={[ls.mobileNavLink, { marginTop: 20 }]} onPress={onSignIn}>
                    <Text style={[ls.mobileNavLinkText, { color: C.primaryLight }]}>Sign In</Text>
                </Pressable>
            </View>
        </View>
    );
};

// ============================================================
// DROPDOWN PANELS
// ============================================================
const ItemDropdown: React.FC<{ items: NavDropdownItem[]; onItemClick: (sectionId?: string) => void }> = ({ items, onItemClick }) => (
    <View style={ls.dropdownPanel}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {items.map((item, i) => (
                <Pressable
                    key={i}
                    style={[ls.dropdownItem, { flex: 1, minWidth: 250 }]}
                    onPress={() => onItemClick(item.sectionId)}
                >
                    <View style={ls.dropdownItemIcon}>
                        <MaterialCommunityIcons name={item.icon as any} size={20} color={C.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={ls.dropdownItemLabel}>{item.label}</Text>
                            {item.comingSoon && <Text style={ls.comingSoonBadge}>Coming Soon</Text>}
                        </View>
                        {item.description && <Text style={ls.dropdownItemDesc}>{item.description}</Text>}
                    </View>
                </Pressable>
            ))}
        </View>
    </View>
);

const BlogDropdown: React.FC = () => (
    <View style={ls.dropdownPanel}>
        <View style={ls.blogGrid}>
            {BLOG_CATEGORIES.map((cat, i) => (
                <View key={i} style={ls.blogColumn}>
                    <Text style={ls.blogColumnTitle}>{cat.title}</Text>
                    {cat.topics.map((topic, j) => (
                        <Pressable key={j} style={ls.blogTopic}>
                            <Text style={ls.blogTopicText}>{topic}</Text>
                        </Pressable>
                    ))}
                </View>
            ))}
        </View>
    </View>
);

const DropdownContent: React.FC<{ activeDropdown: DropdownKey; onItemClick: (sectionId?: string) => void }> = ({ activeDropdown, onItemClick }) => {
    if (!activeDropdown) return null;
    const map: Record<string, React.ReactNode> = {
        analysis: <ItemDropdown items={ANALYSIS_ITEMS} onItemClick={onItemClick} />,
        essentials: <ItemDropdown items={ESSENTIALS_ITEMS} onItemClick={onItemClick} />,
        blog: <BlogDropdown />,
        connect: <ItemDropdown items={CONNECT_ITEMS} onItemClick={onItemClick} />,
    };
    return (
        <View style={{ position: 'absolute' as any, top: HEADER_HEIGHT, left: 0, right: 0, zIndex: 9999, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 16 }}>
            {map[activeDropdown]}
        </View>
    );
};

// ============================================================
// HERO SECTION
// ============================================================
const HeroSection: React.FC<{ jobUrl: string; setJobUrl: (v: string) => void; onStart: () => void; isSmall: boolean }> = ({ jobUrl, setJobUrl, onStart, isSmall }) => (
    <View style={ls.heroContainer}>
        <Image
            source={{ uri: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=2000' }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 }}
            resizeMode="cover"
        />
        <LinearGradient
            colors={['transparent', 'rgba(26, 16, 80, 0.8)', '#1a1050']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View style={[ls.heroInner, isSmall && { flexDirection: 'column' }]}>
            <View style={ls.heroLeft}>
                <Text style={[ls.heroTagline, isSmall && { fontSize: 36, lineHeight: 44 }]}>
                    From Application to Interview{'\n'}in <Text style={ls.heroHighlight}>Days, Not Weeks</Text>
                </Text>
                <Text style={ls.heroSubtext}>
                    RiResume uses AI to perfectly tailor your resume, generate cover letters, bridge skill gaps, and create custom interview guides — all designed to help you land your dream job faster.
                </Text>
                <View style={[ls.heroInputWrapper, isSmall && { flexDirection: 'column' }]}>
                    <View style={{ flex: 1 }}>
                        <input
                            type="text"
                            placeholder="Paste a job link from LinkedIn, Indeed..."
                            value={jobUrl}
                            onChange={(e: any) => setJobUrl(e.target.value)}
                            style={{ width: '100%', height: 50, paddingLeft: 18, paddingRight: 18, fontSize: 15, border: 'none', outline: 'none', backgroundColor: 'transparent', color: 'white' } as any}
                        />
                    </View>
                    <Pressable style={ls.heroInputBtn} onPress={onStart}>
                        <Text style={ls.heroInputBtnText}>Start Now →</Text>
                    </Pressable>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 14 }}>
                    Free to start · 110 tokens included · No subscription required
                </Text>
            </View>
            {!isSmall && (
                <View style={ls.heroRight}>
                    <View style={ls.heroMockup}>
                        <Image
                            source={require('../../../../assets/hero-mockup-final.png')}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                        />
                    </View>
                </View>
            )}
        </View>
    </View>
);

// ============================================================
// STATS BAR
// ============================================================
const StatsBar: React.FC<{ isSmall: boolean }> = ({ isSmall }) => (
    <View style={[ls.statsBar, isSmall && { gap: 24 }]}>
        {STATS.map((stat, i) => (
            <View key={i} style={ls.statItem}>
                <Text style={[ls.statValue, isSmall && { fontSize: 24 }]}>{stat.value}</Text>
                <Text style={ls.statLabel}>{stat.label}</Text>
            </View>
        ))}
    </View>
);

// ============================================================
// FEATURES SECTION
// ============================================================
const FeaturesSection: React.FC = () => (
    <View style={ls.sectionContainer}>
        <View style={ls.sectionInner}>
            <Text style={ls.sectionTitle}>Everything You Need to Land the Job</Text>
            <Text style={ls.sectionSubtitle}>
                From analysis to interview prep, RiResume covers your entire job application lifecycle with AI-powered tools.
            </Text>
            <View style={ls.featuresGrid}>
                {FEATURES.map((feat, i) => (
                    <View key={i} style={ls.featureCard}>
                        <View style={ls.featureCardContent}>
                            <View style={[ls.featureCardIcon, { backgroundColor: feat.accentColor + '12' }]}>
                                <MaterialCommunityIcons name={feat.icon as any} size={28} color={feat.accentColor} />
                            </View>
                            <Text style={ls.featureCardTitle}>{feat.title}</Text>
                            <Text style={ls.featureCardDesc}>{feat.description}</Text>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    </View>
);

// ============================================================
// HOW IT WORKS
// ============================================================
const HowItWorks: React.FC<{ isSmall: boolean }> = ({ isSmall }) => (
    <View style={ls.sectionContainerAlt}>
        <View style={ls.sectionInner}>
            <Text style={ls.sectionTitle}>How It Works</Text>
            <Text style={ls.sectionSubtitle}>Three simple steps to a job-winning application</Text>
            <View style={[ls.stepsRow, isSmall && { flexDirection: 'column', alignItems: 'center' }]}>
                {STEPS.map((step, i) => (
                    <React.Fragment key={i}>
                        <View style={ls.stepCard}>
                            <Text style={ls.stepNumber}>{step.number}</Text>
                            <View style={ls.stepIconWrap}>
                                <MaterialCommunityIcons name={step.icon as any} size={28} color={C.primary} />
                            </View>
                            <Text style={ls.stepTitle}>{step.title}</Text>
                            <Text style={ls.stepDesc}>{step.description}</Text>
                        </View>
                        {i < STEPS.length - 1 && !isSmall && (
                            <View style={ls.stepConnector}>
                                <Text style={ls.stepConnectorLine}>→</Text>
                            </View>
                        )}
                    </React.Fragment>
                ))}
            </View>
        </View>
    </View>
);

// ============================================================
// DETAILED FEATURE SECTIONS
// ============================================================
const DetailedFeatureSection: React.FC<{ feature: any; index: number; isSmall: boolean; onAction: () => void }> = ({ feature, index, isSmall, onAction }) => {
    const [jobUrl, setJobUrl] = useState('');
    const isReversed = !isSmall && index % 2 !== 0;

    return (
        <View nativeID={feature.id} style={[ls.detailedFeatureSection, { backgroundColor: index % 2 === 0 ? C.white : C.sectionAlt }]}>
            <View style={[ls.detailedFeatureInner, isSmall && { flexDirection: 'column', gap: 40 }, isReversed && { flexDirection: 'row-reverse' }]}>
                <View style={ls.detailedFeatureContent}>
                    <Text style={ls.detailedFeatureTitle}>{feature.title}</Text>
                    <Text style={ls.detailedFeatureSubtitle}>{feature.subtitle}</Text>
                    <Text style={ls.detailedFeatureDesc}>{feature.description}</Text>
                    <View style={ls.benefitList}>
                        {feature.benefits.map((benefit: string, i: number) => (
                            <View key={i} style={ls.benefitItem}>
                                <MaterialCommunityIcons name="check-circle" size={20} color={feature.accentColor} />
                                <Text style={ls.benefitText}>{benefit}</Text>
                            </View>
                        ))}
                    </View>
                </View>
                <View style={ls.detailedFeatureVisual}>
                    <View style={ls.featureInputContainer}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: C.textPrimary, marginBottom: 8 }}>
                            Try it now: Paste a job URL
                        </Text>
                        <textarea
                            placeholder="Paste your job link here..."
                            value={jobUrl}
                            onChange={(e: any) => setJobUrl(e.target.value)}
                            style={ls.featureTextarea}
                        />
                        <Pressable
                            style={[ls.featureActionBtn, { backgroundColor: feature.accentColor }]}
                            onPress={onAction}
                        >
                            <Text style={ls.featureActionBtnText}>{feature.btnText}</Text>
                        </Pressable>
                        <Text style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', marginTop: 8 }}>
                            Requires login to start processing
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

// ============================================================
// INTERLEAVED VALUE PROPS
// ============================================================
const ValuePropInterleaved: React.FC<{ items: typeof VALUE_PROPS }> = ({ items }) => (
    <View style={ls.interleavedValueSection}>
        <View style={ls.interleavedGrid}>
            {items.map((prop, i) => (
                <View key={i} style={ls.valuePropCard}>
                    <View style={ls.valuePropIconWrap}>
                        <MaterialCommunityIcons name={prop.icon as any} size={24} color={C.primary} />
                    </View>
                    <Text style={ls.valuePropTitle}>{prop.title}</Text>
                    <Text style={ls.valuePropDesc}>{prop.desc}</Text>
                </View>
            ))}
        </View>
    </View>
);

// ============================================================
// BLOG PREVIEW SECTION
// ============================================================
const BlogSection: React.FC = () => (
    <View style={ls.sectionContainer}>
        <View style={ls.sectionInner}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
                <View style={{ flex: 1, minWidth: 300 }}>
                    <Text style={[ls.sectionTitle, { textAlign: 'left', marginBottom: 8 }]}>From Our Blog</Text>
                    <Text style={[ls.sectionSubtitle, { textAlign: 'left', marginBottom: 0, marginHorizontal: 0 }]}>
                        Expert advice on resume optimization and landing your next role.
                    </Text>
                </View>
                <Pressable style={ls.seeAllBtn}>
                    <Text style={ls.seeAllText}>See All Articles →</Text>
                </Pressable>
            </View>
            <View style={ls.blogPreviewGrid}>
                {BLOG_POSTS.slice(0, 3).map((post) => (
                    <Pressable key={post.id} style={ls.blogPreviewCard}>
                        <Image source={{ uri: post.image }} style={ls.blogPreviewImage} />
                        <View style={ls.blogPreviewContent}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                                <Text style={ls.blogPreviewCat}>{post.category}</Text>
                                <Text style={ls.blogPreviewTime}>{post.readTime}</Text>
                            </View>
                            <Text style={ls.blogPreviewTitle}>{post.title}</Text>
                            <Text style={ls.blogPreviewDesc} numberOfLines={3}>{post.description}</Text>
                            <Text style={ls.blogPreviewDate}>{post.date}</Text>
                        </View>
                    </Pressable>
                ))}
            </View>
        </View>
    </View>
);

// ============================================================
// TESTIMONIALS SECTION
// ============================================================
const TestimonialsSection: React.FC = () => (
    <View style={ls.testiSection}>
        <View style={ls.sectionInner}>
            <Text style={ls.sectionTitle}>Trusted by Thousands</Text>
            <Text style={ls.sectionSubtitle}>See what professionals are saying about RiResume.</Text>
            <View style={ls.testiGrid}>
                {TESTIMONIALS.map((testi, i) => (
                    <View key={i} style={ls.testiCard}>
                        <Text style={ls.testiContent}>"{testi.content}"</Text>
                        <View style={ls.testiAuthor}>
                            <View style={ls.testiAvatar}>
                                <Text style={ls.testiAvatarText}>{testi.avatar}</Text>
                            </View>
                            <View>
                                <Text style={ls.testiName}>{testi.name}</Text>
                                <Text style={ls.testiRole}>{testi.role}</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    </View>
);

// ============================================================
// PRICING SECTION
// ============================================================
const PricingSection: React.FC<{ onGetStarted: () => void }> = ({ onGetStarted }) => (
    <View nativeID="pricing-section" style={ls.sectionContainer}>
        <View style={ls.sectionInner}>
            <Text style={ls.sectionTitle}>Simple, Transparent Pricing</Text>
            <Text style={ls.sectionSubtitle}>
                Pay only for what you use. No subscriptions, no hidden fees. Start free with 110 tokens.
            </Text>
            <View style={ls.pricingRow}>
                {PRICING_TIERS.map((tier, i) => (
                    <View key={tier.id} style={[ls.pricingCard, tier.highlighted && ls.pricingCardHighlight]}>
                        {tier.badge && (
                            <View style={ls.pricingBadge}>
                                <Text style={ls.pricingBadgeText}>{tier.badge}</Text>
                            </View>
                        )}
                        <Text style={ls.pricingName}>{tier.name}</Text>
                        <Text style={ls.pricingTokens}>{tier.tokens}</Text>
                        <Text style={ls.pricingTokensLabel}>tokens</Text>
                        <Text style={ls.pricingPrice}>${tier.price}</Text>
                        <Text style={ls.pricingDesc}>{tier.description}</Text>
                        {tier.bonusPercent && (
                            <Text style={ls.pricingBonus}>+{tier.bonusPercent}% Bonus Tokens</Text>
                        )}
                        <Pressable
                            style={[ls.pricingBtn, tier.highlighted ? ls.pricingBtnPrimary : ls.pricingBtnOutline]}
                            onPress={onGetStarted}
                        >
                            <Text style={[ls.pricingBtnText, { color: tier.highlighted ? C.white : C.primary }]}>
                                Get Started
                            </Text>
                        </Pressable>
                    </View>
                ))}
            </View>
            <Text style={[ls.sectionSubtitle, { marginBottom: 20, fontSize: 15 }]}>Token costs per action:</Text>
            <View style={ls.tokenCostsRow}>
                {TOKEN_COSTS.map((tc, i) => (
                    <View key={i} style={ls.tokenCostChip}>
                        <Text style={ls.tokenCostLabel}>{tc.action}</Text>
                        <Text style={ls.tokenCostValue}>{tc.cost} tokens</Text>
                    </View>
                ))}
            </View>
        </View>
    </View>
);

// ============================================================
// FAQ SECTION
// ============================================================
const FAQSection: React.FC = () => {
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const toggle = (i: number) => {
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(i) ? next.delete(i) : next.add(i);
            return next;
        });
    };

    return (
        <View nativeID="faq-section" style={ls.sectionContainerAlt}>
            <View style={ls.sectionInner}>
                <Text style={ls.sectionTitle}>Frequently Asked Questions</Text>
                <Text style={ls.sectionSubtitle}>Everything you need to know about RiResume</Text>
                <View style={ls.faqList}>
                    {FAQ_ITEMS.map((faq, i) => (
                        <View key={i} style={ls.faqItem}>
                            <Pressable style={ls.faqQuestion} onPress={() => toggle(i)}>
                                <Text style={ls.faqQuestionText}>{faq.question}</Text>
                                <Text style={ls.faqChevron}>{expanded.has(i) ? '−' : '+'}</Text>
                            </Pressable>
                            {expanded.has(i) && (
                                <View style={ls.faqAnswer}>
                                    <Text style={ls.faqAnswerText}>{faq.answer}</Text>
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
};

// ============================================================
// FOOTER
// ============================================================
const LandingFooter: React.FC<{ onSectionScroll: (id: string) => void }> = ({ onSectionScroll }) => {
    const router = useRouter();
    return (
        <View style={ls.footer}>
            <View style={ls.footerInner}>
                <View style={ls.footerTop}>
                    <View style={ls.footerBrand}>
                        <Text style={ls.footerBrandName}>RiResume</Text>
                        <Text style={ls.footerBrandDesc}>
                            AI-powered ATS resume optimization. Tailored resumes, cover letters, and interview prep — all in one platform.
                        </Text>
                    </View>
                    {FOOTER_COLUMNS.map((col, i) => (
                        <View key={i} style={ls.footerCol}>
                            <Text style={ls.footerColTitle}>{col.title}</Text>
                            {col.links.map((link, j) => (
                                <Pressable key={j} style={ls.footerLink} onPress={() => {
                                    if (link.href.startsWith('#')) {
                                        onSectionScroll(link.href.slice(1));
                                    } else if (link.href.startsWith('/')) {
                                        router.push(link.href as any);
                                    } else {
                                        Linking.openURL(link.href);
                                    }
                                }}>
                                    <Text style={ls.footerLinkText}>{link.label}</Text>
                                </Pressable>
                            ))}
                        </View>
                    ))}
                </View>
                <View style={ls.footerBottom}>
                    <Text style={ls.footerCopyright}>© 2026 RiResume. All rights reserved.</Text>
                    <View style={ls.footerSocial}>
                        {SOCIAL_LINKS.map((s, i) => (
                            <Pressable key={i} style={ls.footerSocialIcon} onPress={() => Linking.openURL(s.url)}>
                                <FontAwesome6 name={s.icon as any} size={18} color="rgba(255,255,255,0.5)" />
                            </Pressable>
                        ))}
                    </View>
                </View>
            </View>
        </View>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export const WebLandingPage: React.FC = () => {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isSmall = width < 900;
    const [jobUrl, setJobUrl] = useState('');
    const [activeDropdown, setActiveDropdown] = useState<DropdownKey>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const setPendingSharedUrl = useResumeStore(state => state.setPendingSharedUrl);

    const handleStart = useCallback(() => {
        if (jobUrl) setPendingSharedUrl(jobUrl);
        router.push('/(auth)/sign-in');
    }, [jobUrl]);

    const handleSignIn = useCallback(() => router.push('/(auth)/sign-in'), []);

    const scrollToSection = useCallback((sectionId?: string) => {
        if (!sectionId) return;
        setActiveDropdown(null);
        setMobileMenuOpen(false);
        // Small delay to allow dropdown to close if needed
        setTimeout(() => {
            document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }, []);

    const handlePricing = useCallback(() => {
        scrollToSection('pricing-section');
    }, [scrollToSection]);

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "RiResume",
        "operatingSystem": "Web, Android, iOS",
        "applicationCategory": "BusinessApplication",
        "offers": {
            "@type": "Offer",
            "price": "4.99",
            "priceCurrency": "USD"
        },
        "description": SEO_METADATA.description,
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.9",
            "ratingCount": "1200"
        },
        "featureList": FEATURES.map(f => f.title).join(", "),
        "screenshot": "https://riresume.com/assets/mockup.png",
        "author": {
            "@type": "Organization",
            "name": "RiResume",
            "url": "https://riresume.com"
        }
    };

    const faqJsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": FAQ_ITEMS.map(item => ({
            "@type": "Question",
            "name": item.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": item.answer
            }
        }))
    };

    return (
        <View style={ls.root}>
            <Head>
                <title>{SEO_METADATA.title}</title>
                <meta name="description" content={SEO_METADATA.description} />
                <meta name="keywords" content={SEO_METADATA.keywords} />
                <link rel="canonical" href="https://riresume.com" />

                {/* Open Graph / Facebook */}
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://riresume.com/" />
                <meta property="og:title" content={SEO_METADATA.title} />
                <meta property="og:description" content={SEO_METADATA.description} />
                <meta property="og:image" content="https://riresume.com/assets/og-image.png" />

                {/* Twitter */}
                <meta property="twitter:card" content="summary_large_image" />
                <meta property="twitter:url" content="https://riresume.com/" />
                <meta property="twitter:title" content={SEO_METADATA.title} />
                <meta property="twitter:description" content={SEO_METADATA.description} />
                <meta property="twitter:image" content="https://riresume.com/assets/og-image.png" />

                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />

                {/* JSON-LD Structured Data for Google and LLMs */}
                <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
                <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
            </Head>

            {/* Header */}
            <LandingHeader
                activeDropdown={activeDropdown}
                setActiveDropdown={setActiveDropdown}
                onSignIn={handleSignIn}
                onGetStarted={handleStart}
                onPricing={handlePricing}
                isSmall={isSmall}
                toggleMobileMenu={() => setMobileMenuOpen(true)}
            />
            {!isSmall && <DropdownContent activeDropdown={activeDropdown} onItemClick={scrollToSection} />}

            <MobileMenu
                isOpen={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                onSignIn={handleSignIn}
                onPricing={handlePricing}
                onItemClick={scrollToSection}
            />

            {/* Dropdown overlay to close on outside click */}
            {activeDropdown && !isSmall && (
                <Pressable
                    style={[ls.dropdownOverlay, { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 9997 }]}
                    onPress={() => setActiveDropdown(null)}
                />
            )}

            {/* Scrollable Content */}
            <ScrollView style={ls.scrollContent} contentContainerStyle={{ flexGrow: 1 }}>
                <HeroSection jobUrl={jobUrl} setJobUrl={setJobUrl} onStart={handleStart} isSmall={isSmall} />
                <StatsBar isSmall={isSmall} />
                <FeaturesSection />
                <HowItWorks isSmall={isSmall} />

                {/* Detailed Feature Sections with Interleaved Value Props */}
                {DETAILED_FEATURES.map((feature, index) => {
                    const cardsPerGap = 3;
                    const propSlice = VALUE_PROPS.slice(index * cardsPerGap, (index + 1) * cardsPerGap);

                    return (
                        <React.Fragment key={feature.id}>
                            <DetailedFeatureSection
                                feature={feature}
                                index={index}
                                isSmall={isSmall}
                                onAction={handleSignIn}
                            />
                            {propSlice.length > 0 && (
                                <ValuePropInterleaved items={propSlice} />
                            )}
                        </React.Fragment>
                    );
                })}

                <TestimonialsSection />
                <BlogSection />
                <PricingSection onGetStarted={handleStart} />
                <FAQSection />
                <LandingFooter onSectionScroll={scrollToSection} />
            </ScrollView>
        </View>
    );
};
