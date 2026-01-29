import {
    collection,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    query,
    where,
    onSnapshot,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { db, auth } from './config';
import { SavedAnalysis } from '../../types/history.types';
import { AnalysisResult } from '../../types/analysis.types';
import { JobPosting } from '../../types/job.types';
import { ParsedResume } from '../../types/resume.types';

export class HistoryService {
    private collectionName = 'user_analyses';

    private get analysesCollection() {
        return collection(db, this.collectionName);
    }

    /**
     * Save a completed analysis to Firestore
     */
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
            const user = auth.currentUser;
            if (!user) throw new Error("User must be authenticated to save analysis");
            const userId = user.uid;

            const docData: any = {
                userId,
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
                optimizedResumeData: null,
                changesData: null
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

            const docRef = await addDoc(this.analysesCollection, docData);
            console.log('Analysis saved with ID: ', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Error saving analysis history:', error);
            return '';
        }
    }

    /**
     * Update an existing analysis
     */
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
            const docData: any = {
                updatedAt: serverTimestamp()
            };

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

            let newStatus = '';
            if (isDraft) {
                newStatus = 'draft_ready';
            } else if (optimizedResume) {
                newStatus = 'optimized';
            }
            if (newStatus) docData.analysisStatus = newStatus;

            const docRef = doc(db, this.collectionName, docId);
            await updateDoc(docRef, docData);
            console.log('Analysis updated for ID: ', docId);

            // Sync to Application
            try {
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    if (data?.applicationId) {
                        const appUpdate: any = { updatedAt: serverTimestamp() };
                        if (newStatus) appUpdate.analysisStatus = newStatus;

                        await updateDoc(doc(db, 'user_applications', data.applicationId), appUpdate);
                    } else {
                        const { applicationService } = require('./applicationService');
                        const app = await applicationService.getApplicationByAnalysisId(docId);
                        if (app) {
                            const appUpdate: any = { updatedAt: serverTimestamp() };
                            if (newStatus) appUpdate.analysisStatus = newStatus;
                            await updateDoc(docRef, { applicationId: app.id });
                            await updateDoc(doc(db, 'user_applications', app.id), appUpdate);
                        }
                    }
                }
            } catch (syncErr) {
                console.error("Failed to sync analysis update to application:", syncErr);
            }

            return true;
        } catch (error) {
            console.error('Error updating analysis history:', error);
            return false;
        }
    }

    /**
     * Promote draft optimization to final
     */
    async promoteDraftToFinal(docId: string): Promise<boolean> {
        try {
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
            console.log('Analysis promoted to final for ID: ', docId);

            try {
                const { applicationService } = require('./applicationService');
                const analysisForApp = {
                    id: docId,
                    userId: data.userId,
                    jobTitle: data.jobTitle,
                    company: data.company,
                    atsScore: data.draftAtsScore || data.atsScore,
                    jobData: JSON.parse(data.jobData),
                } as SavedAnalysis;

                const appId = await applicationService.createApplicationFromAnalysis(analysisForApp);
                if (appId) {
                    await updateDoc(docRef, { applicationId: appId });
                }
            } catch (appError) {
                console.error("Failed to auto-create application:", appError);
            }

            return true;
        } catch (error) {
            console.error('Error promoting draft:', error);
            return false;
        }
    }

    async ensureApplicationSync(analysis: SavedAnalysis): Promise<void> {
        try {
            const { applicationService } = require('./applicationService');
            await applicationService.createApplicationFromAnalysis(analysis);
        } catch (error) {
            console.error("Self-healing sync failed:", error);
        }
    }

    async discardDraft(docId: string): Promise<boolean> {
        try {
            const docRef = doc(db, this.collectionName, docId);
            const snapshot = await getDoc(docRef);
            if (!snapshot.exists()) return false;
            const data = snapshot.data();

            const hasFinal = !!data?.optimizedResumeData;
            const newStatus = hasFinal ? 'optimized' : 'pending_resume_update';

            const updates: any = {
                draftOptimizedResumeData: null,
                draftChangesData: null,
                draftAtsScore: null,
                draftMatchAnalysis: null,
                updatedAt: serverTimestamp(),
                analysisStatus: newStatus
            };

            await updateDoc(docRef, updates);
            console.log(`Draft discarded for ID: ${docId}. Status: ${newStatus}`);

            if (data?.applicationId) {
                await updateDoc(doc(db, 'user_applications', data.applicationId), {
                    analysisStatus: newStatus,
                    updatedAt: serverTimestamp()
                }).catch((err: any) => console.error("Failed to sync revert:", err));
            } else {
                try {
                    const { applicationService } = require('./applicationService');
                    const app = await applicationService.getApplicationByAnalysisId(docId);
                    if (app) {
                        await updateDoc(doc(db, 'user_applications', app.id), {
                            analysisStatus: newStatus,
                            updatedAt: serverTimestamp()
                        });
                    }
                } catch (findErr) {
                    console.warn("Could not find linked application:", findErr);
                }
            }

            return true;
        } catch (error) {
            console.error('Error discarding draft:', error);
            return false;
        }
    }

    async deleteAnalysis(docId: string): Promise<boolean> {
        try {
            const { activityService } = require('./activityService');

            const docRef = doc(db, this.collectionName, docId);
            const snapshot = await getDoc(docRef);
            let description = 'Deleted analysis';

            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data?.jobTitle && data?.company) {
                    description = `Deleted analysis for ${data.jobTitle} at ${data.company}`;
                }
            }

            await deleteDoc(docRef);
            console.log('Analysis deleted: ', docId);

            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data?.applicationId) {
                    try {
                        await deleteDoc(doc(db, 'user_applications', data.applicationId));
                    } catch (appErr) {
                        console.error('Failed to cascade delete application:', appErr);
                    }
                } else {
                    try {
                        const appsQuery = query(
                            collection(db, 'user_applications'),
                            where('analysisId', '==', docId),
                            where('userId', '==', auth.currentUser?.uid)
                        );
                        const appsSnap = await getDocs(appsQuery);

                        const batch = writeBatch(db);
                        appsSnap.forEach(d => batch.delete(d.ref));
                        if (!appsSnap.empty) await batch.commit();
                    } catch (qErr) {
                        console.warn("Failed fallback cascade delete:", qErr);
                    }
                }
            }

            try {
                await activityService.logActivity({
                    type: 'analysis_deleted',
                    description: description,
                    resourceId: docId,
                    platform: 'web'
                });
            } catch (logError) { }

            return true;
        } catch (error) {
            console.error('Error deleting analysis:', error);
            return false;
        }
    }

    async findExistingAnalysis(jobHash: string, resumeHash: string): Promise<SavedAnalysis | null> {
        try {
            const user = auth.currentUser;
            if (!user) return null;
            const userId = user.uid;

            const q = query(
                this.analysesCollection,
                where('userId', '==', userId),
                where('jobHash', '==', jobHash),
                where('resumeHash', '==', resumeHash)
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const docSnap = querySnapshot.docs[0];
                return this.mapDocToAnalysis(docSnap);
            }
            return null;
        } catch (error) {
            console.error('Error finding existing analysis:', error);
            return null;
        }
    }

    subscribeToUserHistory(callback: (history: SavedAnalysis[]) => void): () => void {
        try {
            const user = auth.currentUser;
            if (!user) return () => { };
            const userId = user.uid;

            const q = query(
                this.analysesCollection,
                where('userId', '==', userId)
            );

            return onSnapshot(q, (snapshot) => {
                const fetchedHistory = snapshot.docs.map(docSnap => this.mapDocToAnalysis(docSnap));

                const sorted = fetchedHistory.sort((a, b) => {
                    const timeA = a.updatedAt ? a.updatedAt.getTime() : a.createdAt.getTime();
                    const timeB = b.updatedAt ? b.updatedAt.getTime() : b.createdAt.getTime();
                    return timeB - timeA;
                });

                callback(sorted);
            }, (error) => {
                // @ts-ignore
                if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
                    return;
                }
                console.error("Error in history subscription:", error);
            });
        } catch (error) {
            console.error("Failed to setup subscription:", error);
            return () => { };
        }
    }

    async getUserHistory(): Promise<SavedAnalysis[]> {
        try {
            const user = auth.currentUser;
            if (!user) return [];
            const userId = user.uid;

            const q = query(
                this.analysesCollection,
                where('userId', '==', userId)
            );
            const querySnapshot = await getDocs(q);

            const fetchedHistory = querySnapshot.docs.map(docSnap => this.mapDocToAnalysis(docSnap));

            return fetchedHistory.sort((a, b) => {
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
            const snapshot = await getDoc(doc(db, this.collectionName, docId));

            if (snapshot.exists()) {
                return this.mapDocToAnalysis(snapshot);
            }
            return null;
        } catch (error) {
            console.error("Error getting analysis by ID:", error);
            return null;
        }
    }

    async getUserHistoryByUid(userId: string): Promise<SavedAnalysis[]> {
        try {
            const q = query(
                this.analysesCollection,
                where('userId', '==', userId)
            );
            const querySnapshot = await getDocs(q);

            const fetchedHistory = querySnapshot.docs.map(docSnap => this.mapDocToAnalysis(docSnap));

            return fetchedHistory.sort((a, b) => {
                const timeA = a.updatedAt ? a.updatedAt.getTime() : a.createdAt.getTime();
                const timeB = b.updatedAt ? b.updatedAt.getTime() : b.createdAt.getTime();
                return timeB - timeA;
            });
        } catch (error) {
            console.error('Error fetching user history by UID:', error);
            return [];
        }
    }

    subscribeToAnalysis(docId: string, callback: (analysis: SavedAnalysis | null) => void): () => void {
        try {
            const docRef = doc(db, this.collectionName, docId);
            return onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    callback(this.mapDocToAnalysis(docSnap));
                } else {
                    callback(null);
                }
            }, (error) => {
                console.error("Error subscribing to analysis:", error);
            });
        } catch (error) {
            console.error("Failed to subscribe to analysis:", error);
            return () => { };
        }
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
            createdAt: (data.createdAt as any)?.toDate ? (data.createdAt as any).toDate() : new Date(),
            updatedAt: (data.updatedAt as any)?.toDate ? (data.updatedAt as any).toDate() : ((data.createdAt as any)?.toDate ? (data.createdAt as any).toDate() : new Date()),
            analysisData: typeof data.analysisData === 'string' ? JSON.parse(data.analysisData) : data.analysisData,
            jobData: typeof data.jobData === 'string' ? JSON.parse(data.jobData) : data.jobData,
            resumeData: data.resumeData ? (typeof data.resumeData === 'string' ? JSON.parse(data.resumeData) : data.resumeData) : undefined,
            optimizedResumeData: data.optimizedResumeData ? (typeof data.optimizedResumeData === 'string' ? JSON.parse(data.optimizedResumeData) : data.optimizedResumeData) : undefined,
            changesData: data.changesData ? (typeof data.changesData === 'string' ? JSON.parse(data.changesData) : data.changesData) : undefined,
            draftOptimizedResumeData: data.draftOptimizedResumeData ? (typeof data.draftOptimizedResumeData === 'string' ? JSON.parse(data.draftOptimizedResumeData) : data.draftOptimizedResumeData) : undefined,
            draftChangesData: data.draftChangesData ? (typeof data.draftChangesData === 'string' ? JSON.parse(data.draftChangesData) : data.draftChangesData) : undefined,
            draftAtsScore: data.draftAtsScore,
            draftMatchAnalysis: data.draftMatchAnalysis ? (typeof data.draftMatchAnalysis === 'string' ? JSON.parse(data.draftMatchAnalysis) : data.draftMatchAnalysis) : undefined,
        } as SavedAnalysis;
    }
}

export const historyService = new HistoryService();
