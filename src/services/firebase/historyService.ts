import { getFirestoreDb, getFirebaseAuth } from './config';
import { SavedAnalysis } from '../../types/history.types';
import { AnalysisResult } from '../../types/analysis.types';
import { JobPosting } from '../../types/job.types';
import { ParsedResume } from '../../types/resume.types';

export class HistoryService {
    private collectionName = 'user_analyses';

    private async getAnalysesCollection() {
        const { collection } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        return collection(db, this.collectionName);
    }

    async saveAnalysis(
        analysis: AnalysisResult,
        job: JobPosting,
        resume?: ParsedResume,
        optimizedResume?: ParsedResume,
        changes?: any[],
        jobHash?: string,
        resumeHash?: string,
        isDraft: boolean = false
    ): Promise<string> {
        try {
            const { addDoc, serverTimestamp } = await import('firebase/firestore');
            const auth = await getFirebaseAuth();
            const user = auth.currentUser;
            if (!user) throw new Error("User must be authenticated");

            const docData: any = {
                userId: user.uid,
                jobTitle: job.title,
                company: job.company,
                atsScore: analysis.atsScore,
                action: analysis.recommendation.action,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                analysisData: JSON.stringify(analysis),
                jobData: JSON.stringify(job),
                resumeData: JSON.stringify(resume || {}),
                jobHash: jobHash || null,
                resumeHash: resumeHash || null,
            };

            if (optimizedResume && changes) {
                if (isDraft) {
                    docData.draftOptimizedResumeData = JSON.stringify(optimizedResume);
                    docData.draftChangesData = JSON.stringify(changes);
                } else {
                    docData.optimizedResumeData = JSON.stringify(optimizedResume);
                    docData.changesData = JSON.stringify(changes);
                }
            }

            const coll = await this.getAnalysesCollection();
            const docRef = await addDoc(coll, docData);

            try {
                const { activityService } = await import('./activityService');
                await activityService.logActivity({
                    type: 'gap_analysis',
                    description: `Analyzed the resume for ${job.title} at ${job.company}`,
                    resourceId: docRef.id,
                    skipTokenDeduction: true
                });
            } catch (e) { }

            return docRef.id;
        } catch (error) {
            console.error('Error saving analysis history:', error);
            throw error;
        }
    }

    async updateAnalysis(
        docId: string,
        analysis: AnalysisResult,
        job: JobPosting,
        resume?: ParsedResume,
        optimizedResume?: ParsedResume,
        changes?: any[],
        isDraft: boolean = false,
        draftAtsScore?: number,
        draftMatchAnalysis?: any
    ): Promise<boolean> {
        try {
            const { doc, updateDoc, getDoc, serverTimestamp } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const docData: any = { updatedAt: serverTimestamp() };

            if (!isDraft) {
                docData.atsScore = analysis.atsScore;
                docData.analysisData = JSON.stringify(analysis);
            }

            if (optimizedResume && changes) {
                if (isDraft) {
                    docData.draftOptimizedResumeData = JSON.stringify(optimizedResume);
                    docData.draftChangesData = JSON.stringify(changes);
                    if (draftAtsScore) docData.draftAtsScore = draftAtsScore;
                    if (draftMatchAnalysis) docData.draftMatchAnalysis = JSON.stringify(draftMatchAnalysis);
                } else {
                    docData.optimizedResumeData = JSON.stringify(optimizedResume);
                    docData.changesData = JSON.stringify(changes);
                }
            }

            let newStatus = isDraft ? 'draft_ready' : (optimizedResume ? 'optimized' : '');
            if (newStatus) docData.analysisStatus = newStatus;

            const docRef = doc(db, this.collectionName, docId);
            await updateDoc(docRef, docData);

            try {
                const snap = await getDoc(docRef);
                if (snap.exists() && snap.data()?.applicationId) {
                    const appId = snap.data().applicationId;
                    const appUpdate: any = { updatedAt: serverTimestamp() };
                    if (newStatus) appUpdate.analysisStatus = newStatus;
                    await updateDoc(doc(db, 'user_applications', appId), appUpdate);
                }
            } catch (e) { }

            return true;
        } catch (error) {
            console.error('Error updating analysis history:', error);
            return false;
        }
    }

