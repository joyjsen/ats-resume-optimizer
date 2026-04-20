import React from 'react';
import { View, Text, Pressable, Linking, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
// import { FontAwesome6 } from '@expo/vector-icons';
import { TwitterIcon, LinkedInIcon, GitHubIcon } from '../../common/StaticIcons';

import { FOOTER_COLUMNS, SOCIAL_LINKS } from './LandingData';
import { ls } from './LandingStyles';

const SocialIconMapper = ({ name, size, color }: { name: string; size: number; color: string }) => {
    switch (name) {
        case 'twitter': return <TwitterIcon size={size} color={color} />;
        case 'linkedin': return <LinkedInIcon size={size} color={color} />;
        case 'github': return <GitHubIcon size={size} color={color} />;
        default: return null;
    }
};

export const UniversalWebFooter: React.FC = () => {

    const router = useRouter();
    const pathname = usePathname();
    const isHomePage = pathname === '/';

    const handleLinkPress = (href: string) => {
        if (href.startsWith('#')) {
            const sectionId = href.slice(1);
            if (isHomePage) {
                // Scroll smoothly if we are already on the home page
                if (typeof document !== 'undefined') {
                    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
                }
            } else {
                // Push to the home page with the hash
                router.push(`/#${sectionId}`);
            }
        } else if (href.startsWith('/')) {
            router.push(href as any);
        } else {
            Linking.openURL(href);
        }
    };

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
                                <Pressable key={j} style={ls.footerLink} onPress={() => handleLinkPress(link.href)}>
                                    <Text style={ls.footerLinkText}>{link.label}</Text>
                                </Pressable>
                            ))}
                        </View>
                    ))}
                {Platform.OS === 'web' && (
                    <View style={ls.footerCol}>
                        <Text style={ls.footerColTitle}>Website</Text>
                        {[
                            { label: 'Home', url: 'https://www.riresume.com' },
                            { label: 'Pricing', url: 'https://www.riresume.com/#pricing-section' },
                            { label: 'Blog', url: 'https://www.riresume.com/blog' },
                            { label: 'Features', url: 'https://www.riresume.com/#analysis' },
                        ].map((link, j) => (
                            <Pressable key={j} style={ls.footerLink} onPress={() => window.open(link.url, '_blank')}>
                                <Text style={ls.footerLinkText}>{link.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                )}
                </View>
                <View style={ls.footerBottom}>
                    <Text style={ls.footerCopyright}>© 2026 RiResume. All rights reserved.</Text>
                    <View style={ls.footerSocial}>
                        {SOCIAL_LINKS.map((s, i) => (
                            <Pressable key={i} style={ls.footerSocialIcon} onPress={() => Linking.openURL(s.url)}>
                                <SocialIconMapper name={s.icon} size={18} color="rgba(255,255,255,0.5)" />
                            </Pressable>
                        ))}
                    </View>

                </View>
            </View>
        </View>
    );
};
