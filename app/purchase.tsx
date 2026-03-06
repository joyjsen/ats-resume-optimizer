import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { Text, Card, Button, useTheme, ActivityIndicator, List, Portal, Modal, Searchbar } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TOKEN_PACKAGES, TokenPackage } from '../src/types/profile.types';
import { useProfileStore } from '../src/store/profileStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Platform-gated imports: Stripe for Android/Web, IAP for iOS
import { stripeService } from '../src/services/stripe/stripeService';
import { iapService, PACKAGE_TO_APPLE_ID } from '../src/services/iap/iapService';
import { localizationService, COUNTRIES, CountryData } from '../src/services/localization/localizationService';

const isIOS = Platform.OS === 'ios';

export default function PurchaseScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { status } = useLocalSearchParams<{ status: string }>();
    const { userProfile, refreshProfile } = useProfileStore();
    const [loading, setLoading] = useState<string | null>(null);
    const [selectedCountry, setSelectedCountry] = useState<CountryData>(localizationService.getDefaultCountry());
    const [countryModalVisible, setCountryModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Handle return from Stripe Checkout on web
    useEffect(() => {
        if (Platform.OS === 'web' && status === 'success') {
            const handleSuccess = async () => {
                await refreshProfile();
                Alert.alert(
                    "Success!",
                    "Your tokens have been added to your account.",
                    [{ text: "OK", onPress: () => router.replace('/(tabs)/profile' as any) }]
                );
            };
            handleSuccess();
        } else if (Platform.OS === 'web' && status === 'cancel') {
            Alert.alert("Canceled", "Your purchase was canceled.");
        }
    }, [status]);

    // Initialize IAP on mount (iOS only)
    useEffect(() => {
        if (isIOS) {
            const initIAP = async () => {
                try {
                    console.log("[PurchaseScreen] Initializing IAP...");
                    await iapService.initialize();
                } catch (error) {
                    console.warn("[PurchaseScreen] IAP initialization failed:", error);
                }
            };
            initIAP();
        }
    }, []);

    /**
     * Handle purchase — routes to IAP on iOS, Stripe on all other platforms.
     */
    const handlePurchase = async (pkg: TokenPackage) => {
        if (!userProfile) return;

        setLoading(pkg.id);
        try {
            if (isIOS) {
                // ---- iOS: Apple In-App Purchase ----
                const result = await iapService.purchaseTokens(pkg.id);

                if (result.success) {
                    await refreshProfile();
                    Alert.alert(
                        "Success!",
                        `Successfully purchased ${pkg.tokens} tokens. Your new balance is reflected in your profile.`,
                        [{ text: "OK", onPress: () => router.back() }]
                    );
                } else if (result.message === 'canceled') {
                    console.log("User canceled IAP checkout");
                }
            } else {
                // ---- Android / Web: Stripe ----
                await stripeService.initializePaymentSheet(userProfile.uid, pkg.price, selectedCountry.currency, theme.dark);

                const result: any = await stripeService.openPaymentSheet(
                    userProfile.uid,
                    pkg.tokens,
                    pkg.id,
                    pkg.price,
                    selectedCountry.currency
                );

                if (result.success) {
                    if (Platform.OS !== 'web') {
                        await refreshProfile();
                        Alert.alert(
                            "Success!",
                            `Successfully purchased ${pkg.tokens} tokens. Your new balance is reflected in your profile.`,
                            [{ text: "OK", onPress: () => router.back() }]
                        );
                    }
                } else if (result.message === 'canceled') {
                    console.log("User canceled Stripe checkout");
                }
            }
        } catch (error: any) {
            console.error("[PurchaseScreen] Purchase error detail:", error);
            // Small delay ensures the loading state change doesn't dismiss the alert immediately
            setTimeout(() => {
                Alert.alert(
                    "Purchase Error",
                    error.message || "Something went wrong during the transaction."
                );
            }, 100);
        } finally {
            setLoading(null);
        }
    };

    /**
     * Restore purchases (iOS only, required by Apple).
     */
    const handleRestore = async () => {
        setLoading('restore');
        try {
            await iapService.restorePurchases();
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to restore purchases.");
        } finally {
            setLoading(null);
        }
    };

    return (
        <Portal.Host>
            <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onSurface }]}>Refill Tokens</Text>
                            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                Choose a package to continue using AI.
                            </Text>
                        </View>
                        <Button
                            mode="outlined"
                            onPress={() => setCountryModalVisible(true)}
                            style={{ borderRadius: 8 }}
                            contentStyle={{ height: 40 }}
                            labelStyle={{ fontSize: 12 }}
                        >
                            {selectedCountry.code !== '??' ? selectedCountry.code : selectedCountry.name.substring(0, 3).toUpperCase()} ({selectedCountry.currency})
                        </Button>
                    </View>
                </View>

                <View style={styles.packageList}>
                    {TOKEN_PACKAGES.map((pkg) => (
                        <Card key={pkg.id} style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
                            <Card.Content>
                                <View style={styles.cardHeader}>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <Text variant="titleLarge" style={{ fontWeight: 'bold', color: theme.colors.onSurface, marginRight: 8 }}>{pkg.name}</Text>
                                            {pkg.bonusPercent && (
                                                <View style={[styles.bonusTag, { backgroundColor: theme.colors.primaryContainer }]}>
                                                    <Text variant="labelSmall" style={{ color: theme.colors.onPrimaryContainer }}>+{pkg.bonusPercent}% Bonus</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={{ marginTop: 4 }}>
                                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{pkg.description}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.priceRow}>
                                    <View style={styles.tokenCount}>
                                        <MaterialCommunityIcons name="database" size={24} color="#FFD700" />
                                        <Text variant="headlineSmall" style={{ fontWeight: 'bold', marginLeft: 8, color: theme.colors.onSurface }}>{pkg.tokens}</Text>
                                        <Text variant="bodyMedium" style={{ marginLeft: 4, color: theme.colors.onSurfaceVariant }}>tokens</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>
                                            {(() => {
                                                if (isIOS) {
                                                    const appleProduct = iapService.getProducts().find(p => p.productId === PACKAGE_TO_APPLE_ID[pkg.id]);
                                                    if (appleProduct?.localizedPrice) {
                                                        return appleProduct.localizedPrice;
                                                    }
                                                }
                                                return localizationService.formatCurrency(
                                                    localizationService.estimatePrice(pkg.price, selectedCountry.currency, selectedCountry.name, pkg.id),
                                                    selectedCountry.currency
                                                );
                                            })()}
                                        </Text>
                                        {(selectedCountry.currency !== 'USD' || (isIOS && iapService.getProducts().length > 0)) && (
                                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                                {isIOS && iapService.getProducts().some(p => p.productId === PACKAGE_TO_APPLE_ID[pkg.id])
                                                    ? 'App Store Price'
                                                    : `approx. $${pkg.price} USD`}
                                            </Text>
                                        )}
                                    </View>
                                </View>

                                <Button
                                    mode="contained"
                                    onPress={() => handlePurchase(pkg)}
                                    loading={loading === pkg.id}
                                    disabled={loading !== null}
                                    style={styles.button}
                                >
                                    {loading === pkg.id ? "Processing..." : "Buy Now"}
                                </Button>
                            </Card.Content>
                        </Card>
                    ))}
                </View>

                <Portal>
                    <Modal
                        visible={countryModalVisible}
                        onDismiss={() => setCountryModalVisible(false)}
                        contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.elevation.level3 }]}
                    >
                        <View style={styles.modalHeader}>
                            <Text variant="titleMedium">Select Country/Currency</Text>
                            <Button onPress={() => setCountryModalVisible(false)}>Close</Button>
                        </View>
                        <Searchbar
                            placeholder="Search countries..."
                            onChangeText={setSearchQuery}
                            value={searchQuery}
                            style={styles.searchbar}
                            autoFocus={false}
                        />
                        <ScrollView
                            style={{ maxHeight: 450 }}
                            keyboardShouldPersistTaps="handled"
                        >
                            {COUNTRIES.filter(c =>
                                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                c.code.toLowerCase().includes(searchQuery.toLowerCase())
                            ).map((country) => (
                                <List.Item
                                    key={country.name}
                                    title={country.name}
                                    description={`${country.currency} (${country.symbol})`}
                                    onPress={() => {
                                        console.log(`[PurchaseScreen] Selected country: ${country.code} (${country.currency})`);
                                        setSelectedCountry(country);
                                        setCountryModalVisible(false);
                                    }}
                                    right={props => selectedCountry.code === country.code ? <List.Icon {...props} icon="check" /> : null}
                                />
                            ))}
                        </ScrollView>
                    </Modal>
                </Portal>

                <View style={styles.footer}>
                    {/* iOS: Show Restore Purchases button (required by Apple) */}
                    {isIOS && (
                        <Button
                            mode="text"
                            onPress={handleRestore}
                            loading={loading === 'restore'}
                            disabled={loading !== null}
                            style={{ marginBottom: 12 }}
                        >
                            Restore Purchases
                        </Button>
                    )}

                    <List.Item
                        title="Safe & Secure"
                        description={isIOS ? "Payments are processed securely by Apple." : "Payments are processed securely by Stripe."}
                        left={props => <List.Icon {...props} icon="shield-check" color="#4CAF50" />}
                        titleStyle={{ color: theme.colors.onSurface }}
                        descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                    />
                    <Text variant="bodySmall" style={[styles.disclaimer, { color: theme.colors.onSurfaceVariant }]}>
                        Tokens do not expire and can be used for any AI-powered feature in the app.
                    </Text>
                </View>
            </ScrollView>
        </Portal.Host>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 24,
    },
    title: {
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'left'
    },
    packageList: {
        padding: 16,
    },
    card: {
        marginBottom: 16,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    bonusTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    tokenCount: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    button: {
        borderRadius: 8,
    },
    footer: {
        padding: 24,
        alignItems: 'center',
    },
    disclaimer: {
        textAlign: 'center',
        marginTop: 16,
    },
    modalContent: {
        margin: 20,
        padding: 20,
        borderRadius: 12,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    searchbar: {
        marginBottom: 16,
        elevation: 0,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
});
