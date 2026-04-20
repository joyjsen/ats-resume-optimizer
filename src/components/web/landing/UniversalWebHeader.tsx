import React, { useState, useCallback } from 'react';
import { View, Pressable, Image, Text, Linking, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
// import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MenuIcon, CloseIcon, FileSearchIcon, FileEditIcon, PlusCircleIcon, FilePlusIcon, MailIcon, BookOpenIcon, GraduationCapIcon, PhoneIcon } from '../../common/StaticIcons';

import Head from 'expo-router/head';
import {
    C, HEADER_HEIGHT,
    ANALYSIS_ITEMS, ESSENTIALS_ITEMS, CONNECT_ITEMS, BLOG_CATEGORIES,
    type NavDropdownItem
} from './LandingData';
import { ls } from './LandingStyles';

export type DropdownKey = 'analysis' | 'essentials' | 'blog' | 'connect' | null;

const NAV_ITEMS: { key: DropdownKey; label: string }[] = [
    { key: 'analysis', label: 'Analysis & Optimization' },
    { key: 'essentials', label: 'Job Application Essentials' },
    { key: 'blog', label: 'Blog' },
    { key: 'connect', label: 'Connect' },
];

const StaticIconMapper = ({ name, size, color }: { name: string; size: number; color: string }) => {
    switch (name) {
        case 'file-search': return <FileSearchIcon size={size} color={color} />;
        case 'file-edit': return <FileEditIcon size={size} color={color} />;
        case 'plus-circle': return <PlusCircleIcon size={size} color={color} />;
        case 'file-plus': return <FilePlusIcon size={size} color={color} />;
        case 'mail': return <MailIcon size={size} color={color} />;
        case 'book-open': return <BookOpenIcon size={size} color={color} />;
        case 'graduation-cap': return <GraduationCapIcon size={size} color={color} />;
        case 'phone': return <PhoneIcon size={size} color={color} />;
        default: return null;
    }
};


export const UniversalWebHeader: React.FC<{
    isSmall: boolean;
    onSignIn: () => void;
    onGetStarted: () => void;
    onPricing: () => void;
}> = ({ isSmall, onSignIn, onGetStarted, onPricing }) => {
    const router = useRouter();
    const pathname = usePathname();
    const isHomePage = pathname === '/';

    const [activeDropdown, setActiveDropdown] = useState<DropdownKey>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const toggleDropdown = (key: DropdownKey) => {
        setActiveDropdown(activeDropdown === key ? null : key);
    };

    const handleItemClick = useCallback((sectionId?: string) => {
        setActiveDropdown(null);
        setMobileMenuOpen(false);
        if (!sectionId) return;

        if (isHomePage) {
            setTimeout(() => {
                if (typeof document !== 'undefined') {
                    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);
        } else {
            router.push(`/#${sectionId}`);
        }
    }, [isHomePage, router]);

    const handlePricing = useCallback(() => {
        setActiveDropdown(null);
        setMobileMenuOpen(false);
        if (isHomePage) {
            onPricing();
        } else {
            router.push('/#pricing-section');
        }
    }, [isHomePage, onPricing, router]);

    const orgSchema = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "RiResume",
        "url": "https://www.riresume.com",
        "logo": "https://www.riresume.com/assets/logo-72.png",
        "sameAs": [
            "https://apps.apple.com/app/riresume/id6740043838",
            "https://play.google.com/store/apps/details?id=com.jsn22.atsresumeoptimizer"
        ]
    };

    const websiteSchema = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "RiResume",
        "url": "https://www.riresume.com"
    };

    return (
        <>
            <Head>
                <script type="application/ld+json">{JSON.stringify(orgSchema)}</script>
                <script type="application/ld+json">{JSON.stringify(websiteSchema)}</script>
            </Head>
            <View style={[ls.header, { position: 'fixed' as any, top: 0, left: 0, right: 0, zIndex: 10000 }]}>
                {/* Logo */}
                <Pressable onPress={() => {
                    if (Platform.OS === 'web') {
                        window.location.href = 'https://www.riresume.com';
                    } else {
                        router.push('/');
                    }
                }} style={ls.headerLogo}>
                    <Image source={require('../../../../assets/logo-72.png')} style={ls.headerLogoImg} resizeMode="contain" accessibilityLabel="RiResume Logo" />
                    <Text style={ls.headerLogoText}>RiResume</Text>
                </Pressable>

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
                        <Pressable style={ls.headerNavItem} onPress={handlePricing}>
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
                        <Pressable style={ls.menuBtn} onPress={() => setMobileMenuOpen(true)}>
                            <MenuIcon size={28} color={C.white} />
                        </Pressable>
                    )}

                </View>
            </View>

            {/* Dropdown Content */}
            {!isSmall && <DropdownContent activeDropdown={activeDropdown} onItemClick={handleItemClick} />}

            {/* Mobile Menu */}
            <MobileMenu
                isOpen={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                onSignIn={onSignIn}
                onPricing={handlePricing}
                onItemClick={handleItemClick}
            />

            {/* Dropdown Overlay */}
            {activeDropdown && !isSmall && (
                <Pressable
                    style={[ls.dropdownOverlay, { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 9997 }]}
                    onPress={() => setActiveDropdown(null)}
                />
            )}
        </>
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
        <View style={[ls.mobileNavOverlay, { zIndex: 10001 }]}>
            <Pressable style={{ flex: 1 }} onPress={onClose} />
            <View style={ls.mobileNavContent}>
                <View style={ls.mobileNavHeader}>
                    <Text style={ls.headerLogoText}>Menu</Text>
                    <Pressable onPress={onClose}>
                        <CloseIcon size={28} color={C.white} />
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
                <Pressable style={[ls.mobileNavLink, { marginTop: 20 }]} onPress={() => { onSignIn(); onClose(); }}>
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
                        <StaticIconMapper name={item.icon || ''} size={20} color={C.primary} />
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

const BlogDropdown: React.FC = () => {
    const router = useRouter();
    return (
        <View style={ls.dropdownPanel}>
            <View style={ls.blogGrid}>
                {BLOG_CATEGORIES.map((cat, i) => (
                    <View key={i} style={ls.blogColumn}>
                        <Text style={ls.blogColumnTitle}>{cat.title}</Text>
                        {cat.topics.map((topic, j) => (
                            <Pressable key={j} style={ls.blogTopic} onPress={() => router.push(topic.url as any)}>
                                <Text style={ls.blogTopicText}>{topic.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                ))}
            </View>
        </View>
    );
};

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
