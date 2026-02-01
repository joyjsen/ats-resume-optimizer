import { StyleSheet, Platform, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 768;

export const webStyles = StyleSheet.create({
    // Landing Page Layout
    landingContainer: {
        flex: 1,
    },
    heroSection: {
        flexDirection: isSmallScreen ? 'column' : 'row',
        padding: isSmallScreen ? 24 : 64,
        minHeight: isSmallScreen ? 'auto' : 600,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroContent: {
        flex: 1,
        maxWidth: 600,
        paddingRight: isSmallScreen ? 0 : 48,
        marginBottom: isSmallScreen ? 32 : 0,
    },
    heroTagline: {
        fontSize: isSmallScreen ? 28 : 42,
        fontWeight: 'bold',
        marginBottom: 16,
        lineHeight: isSmallScreen ? 36 : 52,
    },
    heroSubheadline: {
        fontSize: isSmallScreen ? 16 : 20,
        opacity: 0.85,
        marginBottom: 24,
        lineHeight: isSmallScreen ? 24 : 30,
    },
    loginFormContainer: {
        width: isSmallScreen ? '100%' : 400,
        padding: 32,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },

    // Features Section
    featuresSection: {
        padding: isSmallScreen ? 24 : 64,
        paddingTop: 48,
        paddingBottom: 48,
    },
    featuresSectionTitle: {
        fontSize: isSmallScreen ? 24 : 32,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 40,
    },
    featuresGrid: {
        flexDirection: isSmallScreen ? 'column' : 'row',
        justifyContent: 'center',
        gap: 24,
    },
    featureCard: {
        flex: 1,
        maxWidth: isSmallScreen ? '100%' : 350,
        padding: 24,
        borderRadius: 12,
        alignItems: 'center',
    },
    featureIcon: {
        marginBottom: 16,
    },
    featureTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    featureDescription: {
        fontSize: 14,
        opacity: 0.75,
        textAlign: 'center',
        lineHeight: 22,
    },

    // Footer
    footer: {
        padding: 24,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 24,
        borderTopWidth: 1,
    },
    footerLink: {
        fontSize: 14,
    },

    // Sidebar
    sidebarContainer: {
        width: isSmallScreen ? 60 : 240,
        paddingVertical: 16,
        borderRightWidth: 1,
    },
    sidebarItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginHorizontal: 8,
        borderRadius: 8,
    },
    sidebarItemActive: {
        // background color set inline with theme
    },
    sidebarItemText: {
        marginLeft: 12,
        fontSize: 15,
        fontWeight: '500',
    },
    sidebarTokens: {
        padding: 16,
        marginTop: 'auto',
        borderTopWidth: 1,
    },

    // Layout Wrapper
    appLayoutContainer: {
        flex: 1,
        flexDirection: 'row',
    },
    mainContent: {
        flex: 1,
    },
});
