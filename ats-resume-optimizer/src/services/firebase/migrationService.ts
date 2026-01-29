import {
    collection,
    doc,
    getDocs,
    query,
    where,
    writeBatch
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
}

export const migrationService = new MigrationService();
