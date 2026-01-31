import {
    collection,
    doc,
    addDoc,
    updateDoc,
    getDocs,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from './config';
import { LearningEntry, LearningPath, LearningStatus } from '../../types/learning.types';

export class LearningService {
    private collectionName = 'user_learning';

    private get learningCollection() {
        return collection(db, this.collectionName);
    }

    async addEntry(entry: Omit<LearningEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        try {
            const docRef = await addDoc(this.learningCollection, {
                ...entry,
                archived: false,
                completionDate: entry.completionDate ? Timestamp.fromDate(entry.completionDate) : null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding learning entry:', error);
            throw error;
        }
    }

    async archiveEntry(id: string): Promise<void> {
        return this.updateEntry(id, { archived: true });
    }

    async restoreEntry(id: string): Promise<void> {
        return this.updateEntry(id, { archived: false });
    }

    async updateEntry(id: string, updates: Partial<LearningEntry>): Promise<void> {
        try {
            const entryRef = doc(db, this.collectionName, id);
            const fsUpdates: any = {
                ...updates,
                updatedAt: serverTimestamp()
            };
            if (updates.completionDate) {
                fsUpdates.completionDate = Timestamp.fromDate(updates.completionDate);
            }
            await updateDoc(entryRef, fsUpdates);
        } catch (error) {
            console.error('Error updating learning entry:', error);
            throw error;
        }
    }

    async updateProgress(id: string, currentSlide: number): Promise<void> {
        return this.updateEntry(id, { currentSlide });
    }

    async generateTrainingContent(id: string, skill: string, position: string, company: string, userId: string): Promise<{ title: string; points: { title: string; description: string }[] }[]> {
        console.log(`[LearningService] Requesting training content from Cloud Function for ${skill}`);

        try {
            const generateFn = httpsCallable(functions, 'generateTrainingSlideshow');
            const result = await generateFn({
                entryId: id,
                skill,
                position,
                company
            });

            const data = result.data as any;
            if (!data.success || !data.slides) {
                throw new Error('Failed to generate training content from server');
            }

            return data.slides;
        } catch (error) {
            console.error('Error calling generateTrainingSlideshow:', error);
            throw error;
        }
    }

    async getEntryBySkill(userId: string, skillName: string): Promise<LearningEntry | null> {
        try {
            const q = query(
                this.learningCollection,
                where('userId', '==', userId),
                where('skillName', '==', skillName)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) return null;

            const docSnap = snapshot.docs[0];
            return this.mapDocToEntry(docSnap);
        } catch (error) {
            console.error('Error fetching learning entry:', error);
            return null;
        }
    }

    async findExistingEntry(userId: string, skillName: string, jobTitle: string, companyName: string): Promise<LearningEntry | null> {
        try {
            const q = query(
                this.learningCollection,
                where('userId', '==', userId),
                where('skillName', '==', skillName),
                where('jobTitle', '==', jobTitle),
                where('companyName', '==', companyName),
                where('archived', '==', false)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) return null;

            return this.mapDocToEntry(snapshot.docs[0]);
        } catch (error) {
            console.error('Error finding existing learning entry:', error);
            return null;
        }
    }

    subscribeToEntries(userId: string, callback: (entries: LearningEntry[]) => void): () => void {
        const q = query(
            this.learningCollection,
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const entries = snapshot.docs.map(docSnap => this.mapDocToEntry(docSnap));
            callback(entries);
        });
    }

    private mapDocToEntry(docSnap: any): LearningEntry {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            ...data,
            completionDate: (data.completionDate as any)?.toDate?.() || null,
            createdAt: (data.createdAt as any)?.toDate ? (data.createdAt as any).toDate() : new Date(),
            updatedAt: (data.updatedAt as any)?.toDate ? (data.updatedAt as any).toDate() : new Date()
        } as LearningEntry;
    }
}

export const learningService = new LearningService();
