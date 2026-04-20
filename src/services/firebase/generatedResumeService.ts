import { getFirestoreDb } from './config';
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { ParsedResume } from '../../types/resume.types';

export interface GeneratedResume {
    id: string;
    userId: string;
    name: string;
    parsedData: ParsedResume;
    createdAt: Date;
    updatedAt: Date;
}

export const generatedResumeService = {
    async saveGeneratedResume(userId: string, name: string, parsedData: ParsedResume, existingId?: string): Promise<string> {
        if (!userId) throw new Error("User ID is required to save generated resume");

        const db = await getFirestoreDb();
        const collectionRef = collection(db, 'users', userId, 'generated_resumes');
        const docRef = existingId ? doc(collectionRef, existingId) : doc(collectionRef);
        
        const payload: any = {
            id: docRef.id,
            userId,
            name,
            parsedData: JSON.parse(JSON.stringify(parsedData)),
            updatedAt: serverTimestamp()
        };
        if (!existingId) payload.createdAt = serverTimestamp();

        await setDoc(docRef, payload, { merge: true });

        return docRef.id;
    },

    async fetchGeneratedResumes(userId: string): Promise<GeneratedResume[]> {
        if (!userId) return [];

        const db = await getFirestoreDb();
        const q = query(
            collection(db, 'users', userId, 'generated_resumes')
        );

        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                userId: data.userId,
                name: data.name,
                parsedData: data.parsedData as ParsedResume,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date()
            } as GeneratedResume;
        });
        
        // Sort locally to prevent requiring explicit composite/subcollection indices
        return docs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    },

    async deleteGeneratedResume(userId: string, resumeId: string): Promise<void> {
        if (!userId || !resumeId) throw new Error("Missing required parameters for deletion");
        const db = await getFirestoreDb();
        await deleteDoc(doc(db, 'users', userId, 'generated_resumes', resumeId));
    }
};
