import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    getDocs,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    increment,
    Timestamp
} from 'firebase/firestore';
import { db } from './config';
import { UserProfile, AuthProvider } from '../../types/profile.types';

export class UserService {
    private collectionName = 'users';

    private get usersCollection() {
        return collection(db, this.collectionName);
    }

    /**
     * Create or update user profile after login
     */
    async syncUserProfile(user: any, provider: AuthProvider, additionalData?: Partial<UserProfile>): Promise<UserProfile> {
        const userRef = doc(db, this.collectionName, user.uid);
        const snapshot = await getDoc(userRef);

        const now = new Date();

        if (!snapshot.exists()) {
            // New User Registration

            // Try to parse names
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
                role: user.email === 'pjmarket1316@gmail.com' ? 'admin' : 'user',
                emailVerified: user.emailVerified || false,
                phoneVerified: !!user.phoneNumber,
                accountStatus: 'active',

                // Token System
                tokenBalance: 50, // Welcome Bonus
                totalTokensPurchased: 0,
                totalTokensUsed: 0,

                // Defaults (can be overwritten by additionalData)
                notificationsEnabled: true,
                emailNotifications: true,
                smsNotifications: false,
                locationTrackingEnabled: false,
                theme: 'auto',
                profileVisibility: 'private',
                shareLocationWithEmployers: false,

                profileCompleted: false,

                // Spread additional data
                ...additionalData,

                createdAt: now,
                lastLoginAt: now,
                updatedAt: now,
            };

            await setDoc(userRef, {
                ...newProfile,
                createdAt: serverTimestamp(),
                lastLoginAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            return newProfile;
        } else {
            // Existing User Login
            const data = snapshot.data() as UserProfile;
            const updates: any = {
                lastLoginAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            // RECOVERY & ENFORCEMENT:
            const primaryAdmin = 'pjmarket1316@gmail.com';
            if (user.email === primaryAdmin) {
                if (data.role !== 'admin') {
                    updates.role = 'admin';
                }
            } else if (data.role === 'admin') {
                console.warn(`[Security] Demoting unauthorized admin account: ${user.email}`);
                updates.role = 'user';
            }

            await updateDoc(userRef, updates);

            return {
                ...data,
                ...updates,
                createdAt: (data.createdAt as any)?.toDate ? (data.createdAt as any).toDate() : new Date(),
                lastLoginAt: now,
                updatedAt: now,
            } as UserProfile;
        }
    }

    async getUserProfile(uid: string): Promise<UserProfile | null> {
        try {
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

    /**
     * Subscribe to real-time user profile updates
     */
    subscribeToUserProfile(uid: string, callback: (profile: UserProfile | null) => void): () => void {
        const userRef = doc(db, this.collectionName, uid);
        return onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                const profile = {
                    ...data,
                    createdAt: (data?.createdAt as any)?.toDate ? (data?.createdAt as any).toDate() : new Date(),
                    lastLoginAt: (data?.lastLoginAt as any)?.toDate ? (data?.lastLoginAt as any).toDate() : new Date(),
                    updatedAt: (data?.updatedAt as any)?.toDate ? (data?.updatedAt as any).toDate() : new Date(),
                } as UserProfile;
                callback(profile);
            } else {
                callback(null);
            }
        }, (error) => {
            // @ts-ignore
            if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
                return;
            }
            console.error("Error in user profile subscription:", error);
        });
    }

    async updateProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
        try {
            const userRef = doc(db, this.collectionName, uid);
            await updateDoc(userRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error updating user profile:", error);
            throw error;
        }
    }

    /**
     * Delete user profile data
     */
    async deleteAccount(uid: string): Promise<void> {
        try {
            const userRef = doc(db, this.collectionName, uid);
            // Soft delete
            await setDoc(userRef, {
                accountStatus: 'deleted',
                deletedAt: serverTimestamp(),
                uid: uid
            } as any);
        } catch (error) {
            console.error("Error deleting user account:", error);
            throw error;
        }
    }

    /**
     * Deduct tokens from user balance
     */
    async deductTokens(uid: string, amount: number): Promise<void> {
        const userRef = doc(db, this.collectionName, uid);
        await updateDoc(userRef, {
            tokenBalance: increment(-amount),
            totalTokensUsed: increment(amount),
            updatedAt: serverTimestamp()
        });
    }

