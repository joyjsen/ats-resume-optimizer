import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, useTheme, ActivityIndicator, List } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { TOKEN_PACKAGES, TokenPackage } from '../src/types/profile.types';
import { useProfileStore } from '../src/store/profileStore';
import { stripeService } from '../src/services/stripe/stripeService';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function PurchaseScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { userProfile, refreshProfile } = useProfileStore();
    const [loading, setLoading] = useState<string | null>(null);

    const handlePurchase = async (pkg: TokenPackage) => {
        if (!userProfile) return;

        setLoading(pkg.id);
        try {
            // 1. Initialize payment sheet (Simulation/Backend call)
            await stripeService.initializePaymentSheet(userProfile.uid, pkg.price, theme.dark);

            // 2. Open payment sheet
            const result: any = await stripeService.openPaymentSheet(
                userProfile.uid,
                pkg.tokens,
                pkg.id,
                pkg.price
            );

            if (result.success) {
                await refreshProfile();
                Alert.alert(
                    "Success!",
                    `Successfully purchased ${pkg.tokens} tokens. Your new balance is reflected in your profile.`,
                    [{ text: "OK", onPress: () => router.back() }]
                );
            } else if (result.message === 'canceled') {
                // User closed the payment sheet, no error alert needed
                console.log("User canceled checkout");
            }
        } catch (error: any) {
            console.error("Purchase error detail:", error);
            Alert.alert(
                "Purchase Error",
                error.message || "Something went wrong during the transaction."
            );
        } finally {
            setLoading(null);
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onSurface }]}>Refill Tokens</Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Choose a package to continue using AI-powered features.
                </Text>
            </View>

            <View style={styles.packageList}>
                {TOKEN_PACKAGES.map((pkg) => (
                    <Card key={pkg.id} style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
                        <Card.Content>
                            <View style={styles.cardHeader}>
                                <View>
                                    <Text variant="titleLarge" style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>{pkg.name}</Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{pkg.description}</Text>
                                </View>
                                {pkg.bonusPercent && (
                                    <View style={[styles.bonusTag, { backgroundColor: theme.colors.primaryContainer }]}>
                                        <Text variant="labelSmall" style={{ color: theme.colors.onPrimaryContainer }}>+{pkg.bonusPercent}% Bonus</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.priceRow}>
                                <View style={styles.tokenCount}>
                                    <MaterialCommunityIcons name="database" size={24} color="#FFD700" />
                                    <Text variant="headlineSmall" style={{ fontWeight: 'bold', marginLeft: 8, color: theme.colors.onSurface }}>{pkg.tokens}</Text>
                                    <Text variant="bodyMedium" style={{ marginLeft: 4, color: theme.colors.onSurfaceVariant }}>tokens</Text>
                                </View>
                                <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>${pkg.price}</Text>
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

            <View style={styles.footer}>
                <List.Item
                    title="Safe & Secure"
                    description="Payments are processed securely by Stripe."
                    left={props => <List.Icon {...props} icon="shield-check" color="#4CAF50" />}
                    titleStyle={{ color: theme.colors.onSurface }}
                    descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                />
                <Text variant="bodySmall" style={[styles.disclaimer, { color: theme.colors.onSurfaceVariant }]}>
                    Tokens do not expire and can be used for any AI-powered feature in the app.
                </Text>
            </View>
        </ScrollView>
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
        justifyContent: 'space-between',
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
    }
});
