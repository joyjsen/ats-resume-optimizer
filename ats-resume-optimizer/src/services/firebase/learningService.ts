import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    onSnapshot,
    Timestamp,
    orderBy
} from 'firebase/firestore';
import { db, auth } from './config';
import { LearningEntry, LearningPath, LearningStatus } from '../../types/learning.types';
import { openai, safeOpenAICall } from '../../config/ai';

export class LearningService {
    private collectionName = 'user_learning';

    async addEntry(entry: Omit<LearningEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        try {
            const docRef = await addDoc(collection(db, this.collectionName), {
                ...entry,
                archived: false,
                completionDate: entry.completionDate ? Timestamp.fromDate(entry.completionDate) : null,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
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
                updatedAt: Timestamp.now()
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

    async generateTrainingContent(id: string, skill: string, position: string, company: string): Promise<{ title: string; points: { title: string; description: string }[] }[]> {
        const prompt = `You are an expert technical trainer. Create a comprehensive training slideshow for a candidate learning a specific skill for a specific job at a specific company.

SKILL: ${skill}
POSITION: ${position}
COMPANY: ${company}

Requirements:
- Generate 10-15 slides.
- Content must be curated specifically for the skill in the context of this job and company.
- Format the output as a JSON object with a "slides" array.
- Each slide object must have:
  - "title": A short header for the slide.
  - "points": An array of objects, where each object has:
    - "title": A concise name of the sub-point/concept.
    - "description": A rudimentary level explanation of this point (1-3 sentences).
- Avoid overly generic text. Provide practical, job-relevant explanations.

Respond ONLY with the JSON object.`;

        try {
            const response = await safeOpenAICall(() => openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are an expert technical trainer.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 4000,
                temperature: 0.7,
                response_format: { type: 'json_object' }
            }), 'Training Generation');

            const content = response.choices[0]?.message?.content;
            if (!content) throw new Error('No content from AI');

            const parsed = JSON.parse(content);
            const slides = (parsed.slides || []) as { title: string; points: { title: string; description: string }[] }[];

            await this.updateEntry(id, {
                slides,
                totalSlides: slides.length,
                currentSlide: 0
            });

            return slides;
        } catch (error) {
            console.error('Error generating training content:', error);
            throw error;
        }
    }

    async getEntryBySkill(userId: string, skillName: string): Promise<LearningEntry | null> {
        try {
            const q = query(
                collection(db, this.collectionName),
                where('userId', '==', userId),
                where('skillName', '==', skillName)
            );
            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;

            const doc = snapshot.docs[0];
            return this.mapDocToEntry(doc);
        } catch (error) {
            console.error('Error fetching learning entry:', error);
            return null;
        }
    }

    async findExistingEntry(userId: string, skillName: string, jobTitle: string, companyName: string): Promise<LearningEntry | null> {
        try {
            const q = query(
                collection(db, this.collectionName),
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
            collection(db, this.collectionName),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const entries = snapshot.docs.map(doc => this.mapDocToEntry(doc));
            callback(entries);
        });
    }

    private mapDocToEntry(doc: any): LearningEntry {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            completionDate: data.completionDate?.toDate(),
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate()
        } as LearningEntry;
    }
}

export const learningService = new LearningService();