    /**
     * Credit tokens to user balance
     */
    async creditTokens(uid: string, amount: number): Promise<void> {
        const userRef = doc(db, this.collectionName, uid);
        await updateDoc(userRef, {
            tokenBalance: increment(amount),
            totalTokensPurchased: increment(amount),
            updatedAt: serverTimestamp()
        });
    }

    /**
     * Get platform-wide statistics (Admin only)
     */
    async getPlatformStats(): Promise<any> {
        const usersSnapshot = await getDocs(this.usersCollection);
        const totalUsers = usersSnapshot.size;

        let totalTokensDistributed = 0;
        let totalTokensUsed = 0;
        let activeUsers30d = 0;
        const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));

        usersSnapshot.forEach(docSnap => {
            const data = docSnap.data() as UserProfile;
            totalTokensDistributed += (data.totalTokensPurchased || 0) + 50;
            totalTokensUsed += (data.totalTokensUsed || 0);

            const lastLogin = (data.lastLoginAt as any)?.toDate ? (data.lastLoginAt as any).toDate() : new Date(0);

            if (lastLogin > thirtyDaysAgo) {
                activeUsers30d++;
            }
        });

        return {
            totalUsers,
            activeUsers30d,
            totalTokensDistributed,
            totalTokensUsed,
            newUsersMonth: 0,
            tokenUtilizationRate: totalTokensDistributed > 0 ? totalTokensUsed / totalTokensDistributed : 0
        };
    }

    /**
     * Get aggregate statistics for a specific user
     */
    async getUserStats(uid: string): Promise<any> {
        try {
            const [analyses, apps, learning, activities] = await Promise.all([
                getDocs(query(collection(db, 'user_analyses'), where('userId', '==', uid))),
                getDocs(query(collection(db, 'user_applications'), where('userId', '==', uid))),
                getDocs(query(collection(db, 'user_learning'), where('userId', '==', uid))),
                getDocs(query(collection(db, 'activities'), where('uid', '==', uid)))
            ]);

            const analysisDocs = analyses.docs.map(d => d.data());
            const appDocs = apps.docs.map(d => d.data());
            const learningDocs = learning.docs.map(d => d.data());
            const activityDocs = activities.docs.map(d => d.data());

            return {
                resumesAnalyzed: analysisDocs.length,
                resumesOptimized: activityDocs.filter(d => d.type === 'resume_optimized').length,
                resumesReoptimized: activityDocs.filter(d => d.type === 'resume_reoptimization').length,
                prepGuides: appDocs.filter(d => d.prepGuide || (d.prepGuideHistory && d.prepGuideHistory.length > 0)).length,
                skillsLearned: learningDocs.filter(d => !d.archived).length,
                coverLetters: appDocs.filter(d => d.coverLetter).length
            };
        } catch (error) {
            console.error("Error fetching user stats:", error);
            return {
                resumesAnalyzed: 0,
                resumesOptimized: 0,
                resumesReoptimized: 0,
                prepGuides: 0,
                skillsLearned: 0,
                coverLetters: 0
            };
        }
    }

    /**
     * Get all users for admin management
     */
    async getAllUsers(): Promise<UserProfile[]> {
        const q = query(this.usersCollection, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                ...data,
                createdAt: (data.createdAt as any)?.toDate ? (data.createdAt as any).toDate() : new Date(),
                lastLoginAt: (data.lastLoginAt as any)?.toDate ? (data.lastLoginAt as any).toDate() : new Date(),
                updatedAt: (data.updatedAt as any)?.toDate ? (data.updatedAt as any).toDate() : new Date(),
            } as UserProfile;
        });
    }

    /**
     * Batch activate all users (Admin only)
     */
    async batchActivateUsers(): Promise<{ count: number }> {
        const users = await this.getAllUsers();
        let count = 0;

        for (const user of users) {
            const updates: any = {
                accountStatus: 'active',
                updatedAt: serverTimestamp()
            };

            if (user.tokenBalance < 50) {
                updates.tokenBalance = 50;
            }

            await this.updateProfile(user.uid, updates);
            count++;
        }

        return { count };
    }
}

export const userService = new UserService();
