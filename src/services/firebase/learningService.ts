import { getFirestoreDb, getFirebaseFunctions } from './config';
import { LearningEntry } from '../../types/learning.types';

export class LearningService {
    private collectionName = 'user_learning';

    async addEntry(entry: Omit<LearningEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        try {
            const { addDoc, collection, serverTimestamp, Timestamp } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const docRef = await addDoc(collection(db, this.collectionName), {
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

    async updateEntry(id: string, updates: Partial<LearningEntry>): Promise<void> {
        try {
            const { doc, updateDoc, serverTimestamp, Timestamp } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const entryRef = doc(db, this.collectionName, id);
            const fsUpdates: any = { ...updates, updatedAt: serverTimestamp() };
            if (updates.completionDate) fsUpdates.completionDate = Timestamp.fromDate(updates.completionDate);
            await updateDoc(entryRef, fsUpdates);
        } catch (error) {
            console.error('Error updating learning entry:', error);
            throw error;
        }
    }

    async generateTrainingContent(id: string, skill: string, position: string, company: string): Promise<any> {
        try {
            const { httpsCallable } = await import('firebase/functions');
            const functions = await getFirebaseFunctions();
            const result = await httpsCallable(functions, 'generateTrainingSlideshow')({ entryId: id, skill, position, company });
            const data = result.data as any;
            if (!data.success || !data.slides) throw new Error('Failed to generate training content');
            return data.slides;
        } catch (error) {
            console.error('Error calling generateTrainingSlideshow:', error);
            throw error;
        }
    }

    async getEntryBySkill(userId: string, skillName: string): Promise<LearningEntry | null> {
        try {
            const { query, where, collection, getDocs } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const q = query(collection(db, this.collectionName), where('userId', '==', userId), where('skillName', '==', skillName));
            const snapshot = await getDocs(q);
            return snapshot.empty ? null : this.mapDocToEntry(snapshot.docs[0]);
        } catch (error) {
            console.error('Error fetching learning entry:', error);
            return null;
        }
    }

    async updateProgress(id: string, slideIndex: number): Promise<void> {
        try {
            const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const entryRef = doc(db, this.collectionName, id);
            await updateDoc(entryRef, {
                currentSlide: slideIndex,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating learning progress:', error);
            throw error;
        }
    }

    subscribeToEntries(userId: string, callback: (entries: LearningEntry[]) => void): any {
        let unsub: (() => void) | undefined;
        const init = async () => {
            const { query, where, collection, orderBy, onSnapshot } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const q = query(collection(db, this.collectionName), where('userId', '==', userId), orderBy('createdAt', 'desc'));
            unsub = onSnapshot(q, (snapshot: any) => {
                callback(snapshot.docs.map((docSnap: any) => this.mapDocToEntry(docSnap)));
            });
        };
        const promise = init();
        return () => { promise.then(() => unsub?.()); };
    }

    private mapDocToEntry(docSnap: any): LearningEntry {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            ...data,
            completionDate: (data.completionDate as any)?.toDate?.() || null,
            createdAt: (data.createdAt as any)?.toDate?.() || new Date(),
            updatedAt: (data.updatedAt as any)?.toDate?.() || new Date()
        } as LearningEntry;
    }
}

export const learningService = new LearningService();
