import { StyleSheet } from 'react-native';
import { C, HEADER_HEIGHT } from './LandingData';

export const ls = StyleSheet.create({
    // ==================== LAYOUT ====================
    root: { flex: 1, backgroundColor: C.white },
    scrollContent: { paddingTop: HEADER_HEIGHT },
    sectionContainer: { paddingHorizontal: 24, paddingVertical: 72, alignItems: 'center' },
    sectionContainerAlt: { paddingHorizontal: 24, paddingVertical: 72, alignItems: 'center', backgroundColor: C.sectionAlt },
    sectionInner: { width: '100%', maxWidth: 1200 },
    sectionTitle: { fontSize: 36, fontWeight: '500', color: C.textPrimary, textAlign: 'center', marginBottom: 12, letterSpacing: -0.5 },
    sectionSubtitle: { fontSize: 18, color: C.textSecondary, textAlign: 'center', marginBottom: 48, maxWidth: 640, alignSelf: 'center', lineHeight: 28 },

    // ==================== HEADER ====================
    header: { height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, backgroundColor: C.headerBg, justifyContent: 'space-between', zIndex: 9999 },
    headerLogo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerLogoImg: { width: 36, height: 36 },
    headerLogoText: { fontSize: 22, fontWeight: '500', color: C.white, letterSpacing: -0.5 },
    headerNav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerNavItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
    headerNavText: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.85)' },
    headerNavChevron: { marginLeft: 4, fontSize: 10, color: 'rgba(255,255,255,0.5)' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    signInBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
    signInText: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.85)' },
    getStartedBtn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 8, backgroundColor: C.primary },
    getStartedText: { fontSize: 14, fontWeight: '600', color: C.white },
    menuBtn: { padding: 8, marginLeft: 8 },

    // ==================== MOBILE NAV ====================
    mobileNavOverlay: { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000 },
    mobileNavContent: { position: 'absolute' as any, top: 0, right: 0, bottom: 0, width: 280, backgroundColor: C.headerBg, padding: 24, zIndex: 10001 },
    mobileNavHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
    mobileNavLink: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    mobileNavLinkText: { fontSize: 16, fontWeight: '600', color: C.white },
    mobileNavSectionTitle: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 24, marginBottom: 8 },
    mobileNavSubLink: { paddingVertical: 12, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },

    // ==================== DROPDOWN ====================
    dropdownOverlay: { position: 'absolute', top: HEADER_HEIGHT, left: 0, right: 0, bottom: 0, zIndex: 9998 },
    dropdownPanel: { backgroundColor: C.white, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, paddingVertical: 24, paddingHorizontal: 32, zIndex: 9999, maxWidth: 1200, alignSelf: 'center', width: '100%' },
    dropdownItem: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 10, gap: 14, marginBottom: 2 },
    dropdownItemIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.offWhite },
    dropdownItemLabel: { fontSize: 15, fontWeight: '600', color: C.textPrimary, marginBottom: 3 },
    dropdownItemDesc: { fontSize: 13, color: C.textSecondary, lineHeight: 18 },
    comingSoonBadge: { fontSize: 10, fontWeight: '700', color: C.accent, backgroundColor: C.starBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 8, overflow: 'hidden' },

    // ==================== BLOG MEGA MENU ====================
    blogGrid: { flexDirection: 'row', gap: 32, flexWrap: 'wrap' },
    blogColumn: { flex: 1, minWidth: 220 },
    blogColumnTitle: { fontSize: 14, fontWeight: '700', color: C.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
    blogTopic: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, marginBottom: 2 },
    blogTopicText: { fontSize: 14, color: C.textPrimary, lineHeight: 20 },

    // ==================== HERO ====================
    heroContainer: { paddingHorizontal: 32, paddingTop: 80, paddingBottom: 80, alignItems: 'center' },
    heroInner: { maxWidth: 1200, width: '100%', flexDirection: 'row', alignItems: 'center', gap: 64 },
    heroLeft: { flex: 1 },
    heroRight: { flex: 1, alignItems: 'center' },
    heroTagline: { fontSize: 52, fontWeight: '500', color: C.white, lineHeight: 62, letterSpacing: -1, marginBottom: 20 },
    heroHighlight: { color: C.accentLight },
    heroSubtext: { fontSize: 19, color: 'rgba(255,255,255,0.75)', lineHeight: 30, marginBottom: 36, maxWidth: 520 },
    heroInputWrapper: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', maxWidth: 520 },
    heroInput: { flex: 1, paddingHorizontal: 18, paddingVertical: 14, color: C.white, fontSize: 15, outlineWidth: 0 },
    heroInputBtn: { backgroundColor: C.primary, paddingHorizontal: 28, justifyContent: 'center', alignItems: 'center' },
    heroInputBtnText: { color: C.white, fontWeight: '700', fontSize: 15 },
    heroMockup: { width: '100%', maxWidth: 520, height: 320, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    heroMockupText: { color: 'rgba(255,255,255,0.35)', fontSize: 15, fontWeight: '500' },

    // ==================== SOCIAL PROOF ====================
    statsBar: { flexDirection: 'row', justifyContent: 'center', gap: 48, flexWrap: 'wrap', paddingVertical: 40, paddingHorizontal: 24, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.borderLight },
    statItem: { alignItems: 'center', minWidth: 160 },
    statValue: { fontSize: 32, fontWeight: '800', color: C.primary, marginBottom: 4 },
    statLabel: { fontSize: 13, color: C.textSecondary, textAlign: 'center', maxWidth: 180 },

    // ==================== FEATURES ====================
    featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, justifyContent: 'center' },
    featureCard: { width: 340, backgroundColor: C.white, borderRadius: 20, padding: 32, borderWidth: 1, borderColor: C.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12 },
    featureCardContent: { flex: 1 },
    featureCardIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    featureCardTitle: { fontSize: 20, fontWeight: '700', color: C.textPrimary, marginBottom: 12, letterSpacing: -0.4 },
    featureCardDesc: { fontSize: 15, color: C.textSecondary, lineHeight: 24 },

    // ==================== HOW IT WORKS ====================
    stepsRow: { flexDirection: 'row', gap: 32, justifyContent: 'center', flexWrap: 'wrap' },
    stepCard: { flex: 1, minWidth: 280, maxWidth: 360, alignItems: 'center', padding: 32 },
    stepNumber: { fontSize: 52, fontWeight: '900', color: C.primaryLight, opacity: 0.3, marginBottom: 8 },
    stepIconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.offWhite, alignItems: 'center', justifyContent: 'center', marginBottom: 18, borderWidth: 1, borderColor: C.cardBorder },
    stepTitle: { fontSize: 19, fontWeight: '500', color: C.textPrimary, marginBottom: 8, textAlign: 'center' },
    stepDesc: { fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 22 },
    stepConnector: { width: 48, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
    stepConnectorLine: { fontSize: 28, color: C.primaryLight, opacity: 0.4 },

    // ==================== PRICING ====================
    pricingRow: { flexDirection: 'row', gap: 24, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 },
    pricingCard: { width: 340, backgroundColor: C.cardBg, borderRadius: 20, padding: 32, borderWidth: 1, borderColor: C.cardBorder, alignItems: 'center' },
    pricingCardHighlight: { borderColor: C.primary, borderWidth: 2, transform: [{ scale: 1.03 }] },
    pricingBadge: { position: 'absolute', top: -12, paddingHorizontal: 16, paddingVertical: 5, borderRadius: 20, backgroundColor: C.primary },
    pricingBadgeText: { fontSize: 12, fontWeight: '700', color: C.white },
    pricingName: { fontSize: 22, fontWeight: '700', color: C.textPrimary, marginTop: 12, marginBottom: 4 },
    pricingTokens: { fontSize: 42, fontWeight: '900', color: C.primary, marginVertical: 8 },
    pricingTokensLabel: { fontSize: 14, color: C.textSecondary, marginBottom: 8 },
    pricingPrice: { fontSize: 28, fontWeight: '800', color: C.textPrimary, marginBottom: 4 },
    pricingDesc: { fontSize: 14, color: C.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
    pricingBonus: { fontSize: 13, fontWeight: '600', color: C.successGreen, marginBottom: 16 },
    pricingBtn: { width: '100%', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
    pricingBtnPrimary: { backgroundColor: C.primary },
    pricingBtnOutline: { borderWidth: 1.5, borderColor: C.primary },
    pricingBtnText: { fontSize: 15, fontWeight: '700' },
    tokenCostsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
    tokenCostChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: C.offWhite, borderWidth: 1, borderColor: C.borderLight },
    tokenCostLabel: { fontSize: 13, color: C.textPrimary, fontWeight: '500' },
    tokenCostValue: { fontSize: 13, color: C.primary, fontWeight: '700' },

    // ==================== DETAILED FEATURES ====================
    detailedFeatureSection: { paddingVertical: 96, paddingHorizontal: 24 },
    detailedFeatureInner: { maxWidth: 1200, width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 64 },
    detailedFeatureContent: { flex: 1.2 },
    detailedFeatureVisual: { flex: 1, backgroundColor: C.offWhite, borderRadius: 24, padding: 32, borderWidth: 1, borderColor: C.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12 },
    detailedFeatureTitle: { fontSize: 42, fontWeight: '500', color: C.textPrimary, marginBottom: 16, letterSpacing: -1 },
    detailedFeatureSubtitle: { fontSize: 20, fontWeight: '600', color: C.primary, marginBottom: 20 },
    detailedFeatureDesc: { fontSize: 17, color: C.textSecondary, lineHeight: 28, marginBottom: 32 },
    benefitList: { gap: 16, marginBottom: 40 },
    benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    benefitText: { fontSize: 16, color: C.textPrimary, fontWeight: '500' },
    featureInputContainer: { gap: 16 },
    featureTextarea: { width: '100%', height: 120, padding: 16, borderRadius: 12, backgroundColor: C.white, border: `1px solid ${C.border}`, fontSize: 15, color: C.textPrimary, outline: 'none', resize: 'none' } as any,
    featureActionBtn: { width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    featureActionBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },

    // ==================== VALUE PROPS GRID ====================
    valuePropDesc: { fontSize: 14, color: C.textSecondary, lineHeight: 20 },
    valuePropCard: { width: 280, padding: 24, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12 },
    valuePropIconWrap: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.offWhite, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    valuePropTitle: { fontSize: 18, fontWeight: '500', color: C.textPrimary, marginBottom: 8 },

    // ==================== INTERLEAVED VALUE PROPS ====================
    interleavedValueSection: { paddingVertical: 48, paddingHorizontal: 24, backgroundColor: C.white },
    interleavedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, justifyContent: 'center', maxWidth: 1200, width: '100%', alignSelf: 'center' },

    // ==================== BLOG PREVIEW ====================
    seeAllBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: C.primary },
    seeAllText: { fontSize: 14, fontWeight: '600', color: C.primary },
    blogPreviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 32, justifyContent: 'center' },
    blogPreviewCard: { width: 360, backgroundColor: C.white, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
    blogPreviewImage: { width: '100%', height: 200 },
    blogPreviewContent: { padding: 24 },
    blogPreviewCat: { fontSize: 12, fontWeight: '700', color: C.primary, textTransform: 'uppercase' },
    blogPreviewTime: { fontSize: 12, color: C.textMuted },
    blogPreviewTitle: { fontSize: 20, fontWeight: '500', color: C.textPrimary, marginVertical: 12, lineHeight: 28 },
    blogPreviewDesc: { fontSize: 14, color: C.textSecondary, lineHeight: 22, marginBottom: 20 },
    blogPreviewDate: { fontSize: 13, color: C.textMuted },

    // ==================== TESTIMONIALS ====================
    testiSection: { paddingVertical: 96, backgroundColor: C.sectionAlt },
    testiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, justifyContent: 'center', maxWidth: 1200, width: '100%', alignSelf: 'center', paddingHorizontal: 24 },
    testiCard: { width: 360, padding: 32, borderRadius: 24, backgroundColor: C.white, borderWidth: 1, borderColor: C.cardBorder },
    testiContent: { fontSize: 16, color: C.textPrimary, lineHeight: 26, marginBottom: 24, fontStyle: 'italic' },
    testiAuthor: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    testiAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
    testiAvatarText: { color: C.white, fontWeight: '700', fontSize: 14 },
    testiName: { fontSize: 16, fontWeight: '500', color: C.textPrimary },
    testiRole: { fontSize: 14, color: C.textMuted },
    testiViewAllBtn: { marginTop: 48, paddingVertical: 16, paddingHorizontal: 36, borderRadius: 100, backgroundColor: C.primary, alignSelf: 'center', shadowColor: C.primaryGlow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
    testiViewAllBtnText: { color: C.white, fontSize: 16, fontWeight: '600' },

    // ==================== FAQ ====================
    faqList: { maxWidth: 800, width: '100%', alignSelf: 'center' },
    faqItem: { borderBottomWidth: 1, borderBottomColor: C.borderLight },
    faqQuestion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 4 },
    faqQuestionText: { fontSize: 16, fontWeight: '600', color: C.textPrimary, flex: 1, paddingRight: 16 },
    faqChevron: { fontSize: 18, color: C.textMuted },
    faqAnswer: { paddingBottom: 20, paddingHorizontal: 4 },
    faqAnswerText: { fontSize: 15, color: C.textSecondary, lineHeight: 24 },

    // ==================== MOBILE APP BANNER ====================
    appBanner: { paddingVertical: 72, paddingHorizontal: 24, alignItems: 'center' },
    appBannerInner: { maxWidth: 900, width: '100%', alignItems: 'center', gap: 24 },
    appBannerIcon: { width: 72, height: 72, borderRadius: 20, marginBottom: 8 },
    appBannerTitle: { fontSize: 32, fontWeight: '500', color: C.white, textAlign: 'center', letterSpacing: -0.5, marginBottom: 4 },
    appBannerSubtitle: { fontSize: 17, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 26, maxWidth: 560 },
    appBannerBadges: { flexDirection: 'row', gap: 16, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
    appBadgeBtn: { height: 52, paddingHorizontal: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    appBadgeIcon: { width: 24, height: 24 },
    appBadgeTextWrap: {},
    appBadgeSmallText: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '500', textTransform: 'uppercase' as any, letterSpacing: 0.5 },
    appBadgeBigText: { fontSize: 17, fontWeight: '600', color: C.white },

    // ==================== FOOTER ====================
    footer: { backgroundColor: C.footerBg, paddingHorizontal: 32, paddingTop: 64, paddingBottom: 32 },
    footerInner: { maxWidth: 1200, width: '100%', alignSelf: 'center' },
    footerTop: { flexDirection: 'row', gap: 48, flexWrap: 'wrap', marginBottom: 48 },
    footerBrand: { minWidth: 240, maxWidth: 300 },
    footerBrandName: { fontSize: 22, fontWeight: '500', color: C.white, marginBottom: 12 },
    footerBrandDesc: { fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 22 },
    footerCol: { minWidth: 140 },
    footerColTitle: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 16 },
    footerLink: { paddingVertical: 5 },
    footerLinkText: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
    footerBottom: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
    footerCopyright: { fontSize: 13, color: 'rgba(255,255,255,0.35)' },
    footerSocial: { flexDirection: 'row', gap: 16 },
    footerSocialIcon: { opacity: 0.5 },
});
