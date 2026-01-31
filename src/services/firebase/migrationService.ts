import {
    collection,
    doc,
    getDocs,
    query,
    where,
    writeBatch,
    Timestamp
} from 'firebase/firestore';
import { db, auth } from './config';

export class MigrationService {
    /**
     * Migrate all data from 'anonymous_user' to current authenticated user
     */
    async migrateAnonymousData(): Promise<{ success: boolean; count: number }> {
        const user = auth.currentUser;
        if (!user || user.email !== 'pjmarket1316@gmail.com') {
            console.warn("Migration attempted by non-primary admin. Blocked.");
            return { success: false, count: 0 };
        }

        const targetUid = user.uid;
        const anonymousId = 'anonymous_user';
        let totalUpdated = 0;

        try {
            const batch = writeBatch(db);
            const collectionsToMigrate = [
                { name: 'user_analyses', idField: 'userId' },
                { name: 'activities', idField: 'uid' },
                { name: 'user_applications', idField: 'userId' },
                { name: 'user_learning', idField: 'userId' }
            ];

            for (const collInfo of collectionsToMigrate) {
                const q = query(
                    collection(db, collInfo.name),
                    where(collInfo.idField, '==', anonymousId)
                );
                const snapshot = await getDocs(q);

                console.log(`Migration: Found ${snapshot.size} docs in ${collInfo.name}`);

                snapshot.forEach((document) => {
                    const docRef = doc(db, collInfo.name, document.id);
                    batch.update(docRef, { [collInfo.idField]: targetUid });
                    totalUpdated++;
                });
            }

            if (totalUpdated > 0) {
                await batch.commit();
                console.log(`Migration: Successfully updated ${totalUpdated} records to ${targetUid}`);
            }

            return { success: true, count: totalUpdated };
        } catch (error) {
            console.error("Migration failed:", error);
            return { success: false, count: totalUpdated };
        }
    }

    /**
     * Fix prepGuideHistory status for existing applications
     * Updates history entries to match the current prepGuide.status
     */
    async fixPrepGuideHistoryStatus(): Promise<{ success: boolean; count: number }> {
        const user = auth.currentUser;
        if (!user) {
            console.warn("Migration requires authenticated user.");
            return { success: false, count: 0 };
        }

        let totalUpdated = 0;

        try {
            // Get all applications for current user
            const q = query(
                collection(db, 'user_applications'),
                where('userId', '==', user.uid)
            );
            const snapshot = await getDocs(q);

            console.log(`[Migration] Found ${snapshot.size} applications to check`);

            const batch = writeBatch(db);
            let batchCount = 0;

            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                const prepGuide = data.prepGuide;
                const prepGuideHistory = data.prepGuideHistory;

                // Skip if no prepGuide or no history
                if (!prepGuide || !prepGuideHistory || prepGuideHistory.length === 0) {
                    continue;
                }

                // Check if any history entries need fixing
                let needsUpdate = false;
                const updatedHistory = prepGuideHistory.map((entry: any, index: number) => {
                    // For the latest entry, sync with current prepGuide status
                    if (index === prepGuideHistory.length - 1) {
                        if (prepGuide.status === 'completed' && entry.status !== 'completed') {
                            needsUpdate = true;
                            return {
                                ...entry,
                                status: 'completed',
                                generatedAt: prepGuide.generatedAt || prepGuide.completedAt || Timestamp.now()
                            };
                        } else if ((prepGuide.status === 'failed' || prepGuide.status === 'cancelled') && entry.status !== 'failed') {
                            needsUpdate = true;
                            return {
                                ...entry,
                                status: 'failed'
                            };
                        }
                    }
                    return entry;
                });

                if (needsUpdate) {
                    const docRef = doc(db, 'user_applications', docSnap.id);
                    batch.update(docRef, { prepGuideHistory: updatedHistory });
                    batchCount++;
                    totalUpdated++;
                    console.log(`[Migration] Updating history for app ${docSnap.id}: ${prepGuide.status}`);
                }

                // Commit batch every 400 documents (Firestore limit is 500)
                if (batchCount >= 400) {
                    await batch.commit();
                    console.log(`[Migration] Committed batch of ${batchCount} updates`);
                    batchCount = 0;
                }
            }

            // Commit remaining updates
            if (batchCount > 0) {
                await batch.commit();
                console.log(`[Migration] Committed final batch of ${batchCount} updates`);
            }

            console.log(`[Migration] Successfully fixed ${totalUpdated} prepGuideHistory entries`);
            return { success: true, count: totalUpdated };
        } catch (error) {
            console.error("[Migration] fixPrepGuideHistoryStatus failed:", error);
            return { success: false, count: totalUpdated };
        }
    }
}

export const migrationService = new MigrationService();
