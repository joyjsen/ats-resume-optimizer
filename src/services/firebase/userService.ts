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
    Timestamp,
    deleteDoc
} from 'firebase/firestore';
import { db, auth } from './config';
import { ENV } from '../../config/env';
import { UserProfile, AuthProvider } from '../../types/profile.types';

export class UserService {
    private collectionName = 'users';
    private WELCOME_BONUS = 110;

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
                role: user.email === ENV.ADMIN_EMAIL ? 'admin' : 'user',
                emailVerified: user.emailVerified || false,
                phoneVerified: !!user.phoneNumber,
                accountStatus: 'active',

                createdAt: now,
                // Token System
                tokenBalance: this.WELCOME_BONUS, // Welcome Bonus
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
            // Existing User Login
            const data = snapshot.data() as UserProfile;
            const updates: any = {
                lastLoginAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            // RECOVERY & ENFORCEMENT:
            if (user.email === ENV.ADMIN_EMAIL) {
                if (data.role !== 'admin') {
                    updates.role = 'admin';
                }
            } else if (data.role === 'admin') {
                console.warn(`[Security] Demoting unauthorized admin account: ${user.email}`);
                updates.role = 'user';
            }

            await updateDoc(userRef, updates);

            const mergedProfile: UserProfile = {
                ...data,
                ...updates,
                uid: user.uid, // Ensure UID is always present
                createdAt: (data.createdAt as any)?.toDate ? (data.createdAt as any).toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt as any || now)),
                lastLoginAt: now,
                updatedAt: now,
            };

            return mergedProfile;
        }
    }

    /**
     * Check if an email already exists in the database
     * Returns the account status if found, null if not found
     */
    async checkEmailExists(email: string): Promise<{ exists: boolean; status?: string; displayName?: string; provider?: string; uid?: string } | null> {
        try {
            const emailLower = email.toLowerCase();

            // Check main users collection
            const usersQuery = query(this.usersCollection, where('email', '==', emailLower));
            const usersSnapshot = await getDocs(usersQuery);

            if (!usersSnapshot.empty) {
                const userData = usersSnapshot.docs[0].data();
                return {
                    exists: true,
                    status: userData.accountStatus || 'active',
                    displayName: userData.displayName,
                    provider: userData.provider || 'email',
                    uid: userData.uid
                };
            }

            // Also check deleted_accounts collection
            const deletedQuery = query(collection(db, 'deleted_accounts'), where('email', '==', emailLower));
            const deletedSnapshot = await getDocs(deletedQuery);

            if (!deletedSnapshot.empty) {
                const deletedData = deletedSnapshot.docs[0].data();
                return {
                    exists: true,
                    status: 'deleted',
                    displayName: deletedData.displayName,
                    provider: deletedData.provider || 'unknown',
                    uid: deletedData.uid
                };
            }

            return { exists: false };
        } catch (error) {
            console.error('Error checking email existence:', error);
            return null;
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
     * Archive user data and soft-delete the account
     */
    async archiveAndSoftDelete(uid: string, reason: string): Promise<void> {
        try {
            // Debug: Check current auth state
            const currentUser = auth.currentUser;
            console.log(`[Archive] Starting archive for uid: ${uid}`);
            console.log(`[Archive] Current auth user: ${currentUser?.uid}`);
            console.log(`[Archive] Auth UIDs match: ${currentUser?.uid === uid}`);

            const userRef = doc(db, this.collectionName, uid);
            console.log(`[Archive] Step 1: Fetching user profile...`);
            const userSnapshot = await getDoc(userRef);

            if (!userSnapshot.exists()) {
                throw new Error("User profile not found for archiving.");
            }

            const userData = userSnapshot.data() as UserProfile;
            console.log(`[Archive] Step 1 complete: Got user data for ${userData.email}`);

            // 1. Calculate Total Spent from activities (optional - don't fail if this doesn't work)
            let totalSpent = 0;
            let historyCount = 0;

            try {
                console.log(`[Archive] Step 2: Fetching activities...`);
                const activitiesSnapshot = await getDocs(
                    query(collection(db, 'activities'), where('uid', '==', uid), where('type', '==', 'token_purchase'))
                );
                activitiesSnapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.contextData?.amount) {
                        totalSpent += Number(data.contextData.amount);
                    }
                });
                console.log(`[Archive] Step 2 complete: Total spent = ${totalSpent}`);
            } catch (e) {
                console.warn("[Archive] Step 2 failed (non-critical):", e);
            }

            // 2. Fetch User History count (optional - don't fail if this doesn't work)
            try {
                console.log(`[Archive] Step 3: Fetching history...`);
                const historySnapshot = await getDocs(
                    query(collection(db, 'user_analyses'), where('userId', '==', uid))
                );
                historyCount = historySnapshot.size;
                console.log(`[Archive] Step 3 complete: History count = ${historyCount}`);
            } catch (e) {
                console.warn("[Archive] Step 3 failed (non-critical):", e);
            }

            // 3. Create Archive Document (essential - will fail if permissions are wrong)
            console.log(`[Archive] Step 4: Creating archive document at deleted_accounts/${uid}...`);
            const archiveRef = doc(collection(db, 'deleted_accounts'), uid);
            await setDoc(archiveRef, {
                uid: uid,
                email: userData.email,
                displayName: userData.displayName,
                provider: userData.provider,
                createdAt: userData.createdAt,
                deletedAt: serverTimestamp(),
                reason: reason,
                totalSpent: totalSpent,
                historyCount: historyCount,
                tokenBalanceAtDeletion: userData.tokenBalance || 0,
                fullProfile: userData, // Keep a snapshot for admin
            });
            console.log(`[Archive] Step 4 complete: Archive document created`);

            // 4. Soft delete the original user document
            console.log(`[Archive] Step 5: Updating user status to deleted...`);
            await updateDoc(userRef, {
                accountStatus: 'deleted',
                deletedAt: serverTimestamp(),
                reason: reason
            });

            console.log(`[Archive] Successfully archived and soft-deleted user ${uid}`);
        } catch (error) {
            console.error("Error archiving and deleting account:", error);
            throw error;
        }
    }

    /**
     * Delete user profile data (legacy - kept for compatibility or forced deletion)
     */
    async deleteAccount(uid: string): Promise<void> {
        try {
            const userRef = doc(db, this.collectionName, uid);
            await updateDoc(userRef, {
                accountStatus: 'deleted',
                deletedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error deleting user account:", error);
            throw error;
        }
    }

    /**
     * Restore a deleted user account from the archive.
     * Restores their profile with preserved token balance and marks profile as completed
     * so they bypass onboarding.
     */
    async restoreDeletedAccount(uid: string): Promise<void> {
        try {
            console.log(`[Restore] Starting restore for uid: ${uid}`);

            // 1. Get the archived data
            const archiveRef = doc(db, 'deleted_accounts', uid);
            const archiveSnap = await getDoc(archiveRef);

            if (!archiveSnap.exists()) {
                throw new Error("Archived account not found.");
            }

            const archiveData = archiveSnap.data();
            const fullProfile = archiveData.fullProfile || {};

            // 2. Restore the user document with preserved data
            const userRef = doc(db, this.collectionName, uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                // User document still exists (soft-deleted), update it
                await updateDoc(userRef, {
                    ...fullProfile,
                    uid: uid,
                    accountStatus: 'active',
                    profileCompleted: true, // Ensure they bypass onboarding
                    tokenBalance: archiveData.tokenBalanceAtDeletion || fullProfile.tokenBalance || 0,
                    restoredAt: serverTimestamp(),
                    restoredBy: 'admin',
                    deletedAt: null,
                    reason: null,
                    updatedAt: serverTimestamp(),
                });
            } else {
                // User document was hard-deleted, recreate it
                await setDoc(userRef, {
                    ...fullProfile,
                    uid: uid,
                    accountStatus: 'active',
                    profileCompleted: true,
                    tokenBalance: archiveData.tokenBalanceAtDeletion || fullProfile.tokenBalance || 0,
                    restoredAt: serverTimestamp(),
                    restoredBy: 'admin',
                    createdAt: fullProfile.createdAt || serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            }

            // 3. Delete the archive document so they no longer appear in "Deleted Users"
            await deleteDoc(archiveRef);

            console.log(`[Restore] Successfully restored user ${uid}`);
        } catch (error) {
            console.error("Error restoring deleted account:", error);
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
            totalTokensDistributed += (data.totalTokensPurchased || 0) + this.WELCOME_BONUS;
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
     * Excludes deleted users - they appear in Deleted Users section instead
     */
    async getAllUsers(): Promise<UserProfile[]> {
        const q = query(this.usersCollection, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const allUsers = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                ...data,
                createdAt: (data.createdAt as any)?.toDate ? (data.createdAt as any).toDate() : new Date(),
                lastLoginAt: (data.lastLoginAt as any)?.toDate ? (data.lastLoginAt as any).toDate() : new Date(),
                updatedAt: (data.updatedAt as any)?.toDate ? (data.updatedAt as any).toDate() : new Date(),
            } as UserProfile;
        });

        // Debug: Log user statuses
        console.log('[getAllUsers] Total users from Firestore:', allUsers.length);
        allUsers.forEach(u => {
            console.log(`[getAllUsers] ${u.displayName}: accountStatus = "${u.accountStatus}"`);
        });

        // Filter out deleted users - they appear in Deleted Users section
        const activeUsers = allUsers.filter(user => user.accountStatus !== 'deleted');
        console.log('[getAllUsers] After filtering deleted:', activeUsers.length);

        return activeUsers;
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

            // Reset tokens to initial amount if below
            if (user.tokenBalance < this.WELCOME_BONUS) {
                updates.tokenBalance = this.WELCOME_BONUS;
            }

            await this.updateProfile(user.uid, updates);
            count++;
        }

        return { count };
    }
}

export const userService = new UserService();
