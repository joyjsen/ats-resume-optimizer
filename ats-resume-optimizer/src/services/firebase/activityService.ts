import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    runTransaction
} from 'firebase/firestore';
import { db, auth } from './config';
import { UserActivity, ActivityType, ACTIVITY_COSTS, ActivityStatus, AIProvider } from '../../types/profile.types';

export class ActivityService {
    private collectionName = 'activities';

    private get activitiesCollection() {
        return collection(db, this.collectionName);
    }

    /**
     * Log a user activity and optionally deduct tokens in a transaction
     * @param skipTokenDeduction - Set to true if tokens were already deducted server-side (e.g., by Cloud Function)
     */
    async logActivity(params: {
        type: ActivityType,
        description: string,
        resourceId?: string,
        resourceName?: string,
        aiProvider?: AIProvider,
        contextData?: any,
        platform?: 'ios' | 'android' | 'web',
        targetUserId?: string,
        skipTokenDeduction?: boolean
    }): Promise<string> {
        const user = auth.currentUser;
        if (!user) throw new Error("User not authenticated");

        const targetUid = params.targetUserId || user.uid;

        // If skipTokenDeduction is true, don't deduct tokens (already done server-side)
        const cost = params.skipTokenDeduction ? 0 : (ACTIVITY_COSTS[params.type] || 0);

        return await runTransaction(db, async (transaction) => {
            const userRef = doc(db, 'users', targetUid);
            const userSnap = await transaction.get(userRef);

            if (!userSnap.exists()) throw new Error("User profile not found");
            const userData = userSnap.data();

            if (!userData) throw new Error("User data is empty");

            // For admin_adjustment (adding tokens), cost is 0 or negative (to add tokens)
            // But ACTIVITY_COSTS usually defines usage cost.
            // If type is admin_adjustment, we might want to skip balance check or handle it differently.
            // However, the caller usually updates balance separately? 
            // WAIT - the previous implementation DEDUCTED tokens inside this transaction:
            // const newBalance = userData.tokenBalance - cost;
            // If I am ADDING tokens, cost should be negative? Or should I just not use cost here if I use creditTokens?
            // Actually, best practice: do it ALL in here. 

            // If it's an adjustment, we might want to pass 'amount' in contextData and handle it.
            // But to minimize changes, let's keep logic:
            // If params.type is admin_adjustment, we assume cost is 0 (defined in constant?) or we handle it.
            // Let's assume cost is 0 for admin_adjustment in ACTIVITY_COSTS.

            // NOTE: The previous code updated the balance: `const newBalance = userData.tokenBalance - cost;`
            // If I want to CREDIT tokens, I should perhaps update that logic.
            // BUT `userService.creditTokens` exists.
            // If I use `logActivity` just for LOGGING, cost should be 0.
            // If I use it for transaction, it implies deduction.

            // Let's stick to: logActivity logs it. If type is admin_adjustment, cost is 0. 
            // The actual balance update happens via userService.creditTokens? 
            // NO, `creditTokens` is separate.
            // IF I want atomic, I should do it here. 
            // But let's look at `userService.ts` again. `creditTokens` is simple `updateDoc`.

            // Decision: `logActivity` is primarily for SPENDING. 
            // But for `admin_adjustment`, we just want to log.
            // So if cost is 0, newBalance = oldBalance.
            // But if we want to trace the balance change, we should probably update it here.
            // However, `userService.creditTokens` updates it.
            // Let's just update `logActivity` to support `targetUserId`, and let the Caller handle the balance update if it's a credit.
            // Or better, if I am admin granting tokens, I call `creditTokens` (which updates balance) AND `logActivity` (which logs it).
            // `logActivity` calculates `newBalance` based on `userData.tokenBalance - cost`.
            // If I call `creditTokens` FIRST, then `logActivity`, `logActivity` will read the NEW balance.
            // So:
            // 1. UserService.creditTokens(uid, 50) -> Balance 50 -> 100
            // 2. ActivityService.logActivity(..., cost=0) -> Read 100. Write 100.

            // This works.

            if ((userData.tokenBalance || 0) < cost) {
                throw new Error("Insufficient token balance");
            }

            // 1. Create activity record
            const activityRef = doc(this.activitiesCollection);
            const activityId = activityRef.id;

            const newBalance = userData.tokenBalance - cost;

            const activityData: any = {
                uid: targetUid,
                type: params.type,
                description: params.description,
                tokensUsed: cost,
                tokenBalance: newBalance,
                aiProvider: params.aiProvider || 'none',
                status: 'completed',
                platform: params.platform || 'ios',
                timestamp: serverTimestamp()
            };

            // Remove undefined fields
            if (params.resourceId !== undefined) activityData.resourceId = params.resourceId;
            if (params.resourceName !== undefined) activityData.resourceName = params.resourceName;
            if (params.contextData !== undefined) activityData.contextData = params.contextData;

            transaction.set(activityRef, activityData);

            // 2. Update user balance
            transaction.update(userRef, {
                tokenBalance: newBalance,
                totalTokensUsed: (userData.totalTokensUsed || 0) + cost,
                updatedAt: serverTimestamp()
            });

            return activityId;
        });
    }