    async promoteDraftToFinal(docId: string): Promise<boolean> {
        try {
            const { doc, getDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const docRef = doc(db, this.collectionName, docId);
            const snapshot = await getDoc(docRef);

            if (!snapshot.exists()) return false;
            const data = snapshot.data();
            if (!data?.draftOptimizedResumeData) return false;

            await updateDoc(docRef, {
                optimizedResumeData: data.draftOptimizedResumeData,
                changesData: data.draftChangesData,
                optimizedMatchAnalysis: data.draftMatchAnalysis || null,
                draftOptimizedResumeData: null,
                draftChangesData: null,
                draftAtsScore: null,
                draftMatchAnalysis: null,
                updatedAt: serverTimestamp(),
                ...(data.draftAtsScore ? { atsScore: data.draftAtsScore } : {})
            });

            try {
                const { applicationService } = await import('./applicationService');
                const analysisForApp = {
                    id: docId,
                    userId: data.userId,
                    jobTitle: data.jobTitle,
                    company: data.company,
                    atsScore: data.draftAtsScore || data.atsScore,
                    jobData: typeof data.jobData === 'string' ? JSON.parse(data.jobData) : data.jobData,
                } as SavedAnalysis;
                const appId = await applicationService.createApplicationFromAnalysis(analysisForApp);
                if (appId) await updateDoc(docRef, { applicationId: appId });
            } catch (e) { }

            return true;
        } catch (error) {
            console.error('Error promoting draft:', error);
            return false;
        }
    }

    async discardDraft(docId: string): Promise<boolean> {
        try {
            const { doc, getDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const docRef = doc(db, this.collectionName, docId);
            const snapshot = await getDoc(docRef);
            if (!snapshot.exists()) return false;
            const data = snapshot.data();

            const newStatus = data?.optimizedResumeData ? 'optimized' : 'pending_resume_update';
            await updateDoc(docRef, {
                draftOptimizedResumeData: null,
                draftChangesData: null,
                draftAtsScore: null,
                draftMatchAnalysis: null,
                updatedAt: serverTimestamp(),
                analysisStatus: newStatus
            });

            if (data?.applicationId) {
                await updateDoc(doc(db, 'user_applications', data.applicationId), { analysisStatus: newStatus, updatedAt: serverTimestamp() });
            }

            return true;
        } catch (error) {
            console.error('Error discarding draft:', error);
            return false;
        }
    }

    async deleteAnalysis(docId: string): Promise<boolean> {
        try {
            const { doc, getDoc, deleteDoc, query, where, collection, getDocs, writeBatch } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const docRef = doc(db, this.collectionName, docId);
            const snapshot = await getDoc(docRef);
            let description = 'Deleted analysis';

            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data?.jobTitle && data?.company) description = `Deleted analysis for ${data.jobTitle} at ${data.company}`;
                if (data.applicationId) await deleteDoc(doc(db, 'user_applications', data.applicationId)).catch(() => { });

                const appsSnap = await getDocs(query(collection(db, 'user_applications'), where('userId', '==', data.userId), where('analysisId', '==', docId)));
                const batch = writeBatch(db);
                appsSnap.forEach(d => batch.delete(d.ref));
                if (!appsSnap.empty) await batch.commit();
            }

            await deleteDoc(docRef);

            try {
                const { activityService } = await import('./activityService');
                await activityService.logActivity({ type: 'analysis_deleted', description, resourceId: docId });
            } catch (e) { }

            return true;
        } catch (error) {
            console.error('Error deleting analysis:', error);
            return false;
        }
    }

    async findExistingAnalysis(jobHash: string, resumeHash: string): Promise<SavedAnalysis | null> {
        try {
            const { query, where, getDocs } = await import('firebase/firestore');
            const auth = await getFirebaseAuth();
            if (!auth.currentUser) return null;

            const coll = await this.getAnalysesCollection();
            const q = query(coll, where('userId', '==', auth.currentUser.uid), where('jobHash', '==', jobHash), where('resumeHash', '==', resumeHash));
            const snap = await getDocs(q);

            if (!snap.empty) return this.mapDocToAnalysis(snap.docs[0]);
            return null;
        } catch (error) {
            console.error('Error finding existing analysis:', error);
            return null;
        }
    }

    async findExistingAnalysisByDetails(jobTitle: string, company: string, resumeHash: string, jobUrl?: string): Promise<SavedAnalysis | null> {
        try {
            const { query, where, getDocs } = await import('firebase/firestore');
            const auth = await getFirebaseAuth();
            if (!auth.currentUser) return null;

            const coll = await this.getAnalysesCollection();
            const q = query(
                coll,
                where('userId', '==', auth.currentUser.uid),
                where('jobTitle', '==', jobTitle),
                where('company', '==', company),
                where('resumeHash', '==', resumeHash)
            );
            
            const snap = await getDocs(q);
            if (!snap.empty) {
                 const docs = snap.docs.map(doc => this.mapDocToAnalysis(doc));
                 docs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                 
                 if (jobUrl) {
                     const urlMatch = docs.find(d => d.jobData?.url === jobUrl);
                     if (urlMatch) return urlMatch;
                 }
                 return docs[0];
            }
            return null;
        } catch (error) {
            console.error('Error finding existing analysis by details:', error);
            return null;
        }
    }

