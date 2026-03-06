/**
 * Apple In-App Purchase Service
 *
 * Handles iOS-only IAP purchases using expo-iap.
 */

import { Platform, Alert } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { activityService } from '../firebase/activityService';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Conditionally import expo-iap only on iOS
let Iap: typeof import('expo-iap') | null = null;

if (Platform.OS === 'ios') {
    try {
        Iap = require('expo-iap');
    } catch (e) {
        console.warn('[IAP] Failed to load expo-iap module:', e);
    }
}

const IAP_PRODUCT_IDS = [
    'com.jsn22.atsresumeoptimizer.tokens.starter',
    'com.jsn22.atsresumeoptimizer.tokens.pro',
    'com.jsn22.atsresumeoptimizer.tokens.premium',
];

export const PACKAGE_TO_APPLE_ID: Record<string, string> = {
    'starter': 'com.jsn22.atsresumeoptimizer.tokens.starter',
    'pro': 'com.jsn22.atsresumeoptimizer.tokens.pro',
    'premium': 'com.jsn22.atsresumeoptimizer.tokens.premium',
};

class IAPService {
    private isConnected = false;
    private products: any[] = [];
    private isInitializing = false;
    private isFetching = false;
    private purchaseSubscription: { remove: () => void } | null = null;
    private processedTransactions: Set<string> = new Set();
    private processingTransactions: Set<string> = new Set();

