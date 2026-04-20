import { getFirestoreDb, getFirebaseAuth, getFirebaseFunctions } from './config';
import { ENV } from '../../config/env';
import { UserProfile, AuthProvider } from '../../types/profile.types';

export class UserService {
    private collectionName = 'users';
    private WELCOME_BONUS = 110;

    private async getUsersCollection() {
        const { collection } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        return collection(db, this.collectionName);
    }

    async syncUserProfile(user: any, provider: AuthProvider, additionalData?: Partial<UserProfile>): Promise<UserProfile> {
        const { doc, getDoc, serverTimestamp, setDoc, updateDoc } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        const userRef = doc(db, this.collectionName, user.uid);
        const snapshot = await getDoc(userRef);
        const now = new Date();

        if (!snapshot.exists()) {
            let firstName = '';
            let lastName = '';
            if (user.displayName) {
                const parts = user.displayName.split(' ');
                firstName = parts[0];
                lastName = parts.slice(1).join(' ');
            }

            const newProfile: UserProfile = {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || 'User',
                firstName: firstName,
                lastName: lastName,
                photoURL: user.photoURL || '',
                phoneNumber: user.phoneNumber || '',
                provider: provider,
                role: user.email === ENV.ADMIN_EMAIL ? 'admin' : 'user',
                emailVerified: user.emailVerified || false,
                phoneVerified: !!user.phoneNumber,
                accountStatus: 'active',
                createdAt: now,
                tokenBalance: this.WELCOME_BONUS,
                totalTokensPurchased: 0,
                totalTokensUsed: 0,
                notificationsEnabled: true,
                emailNotifications: true,
                smsNotifications: false,
                locationTrackingEnabled: false,
                theme: 'auto',
                profileVisibility: 'private',
                shareLocationWithEmployers: false,
                profileCompleted: false,
                ...additionalData,
                updatedAt: now,
                lastLoginAt: now,
            };

            await setDoc(userRef, {
                ...newProfile,
                createdAt: serverTimestamp(),
                lastLoginAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            return newProfile;
        } else {
            const data = snapshot.data() as UserProfile;
            const updates: any = {
                lastLoginAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            if (user.email && user.email !== data.email) updates.email = user.email;
            if (user.photoURL && user.photoURL !== data.photoURL) updates.photoURL = user.photoURL;
            if (user.displayName && !data.displayName) updates.displayName = user.displayName;

            // Merge additionalData for fields that are missing (e.g. Apple sign-in name, phone verified state)
            if (additionalData) {
                if (additionalData.firstName && !data.firstName) updates.firstName = additionalData.firstName;
                if (additionalData.lastName && !data.lastName) updates.lastName = additionalData.lastName;
                if (additionalData.displayName && (!data.displayName || data.displayName === 'User')) {
                    updates.displayName = additionalData.displayName;
                }
                if (additionalData.email && !data.email) updates.email = additionalData.email;
                if (additionalData.phoneNumber && !data.phoneNumber) updates.phoneNumber = additionalData.phoneNumber;
                if (additionalData.phoneVerified && !data.phoneVerified) updates.phoneVerified = additionalData.phoneVerified;
            }

            if (user.email === ENV.ADMIN_EMAIL) {
                if (data.role !== 'admin') updates.role = 'admin';
            } else if (data.role === 'admin') {
                updates.role = 'user';
            }

            // AUTO-REACTIVATE REMOVED: Deleted accounts remain 'deleted' to block future logins.

            await updateDoc(userRef, updates);

            return {
                ...data,
                ...updates,
                uid: user.uid,
                createdAt: (data.createdAt as any)?.toDate ? (data.createdAt as any).toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt as any || now)),
                lastLoginAt: now,
                updatedAt: now,
            };
        }
    }

    async checkEmailExists(email: string): Promise<{ exists: boolean; status?: string; displayName?: string; provider?: string; uid?: string } | null> {
        try {
            const { httpsCallable } = await import('firebase/functions');
            const functions = await getFirebaseFunctions();
            const checkUserProvider = httpsCallable(functions, 'checkUserProvider');
            const result = await checkUserProvider({ email });
            return result.data as any;
        } catch (error) {
            console.error('Error checking email existence:', error);
            throw error;
        }
    }

    async checkPhoneExists(phone: string): Promise<{ exists: boolean; status?: string; displayName?: string; provider?: string; uid?: string } | null> {
        try {
            const { httpsCallable } = await import('firebase/functions');
            const functions = await getFirebaseFunctions();
            const checkPhoneProvider = httpsCallable(functions, 'checkPhoneProvider');
            const result = await checkPhoneProvider({ phone });
            return result.data as any;
        } catch (error) {
            console.error('Error checking phone existence:', error);
            throw error;
        }
    }

    async getUserProfile(uid: string): Promise<UserProfile | null> {
        try {
            const { doc, getDoc } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const userRef = doc(db, this.collectionName, uid);
            const snapshot = await getDoc(userRef);
            if (!snapshot.exists()) return null;
            const data = snapshot.data();
            return {
                ...data,
                createdAt: (data?.createdAt as any)?.toDate ? (data?.createdAt as any).toDate() : new Date(),
                lastLoginAt: (data?.lastLoginAt as any)?.toDate ? (data?.lastLoginAt as any).toDate() : new Date(),
                updatedAt: (data?.updatedAt as any)?.toDate ? (data?.updatedAt as any).toDate() : new Date(),
            } as UserProfile;
        } catch (error) {
            console.error("Error fetching user profile:", error);
            return null;
        }
    }

    async subscribeToUserProfile(uid: string, callback: (profile: UserProfile | null) => void): Promise<() => void> {
        let unsub: (() => void) | undefined;
        const init = async () => {
            const { doc, onSnapshot } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const userRef = doc(db, this.collectionName, uid);
            unsub = onSnapshot(userRef, (snapshot: any) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    callback({
                        ...data,
                        createdAt: (data?.createdAt as any)?.toDate ? (data?.createdAt as any).toDate() : new Date(),
                        lastLoginAt: (data?.lastLoginAt as any)?.toDate ? (data?.lastLoginAt as any).toDate() : new Date(),
                        updatedAt: (data?.updatedAt as any)?.toDate ? (data?.updatedAt as any).toDate() : new Date(),
                    } as UserProfile);
                } else {
                    callback(null);
                }
            }, (error: any) => {
                if (error.code !== 'permission-denied') console.error("Error in user profile sub:", error);
            });
        };
        const promise = init();
        return () => {
            promise.then(() => unsub?.());
        };
    }

    async updateProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
        try {
            const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const userRef = doc(db, this.collectionName, uid);
            await updateDoc(userRef, { ...updates, updatedAt: serverTimestamp() });
        } catch (error) {
            console.error("Error updating profile:", error);
            throw error;
        }
    }

    async archiveAndSoftDelete(uid: string, reason: string): Promise<void> {
        try {
            const { doc, getDoc, collection, query, where, getDocs, serverTimestamp, updateDoc, setDoc } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const userRef = doc(db, this.collectionName, uid);
            const userSnapshot = await getDoc(userRef);
            if (!userSnapshot.exists()) throw new Error("User not found.");

            const userData = userSnapshot.data() as UserProfile;
            let totalSpent = 0;
            let historyCount = 0;

            try {
                const activitiesSnapshot = await getDocs(query(collection(db, 'activities'), where('uid', '==', uid), where('type', '==', 'token_purchase')));
                activitiesSnapshot.forEach((docSnap: any) => {
                    if (docSnap.data().contextData?.amount) totalSpent += Number(docSnap.data().contextData.amount);
                });
            } catch (e) { }

            try {
                const historySnapshot = await getDocs(query(collection(db, 'user_analyses'), where('userId', '==', uid)));
                historyCount = historySnapshot.size;
            } catch (e) { }

            await setDoc(doc(db, 'deleted_accounts', uid), {
                uid,
                email: userData.email,
                displayName: userData.displayName,
                deletedAt: serverTimestamp(),
                reason,
                totalSpent,
                historyCount,
                tokenBalanceAtDeletion: userData.tokenBalance || 0,
                fullProfile: userData
            });

            await updateDoc(userRef, { accountStatus: 'deleted', deletedAt: serverTimestamp(), reason });
        } catch (error) {
            console.error("Error archiving user:", error);
            throw error;
        }
    }

    async deleteAccount(uid: string): Promise<void> {
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        await updateDoc(doc(db, this.collectionName, uid), { accountStatus: 'deleted', deletedAt: serverTimestamp() });
    }

    async hardDeleteAccount(uid: string): Promise<void> {
        const { doc, deleteDoc } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        await deleteDoc(doc(db, this.collectionName, uid));
    }

    async restoreDeletedAccount(uid: string): Promise<void> {
        try {
            const { doc, getDoc, updateDoc, serverTimestamp, setDoc, deleteDoc } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const archiveRef = doc(db, 'deleted_accounts', uid);
            const archiveSnap = await getDoc(archiveRef);
            if (!archiveSnap.exists()) throw new Error("Archived account not found.");

            const archiveData = archiveSnap.data();
            const fullProfile = archiveData.fullProfile || {};
            const userRef = doc(db, this.collectionName, uid);
            const userSnap = await getDoc(userRef);

            const updates = {
                ...fullProfile,
                uid,
                accountStatus: 'active',
                restoredAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            if (userSnap.exists()) {
                await updateDoc(userRef, { ...updates, deletedAt: null, reason: null });
            } else {
                await setDoc(userRef, { ...updates, createdAt: fullProfile.createdAt || serverTimestamp() });
            }
            await deleteDoc(archiveRef);
        } catch (error) {
            console.error("Error restoring account:", error);
            throw error;
        }
    }

    async deductTokens(uid: string, amount: number): Promise<void> {
        const { doc, updateDoc, increment, serverTimestamp } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        await updateDoc(doc(db, this.collectionName, uid), {
            tokenBalance: increment(-amount),
            totalTokensUsed: increment(amount),
            updatedAt: serverTimestamp()
        });
    }

    async creditTokens(uid: string, amount: number): Promise<void> {
        const { doc, updateDoc, increment, serverTimestamp } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        await updateDoc(doc(db, this.collectionName, uid), {
            tokenBalance: increment(amount),
            totalTokensPurchased: increment(amount),
            updatedAt: serverTimestamp()
        });
    }

    async getPlatformStats(): Promise<any> {
        const { getDocs } = await import('firebase/firestore');
        const usersColl = await this.getUsersCollection();
        const usersSnapshot = await getDocs(usersColl);
        let totalTokensDistributed = 0;
        let totalTokensUsed = 0;
        let activeUsers30d = 0;
        const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));

        usersSnapshot.forEach((docSnap: any) => {
            const data = docSnap.data() as UserProfile;
            totalTokensDistributed += (data.totalTokensPurchased || 0) + this.WELCOME_BONUS;
            totalTokensUsed += (data.totalTokensUsed || 0);
            const lastLogin = (data.lastLoginAt as any)?.toDate?.() || new Date(0);
            if (lastLogin > thirtyDaysAgo) activeUsers30d++;
        });

        return {
            totalUsers: usersSnapshot.size,
            activeUsers30d,
            totalTokensDistributed,
            totalTokensUsed,
            tokenUtilizationRate: totalTokensDistributed > 0 ? totalTokensUsed / totalTokensDistributed : 0
        };
    }

    async getUserStats(uid: string): Promise<any> {
        try {
            const { getDocs, query, collection, where } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const [analyses, apps, learning, activities] = await Promise.all([
                getDocs(query(collection(db, 'user_analyses'), where('userId', '==', uid))),
                getDocs(query(collection(db, 'user_applications'), where('userId', '==', uid))),
                getDocs(query(collection(db, 'user_learning'), where('userId', '==', uid))),
                getDocs(query(collection(db, 'activities'), where('uid', '==', uid)))
            ]);

            return {
                resumesAnalyzed: analyses.size,
                resumesOptimized: activities.docs.filter((d: any) => d.data().type === 'resume_optimized').length,
                resumesReoptimized: activities.docs.filter((d: any) => d.data().type === 'resume_reoptimization').length,
                prepGuides: apps.docs.filter((d: any) => d.data().prepGuide || d.data().prepGuideHistory?.length > 0).length,
                skillsLearned: learning.docs.filter((d: any) => !d.data().archived).length,
                coverLetters: apps.docs.filter((d: any) => d.data().coverLetter).length
            };
        } catch (error) {
            console.error("Error fetching user stats:", error);
            return { resumesAnalyzed: 0, resumesOptimized: 0, resumesReoptimized: 0, prepGuides: 0, skillsLearned: 0, coverLetters: 0 };
        }
    }

    async getAllUsers(): Promise<UserProfile[]> {
        const { query, orderBy, getDocs } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        const usersColl = await this.getUsersCollection();
        const q = query(usersColl, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        return snapshot.docs.map((docSnap: any) => {
            const data = docSnap.data();
            return {
                ...data,
                createdAt: (data.createdAt as any)?.toDate ? (data.createdAt as any).toDate() : new Date(),
                lastLoginAt: (data.lastLoginAt as any)?.toDate ? (data.lastLoginAt as any).toDate() : new Date(),
                updatedAt: (data.updatedAt as any)?.toDate ? (data.updatedAt as any).toDate() : new Date(),
            } as UserProfile;
        }).filter(user => user.accountStatus !== 'deleted');
    }

    async batchActivateUsers(): Promise<{ count: number }> {
        const users = await this.getAllUsers();
        let count = 0;
        const { serverTimestamp } = await import('firebase/firestore');
        for (const user of users) {
            const updates: any = { accountStatus: 'active', updatedAt: serverTimestamp() };
            if (user.tokenBalance < this.WELCOME_BONUS) updates.tokenBalance = this.WELCOME_BONUS;
            await this.updateProfile(user.uid, updates);
            count++;
        }
        return { count };
    }
}

export const userService = new UserService();