    /**
     * Fetch recent activity for current user
     */
    async getRecentActivity(limitCount: number = 5): Promise<UserActivity[]> {
        const user = auth.currentUser;
        if (!user) return [];

        const q = query(
            this.activitiesCollection,
            where('uid', '==', user.uid),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(docSnap => ({
            activityId: docSnap.id,
            ...docSnap.data(),
            timestamp: (docSnap.data().timestamp as any)?.toDate?.() || new Date()
        })) as UserActivity[];
    }

    /**
     * Subscribe to activities (real-time)
     */
    subscribeToActivities(callback: (activities: UserActivity[]) => void, limitCount: number = 20) {
        const user = auth.currentUser;
        if (!user) return () => { };

        const q = query(
            this.activitiesCollection,
            where('uid', '==', user.uid),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );

        return onSnapshot(q, (snapshot) => {
            const activities = snapshot.docs.map(docSnap => ({
                activityId: docSnap.id,
                ...docSnap.data(),
                timestamp: (docSnap.data().timestamp as any)?.toDate?.() || new Date()
            })) as UserActivity[];
            callback(activities);
        }, (error) => {
            // @ts-ignore
            if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
                return;
            }
            console.error('Error in activities subscription:', error);
        });
    }

    /**
     * Get all activities across platform (Admin only)
     */
    async getAllActivities(limitCount: number = 50): Promise<UserActivity[]> {
        const q = query(
            this.activitiesCollection,
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(docSnap => ({
            activityId: docSnap.id,
            ...docSnap.data(),
            timestamp: (docSnap.data().timestamp as any)?.toDate?.() || new Date()
        })) as UserActivity[];
    }

    /**
     * Get activities for a specific user (Admin only)
     */
    async getUserActivitiesAdmin(uid: string, limitCount: number = 50): Promise<UserActivity[]> {
        const q = query(
            this.activitiesCollection,
            where('uid', '==', uid),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(docSnap => ({
            activityId: docSnap.id,
            ...docSnap.data(),
            timestamp: (docSnap.data().timestamp as any)?.toDate?.() || new Date()
        })) as UserActivity[];
    }

    /**
     * Get purchase history for a specific user
     */
    async getPurchaseHistory(): Promise<UserActivity[]> {
        const user = auth.currentUser;
        if (!user) return [];

        const q = query(
            this.activitiesCollection,
            where('uid', '==', user.uid),
            where('type', '==', 'token_purchase'),
            orderBy('timestamp', 'desc')
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(docSnap => ({
            activityId: docSnap.id,
            ...docSnap.data(),
            timestamp: (docSnap.data().timestamp as any)?.toDate?.() || new Date()
        })) as UserActivity[];
    }
}

export const activityService = new ActivityService();
