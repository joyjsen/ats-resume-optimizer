import { Platform, Alert } from 'react-native';
import { getFirebaseFunctions } from '../firebase/config';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

let Iap: any = null;
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

    async initialize(): Promise<void> {
        if (Platform.OS !== 'ios' || !Iap || this.isInitializing) return;
        try {
            this.isInitializing = true;
            await Iap.initConnection();
            this.isConnected = true;

            if (this.purchaseSubscription) this.purchaseSubscription.remove();
            this.purchaseSubscription = Iap.purchaseUpdatedListener(async (purchase: any) => {
                try {
                    const packageId = Object.keys(PACKAGE_TO_APPLE_ID).find(k => PACKAGE_TO_APPLE_ID[k] === purchase.productId);
                    if (packageId) await this.validatePurchaseWithServer(purchase, packageId);
                } catch (e: any) {
                    // Don't let listener errors become unhandled rejections
                    console.warn('[IAP] Listener validation failed (non-fatal):', e.message);
                }
            });

            const available = await Iap.getAvailablePurchases();
            if (available?.length > 0) {
                for (const p of available) {
                    const packageId = Object.keys(PACKAGE_TO_APPLE_ID).find(k => PACKAGE_TO_APPLE_ID[k] === p.productId);
                    if (packageId) await this.validatePurchaseWithServer(p, packageId).catch(() => { });
                }
            }
            await this.fetchProducts();
        } catch (error) {
            console.error('[IAP] Failed to initialize:', error);
            this.isConnected = false;
        } finally {
            this.isInitializing = false;
        }
    }

    private async validatePurchaseWithServer(purchase: any, packageId: string): Promise<{ success: boolean; message?: string }> {
        if (!Iap || !purchase.transactionId) return { success: false, message: 'Invalid transaction' };
        if (this.processedTransactions.has(purchase.transactionId)) return { success: true };
        
        // Prevent concurrent validations for the same transaction
        if (this.processingTransactions.has(purchase.transactionId)) {
            console.log(`[IAP] Transaction ${purchase.transactionId} is already being validated.`);
            return { success: true, message: 'processing' };
        }

        try {
            this.processingTransactions.add(purchase.transactionId);
            const receipt = await Iap.getReceiptIOS().catch(() => null);
            if (!receipt) {
                console.warn('[IAP] No receipt found during validation');
                throw new Error('unable to generate receipt');
            }

            const { httpsCallable } = await import('firebase/functions');
            const functions = await getFirebaseFunctions();
            const result = await httpsCallable(functions, 'validateAppleReceipt')({
                receiptData: receipt,
                productId: PACKAGE_TO_APPLE_ID[packageId],
                transactionId: purchase.transactionId,
            });

            const data = result.data as any;
            if (!data.success) throw new Error(data.error || 'Validation failed');

            await Iap.finishTransaction({ purchase, isConsumable: true });
            this.processedTransactions.add(purchase.transactionId);



            return { success: true };
        } catch (error: any) {
            const errorMsg = (error.message || '').toLowerCase();
            // "Product not found in receipt" means the transaction is stale/already consumed.
            // Finish it so iOS stops re-delivering it on every app launch.
            if (errorMsg.includes('product not found')) {
                console.warn(`[IAP] Stale transaction ${purchase.transactionId} — finishing to clear queue.`);
                try {
                    await Iap.finishTransaction({ purchase, isConsumable: true });
                    this.processedTransactions.add(purchase.transactionId);
                } catch (finishErr) {
                    // Best-effort cleanup
                }
                return { success: false, message: 'Product not found in receipt (stale transaction cleared)' };
            }
            console.error('[IAP] Validation error:', error);
            throw error;
        } finally {
            this.processingTransactions.delete(purchase.transactionId);
        }
    }

    async fetchProducts(retries = 2): Promise<any[]> {
        if (Platform.OS !== 'ios' || !Iap) return [];
        if (this.isFetching && retries === 2) return this.products;
        try {
            if (retries === 2) this.isFetching = true;
            const result = await Iap.fetchProducts({ skus: IAP_PRODUCT_IDS, type: 'in-app' });
            this.products = result || [];
            if (this.products.length === 0 && retries > 0) {
                await new Promise(r => setTimeout(r, 2000));
                return this.fetchProducts(retries - 1);
            }
            return this.products;
        } catch (error) {
            if (retries > 0) {
                await new Promise(r => setTimeout(r, 2000));
                return this.fetchProducts(retries - 1);
            }
            return [];
        } finally {
            if (retries === 0 || this.products.length > 0) this.isFetching = false;
        }
    }

    getProducts(): any[] { return this.products; }

    async purchaseTokens(packageId: string): Promise<{ success: boolean; message?: string }> {
        if (Platform.OS !== 'ios' || !Iap) throw new Error('iOS only');
        try {
            if (!this.isConnected || this.products.length === 0) await this.initialize();
            const purchaseResult = await Iap.requestPurchase({ request: { apple: { sku: PACKAGE_TO_APPLE_ID[packageId] } }, type: 'in-app' });
            const purchase = Array.isArray(purchaseResult) ? purchaseResult[0] : purchaseResult;
            if (!purchase) return { success: false, message: 'canceled' };
            return await this.validatePurchaseWithServer(purchase, packageId);
        } catch (error: any) {
            const errorMsg = (error.message || '').toLowerCase();
            if (error.code === 'E_USER_CANCELLED' || errorMsg.includes('cancel')) {
                return { success: false, message: 'canceled' };
            }
            // expo-iap often throws these errors if there's a pending transaction or race condition, 
            // but the purchaseUpdatedListener usually catches and processes the transaction successfully.
            if (errorMsg.includes('unable to complete request') || errorMsg.includes('unable to generate receipt')) {
                console.warn('[IAP] requestPurchase threw a known error, but the background listener might have succeeded:', error);
                throw new Error("Purchase is processing. It may take a moment to reflect in your balance. Please check your profile shortly.");
            }
            throw error;
        }
    }

    async restorePurchases(): Promise<void> {
        if (Platform.OS !== 'ios' || !Iap) return;
        try {
            await Iap.restorePurchases();
            const purchases = await Iap.getAvailablePurchases();
            Alert.alert('Restore', purchases?.length ? `Restored ${purchases.length} items.` : 'No purchases found.');
        } catch (error) { Alert.alert('Error', 'Failed to restore purchases.'); }
    }

    async disconnect(): Promise<void> {
        if (Platform.OS !== 'ios' || !Iap) return;
        try {
            if (this.purchaseSubscription) { this.purchaseSubscription.remove(); this.purchaseSubscription = null; }
            await Iap.endConnection();
            this.isConnected = false;
        } catch (error) { }
    }
}

export const iapService = new IAPService();
