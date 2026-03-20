import { getFirestoreDb, getFirebaseAuth } from './config';
import { UserActivity, ActivityType, ACTIVITY_COSTS, ActivityStatus, AIProvider } from '../../types/profile.types';

export class ActivityService {
    private collectionName = 'activities';

    private async getActivitiesCollection() {
        const { collection } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        return collection(db, this.collectionName);
    }

    /**
     * Log a user activity and optionally deduct tokens in a transaction
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
        skipTokenDeduction?: boolean,
        tokensUsed?: number
    }): Promise<string> {
        const { doc, runTransaction, serverTimestamp } = await import('firebase/firestore');
        const auth = await getFirebaseAuth();
        const db = await getFirestoreDb();
        const user = auth.currentUser;
        if (!user) throw new Error("User not authenticated");

        const targetUid = params.targetUserId || user.uid;
        const cost = params.skipTokenDeduction ? 0 : (ACTIVITY_COSTS[params.type] || 0);

        return await runTransaction(db, async (transaction: any) => {
            const userRef = doc(db, 'users', targetUid);
            const userSnap = await transaction.get(userRef);

            if (!userSnap.exists()) throw new Error("User profile not found");
            const userData = userSnap.data();

            if ((userData.tokenBalance || 0) < cost) {
                throw new Error("Insufficient token balance");
            }

            const activitiesColl = await this.getActivitiesCollection();
            const activityRef = doc(activitiesColl);
            const activityId = activityRef.id;
            const newBalance = userData.tokenBalance - cost;

            const activityData: any = {
                uid: targetUid,
                type: params.type,
                description: params.description,
                tokensUsed: params.tokensUsed !== undefined ? params.tokensUsed : cost,
                tokenBalance: newBalance,
                aiProvider: params.aiProvider || 'none',
                status: 'completed',
                platform: params.platform || 'web',
                timestamp: serverTimestamp()
            };

            if (params.resourceId !== undefined) activityData.resourceId = params.resourceId;
            if (params.resourceName !== undefined) activityData.resourceName = params.resourceName;
            if (params.contextData !== undefined) activityData.contextData = params.contextData;

            transaction.set(activityRef, activityData);
            transaction.update(userRef, {
                tokenBalance: newBalance,
                totalTokensUsed: (userData.totalTokensUsed || 0) + cost,
                updatedAt: serverTimestamp()
            });

            return activityId;
        });
    }

    async updateActivity(activityId: string, updates: Partial<UserActivity>): Promise<void> {
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        const docRef = doc(db, this.collectionName, activityId);

        const cleanUpdates = { ...updates };
        // @ts-ignore
        delete cleanUpdates.activityId;
        // @ts-ignore
        delete cleanUpdates.uid;
        // @ts-ignore
        delete cleanUpdates.timestamp;

        await updateDoc(docRef, { ...cleanUpdates, updatedAt: serverTimestamp() });
    }

    async getRecentActivity(limitCount: number = 5): Promise<UserActivity[]> {
        const { query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
        const auth = await getFirebaseAuth();
        const user = auth.currentUser;
        if (!user) return [];

        const activitiesColl = await this.getActivitiesCollection();
        const q = query(activitiesColl, where('uid', '==', user.uid), orderBy('timestamp', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);

        return snapshot.docs.map((docSnap: any) => ({
            activityId: docSnap.id,
            ...docSnap.data(),
            timestamp: (docSnap.data().timestamp as any)?.toDate?.() || new Date()
        })) as UserActivity[];
    }

    async subscribeToActivities(callback: (activities: UserActivity[]) => void, limitCount: number = 20): Promise<() => void> {
        let unsub: (() => void) | undefined;
        const init = async () => {
            const { query, where, orderBy, limit, onSnapshot } = await import('firebase/firestore');
            const auth = await getFirebaseAuth();
            const user = auth.currentUser;
            if (!user) return;

            const activitiesColl = await this.getActivitiesCollection();
            const q = query(activitiesColl, where('uid', '==', user.uid), orderBy('timestamp', 'desc'), limit(limitCount));

            unsub = onSnapshot(q, (snapshot: any) => {
                const activities = snapshot.docs.map((docSnap: any) => ({
                    activityId: docSnap.id,
                    ...docSnap.data(),
                    timestamp: (docSnap.data().timestamp as any)?.toDate?.() || new Date()
                })) as UserActivity[];
                callback(activities);
            }, (error: any) => {
                if (error.code !== 'permission-denied') console.error('Error in activities sub:', error);
            });
        };
        const promise = init();
        return () => {
            promise.then(() => unsub?.());
        };
    }

    async getAllActivities(limitCount: number = 50): Promise<UserActivity[]> {
        const { query, orderBy, limit, getDocs } = await import('firebase/firestore');
        const activitiesColl = await this.getActivitiesCollection();
        const q = query(activitiesColl, orderBy('timestamp', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);

        return snapshot.docs.map((docSnap: any) => ({
            activityId: docSnap.id,
            ...docSnap.data(),
            timestamp: (docSnap.data().timestamp as any)?.toDate?.() || new Date()
        })) as UserActivity[];
    }

    async getUserActivitiesAdmin(uid: string, limitCount: number = 50): Promise<UserActivity[]> {
        const { query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
        const activitiesColl = await this.getActivitiesCollection();
        const q = query(activitiesColl, where('uid', '==', uid), orderBy('timestamp', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);

        return snapshot.docs.map((docSnap: any) => ({
            activityId: docSnap.id,
            ...docSnap.data(),
            timestamp: (docSnap.data().timestamp as any)?.toDate?.() || new Date()
        })) as UserActivity[];
    }

    async getPurchaseHistory(): Promise<UserActivity[]> {
        const { query, where, orderBy, getDocs } = await import('firebase/firestore');
        const auth = await getFirebaseAuth();
        const user = auth.currentUser;
        if (!user) return [];

        const activitiesColl = await this.getActivitiesCollection();
        const q = query(activitiesColl, where('uid', '==', user.uid), where('type', '==', 'token_purchase'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);

        return snapshot.docs.map((docSnap: any) => ({
            activityId: docSnap.id,
            ...docSnap.data(),
            timestamp: (docSnap.data().timestamp as any)?.toDate?.() || new Date()
        })) as UserActivity[];
    }

    async deleteAllUserActivities(uid: string): Promise<void> {
        const { query, where, getDocs, doc, deleteDoc } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        const activitiesColl = await this.getActivitiesCollection();
        const q = query(activitiesColl, where('uid', '==', uid));
        const snapshot = await getDocs(q);

        const deletePromises = snapshot.docs.map((activityDoc: any) => deleteDoc(doc(db, this.collectionName, activityDoc.id)));
        await Promise.all(deletePromises);
    }
}

export const activityService = new ActivityService();