    async getUserHistory(userId?: string): Promise<SavedAnalysis[]> {
        try {
            const { query, where, getDocs } = await import('firebase/firestore');
            const auth = await getFirebaseAuth();
            const targetUserId = userId || auth.currentUser?.uid;
            if (!targetUserId) return [];

            const coll = await this.getAnalysesCollection();
            const q = query(coll, where('userId', '==', targetUserId));
            const snap = await getDocs(q);

            return snap.docs.map(docSnap => this.mapDocToAnalysis(docSnap)).sort((a, b) => {
                const timeA = a.updatedAt ? a.updatedAt.getTime() : a.createdAt.getTime();
                const timeB = b.updatedAt ? b.updatedAt.getTime() : b.createdAt.getTime();
                return timeB - timeA;
            });
        } catch (error) {
            console.error('Error fetching history:', error);
            return [];
        }
    }

    async getAnalysisById(docId: string): Promise<SavedAnalysis | null> {
        try {
            const { doc, getDoc } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const snap = await getDoc(doc(db, this.collectionName, docId));
            return snap.exists() ? this.mapDocToAnalysis(snap) : null;
        } catch (error) {
            console.error("Error getting analysis by ID:", error);
            return null;
        }
    }

    subscribeToUserHistory(callback: (history: SavedAnalysis[]) => void): () => void {
        let unsub: (() => void) | undefined;
        const init = async () => {
            const { query, where, onSnapshot } = await import('firebase/firestore');
            const auth = await getFirebaseAuth();
            if (!auth.currentUser) return;

            const coll = await this.getAnalysesCollection();
            const q = query(coll, where('userId', '==', auth.currentUser.uid));

            unsub = onSnapshot(q, (snapshot) => {
                const fetchedHistory = snapshot.docs.map(docSnap => this.mapDocToAnalysis(docSnap));
                const sorted = fetchedHistory.sort((a, b) => {
                    const timeA = a.updatedAt ? a.updatedAt.getTime() : a.createdAt.getTime();
                    const timeB = b.updatedAt ? b.updatedAt.getTime() : b.createdAt.getTime();
                    return timeB - timeA;
                });
                callback(sorted);
            }, (error) => {
                const errorCode = (error as any)?.code || '';
                if (errorCode !== 'permission-denied' && !errorCode.includes('permission')) {
                    console.error("Error in history subscription:", error);
                }
            });
        };
        const promise = init();
        return () => { promise.then(() => unsub?.()); };
    }

    subscribeToAnalysis(docId: string, callback: (analysis: SavedAnalysis | null) => void): () => void {
        let unsub: (() => void) | undefined;
        const init = async () => {
            const { doc, onSnapshot } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const docRef = doc(db, this.collectionName, docId);

            unsub = onSnapshot(docRef, (snap) => {
                if (snap.exists()) {
                    callback(this.mapDocToAnalysis(snap));
                } else {
                    callback(null);
                }
            }, (error) => {
                const errorCode = (error as any)?.code || '';
                if (errorCode !== 'permission-denied' && !errorCode.includes('permission')) {
                    console.error("Error in analysis subscription:", error);
                }
            });
        };
        const promise = init();
        return () => { promise.then(() => unsub?.()); };
    }

    private mapDocToAnalysis(docSnap: any): SavedAnalysis {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            userId: data.userId,
            jobTitle: data.jobTitle,
            company: data.company,
            atsScore: data.atsScore,
            action: data.action,
            createdAt: (data.createdAt as any)?.toDate?.() || new Date(),
            updatedAt: (data.updatedAt as any)?.toDate?.() || (data.createdAt as any)?.toDate?.() || new Date(),
            analysisData: typeof data.analysisData === 'string' ? JSON.parse(data.analysisData) : data.analysisData,
            jobData: typeof data.jobData === 'string' ? JSON.parse(data.jobData) : data.jobData,
            resumeData: data.resumeData ? (typeof data.resumeData === 'string' ? JSON.parse(data.resumeData) : data.resumeData) : undefined,
            optimizedResumeData: data.optimizedResumeData ? (typeof data.optimizedResumeData === 'string' ? JSON.parse(data.optimizedResumeData) : data.optimizedResumeData) : undefined,
            changesData: data.changesData ? (typeof data.changesData === 'string' ? JSON.parse(data.changesData) : data.changesData) : undefined,
            draftOptimizedResumeData: data.draftOptimizedResumeData ? (typeof data.draftOptimizedResumeData === 'string' ? JSON.parse(data.draftOptimizedResumeData) : data.draftOptimizedResumeData) : undefined,
            draftChangesData: data.draftChangesData ? (typeof data.draftChangesData === 'string' ? JSON.parse(data.draftChangesData) : data.draftChangesData) : undefined,
            draftAtsScore: data.draftAtsScore,
            draftMatchAnalysis: data.draftMatchAnalysis ? (typeof data.draftMatchAnalysis === 'string' ? JSON.parse(data.draftMatchAnalysis) : data.draftMatchAnalysis) : undefined,
            analysisStatus: data.analysisStatus,
            applicationId: data.applicationId,
            isLocked: data.isLocked,
        } as SavedAnalysis;
    }
}

export const historyService = new HistoryService();