    /**
     * Initialize connection to the App Store.
     */
    async initialize(): Promise<void> {
        if (Platform.OS !== 'ios' || !Iap) {
            return;
        }

        if (this.isInitializing) {
            console.log('[IAP] Initialization already in progress, skipping...');
            return;
        }

        try {
            this.isInitializing = true;
            console.log('[IAP] Initializing connection to App Store...');
            console.log(`[IAP] App Bundle ID: ${Application.applicationId}`);
            console.log(`[IAP] Is Real Device: ${Device.isDevice}`);
            console.log(`[IAP] Expo App Ownership: ${Constants.appOwnership}`);

            if (Constants.appOwnership === 'expo') {
                console.warn('[IAP] CRITICAL: Running in EXPO GO. IAP WILL NOT WORK.');
            }

            await Iap.initConnection();
            this.isConnected = true;
            console.log('[IAP] Connected to App Store successfully.');

            // Set up purchase listener to handle unfinished transactions automatically
            if (this.purchaseSubscription) {
                this.purchaseSubscription.remove();
            }

            this.purchaseSubscription = Iap.purchaseUpdatedListener(async (purchase) => {
                console.log(`[IAP] Purchase listener received update for: ${purchase.productId} (Status: ${purchase.transactionId ? 'transacting' : 'other'})`);
                try {
                    // Find the packageId for this productId
                    const packageId = Object.keys(PACKAGE_TO_APPLE_ID).find(
                        key => PACKAGE_TO_APPLE_ID[key] === purchase.productId
                    );

                    if (packageId) {
                        console.log(`[IAP] Auto-validating purchase for ${packageId}...`);
                        await this.validatePurchaseWithServer(purchase, packageId);
                    }
                } catch (error) {
                    console.error('[IAP] Failed to process purchase update:', error);
                }
            });

            // Check for any currently available purchases that might be pendings
            const availablePurchases = await Iap.getAvailablePurchases();
            if (availablePurchases && availablePurchases.length > 0) {
                console.log(`[IAP] Found ${availablePurchases.length} available purchases on init.`);
                for (const p of availablePurchases) {
                    const packageId = Object.keys(PACKAGE_TO_APPLE_ID).find(
                        key => PACKAGE_TO_APPLE_ID[key] === p.productId
                    );
                    if (packageId) {
                        console.log(`[IAP] Processing available purchase: ${packageId}`);
                        await this.validatePurchaseWithServer(p, packageId).catch(e => {
                            console.warn(`[IAP] Error auto-validating available purchase ${p.transactionId}:`, e);
                        });
                    }
                }
            }

            // Pre-fetch products
            await this.fetchProducts();
        } catch (error: any) {
            console.error('[IAP] Failed to initialize:', error);
            this.isConnected = false;
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Internal helper to validate a single purchase
     */
    private async validatePurchaseWithServer(purchase: any, packageId: string): Promise<{ success: boolean; message?: string }> {
        if (!Iap) return { success: false, message: 'IAP module not loaded' };
        if (!purchase.transactionId) return { success: false, message: 'Missing transaction ID' };

        // Deduplication: Skip if already processed in this session
        if (this.processedTransactions.has(purchase.transactionId)) {
            console.log(`[IAP] Transaction ${purchase.transactionId} already processed, skipping.`);
            return { success: true };
        }

        // Deduplication: Wait or skip if currently being processed
        if (this.processingTransactions.has(purchase.transactionId)) {
            console.log(`[IAP] Transaction ${purchase.transactionId} is currently being processed, waiting...`);
            // Minimal wait to avoid double-processing
            for (let i = 0; i < 10; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (this.processedTransactions.has(purchase.transactionId)) return { success: true };
                if (!this.processingTransactions.has(purchase.transactionId)) break;
            }
        }

        try {
            this.processingTransactions.add(purchase.transactionId);
            console.log(`[IAP] Validating purchase: ${purchase.transactionId} for ${packageId}`);

            console.log('[IAP] Fetching receipt for validation...');
            const receipt = await Iap.getReceiptIOS();

            if (!receipt) {
                throw new Error('Failed to get purchase receipt.');
            }

            const appleProductId = PACKAGE_TO_APPLE_ID[packageId];
            const validateReceipt = httpsCallable(functions, 'validateAppleReceipt');
            const result = await validateReceipt({
                receiptData: receipt,
                productId: appleProductId,
                transactionId: purchase.transactionId,
            });

            const data = result.data as any;

            if (!data.success) {
                throw new Error(data.error || 'Receipt validation failed.');
            }

            console.log(`[IAP] Finishing transaction: ${purchase.transactionId}`);
            await Iap.finishTransaction({ purchase, isConsumable: true });

            this.processedTransactions.add(purchase.transactionId);
            return { success: true };
        } catch (error: any) {
            console.error('[IAP] Validation error:', error);
            throw error;
        } finally {
            this.processingTransactions.delete(purchase.transactionId);
        }
    }

    /**
     * Fetch available products from the App Store with retry logic.
     */
    async fetchProducts(retries = 2): Promise<any[]> {
        if (Platform.OS !== 'ios' || !Iap) {
            return [];
        }

        if (this.isFetching && retries === 2) {
            console.log('[IAP] Fetch already in progress, skipping redundant call.');
            return this.products;
        }

        try {
            if (retries === 2) this.isFetching = true;

            console.log(`[IAP] Fetching products (Attempt ${3 - retries}). SKUs:`, JSON.stringify(IAP_PRODUCT_IDS));

            const result = await Iap.fetchProducts({
                skus: IAP_PRODUCT_IDS,
                type: 'in-app',
            });

            const products = result || [];

            if (products.length === 0 && retries > 0) {
                console.log(`[IAP] Zero products, retrying in 2s... (${retries} left)`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.fetchProducts(retries - 1);
            }

            this.products = products;

            if (products.length === 0) {
                console.warn('[IAP] App Store returned 0 products. Check agreements/metadata.');
            } else {
                console.log(`[IAP] Success: Fetched ${products.length} products.`);
            }
            return products;
        } catch (error: any) {
            console.error('[IAP] Fetch error:', error);
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.fetchProducts(retries - 1);
            }
            return [];
        } finally {
            if (retries === 0 || this.products.length > 0) {
                this.isFetching = false;
            }
        }
    }

    getProducts(): any[] {
        return this.products;
    }

    async purchaseTokens(packageId: string): Promise<{ success: boolean; message?: string }> {
        if (Platform.OS !== 'ios' || !Iap) {
            throw new Error('IAP is only available on iOS.');
        }

        const appleProductId = PACKAGE_TO_APPLE_ID[packageId];
        if (!appleProductId) {
            throw new Error(`Unknown package ID: ${packageId}`);
        }

        try {
            // Ensure ready
            if (!this.isConnected || this.products.length === 0) {
                console.log('[IAP] Not ready, initializing before purchase...');
                await this.initialize();
            }

            if (this.products.length === 0) {
                throw new Error("Could not retrieve products from the App Store.");
            }

            console.log(`[IAP] Requesting purchase for: ${appleProductId}`);

            const purchaseResult = await Iap.requestPurchase({
                request: { apple: { sku: appleProductId } },
                type: 'in-app',
            });

            const purchase = Array.isArray(purchaseResult) ? purchaseResult[0] : purchaseResult;

            if (!purchase) {
                return { success: false, message: 'canceled' };
            }

            console.log('[IAP] Purchase successful, performing validation...');
            return await this.validatePurchaseWithServer(purchase, packageId);
        } catch (error: any) {
            console.error('[IAP] Purchase error:', error);
            if (error.code === 'E_USER_CANCELLED' || error.message?.includes('cancel')) {
                return { success: false, message: 'canceled' };
            }
            throw new Error(this.getHumanReadableError(error));
        }
    }

    async restorePurchases(): Promise<void> {
        if (Platform.OS !== 'ios' || !Iap) return;

        try {
            console.log('[IAP] Restoring...');
            await Iap.restorePurchases();
            const purchases = await Iap.getAvailablePurchases();
            Alert.alert('Restore', purchases?.length ? `Restored ${purchases.length} items.` : 'No purchases found.');
        } catch (error: any) {
            Alert.alert('Error', 'Failed to restore purchases.');
        }
    }

    async disconnect(): Promise<void> {
        if (Platform.OS !== 'ios' || !Iap) return;
        try {
            if (this.purchaseSubscription) {
                this.purchaseSubscription.remove();
                this.purchaseSubscription = null;
            }
            await Iap.endConnection();
            this.isConnected = false;
            this.products = [];
        } catch (error) { }
    }

    private getHumanReadableError(error: any): string {
        const msg = error.message || '';
        if (msg.includes('cancel')) return 'Purchase was cancelled.';
        if (msg.includes('unavailable')) return 'This item is currently unavailable.';
        return msg || 'An unexpected error occurred.';
    }
}

export const iapService = new IAPService();
