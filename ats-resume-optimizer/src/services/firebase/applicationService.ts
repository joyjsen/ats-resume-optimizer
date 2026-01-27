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
import { Application, ApplicationStage, TimelineEvent } from '../../types/application.types';
import { SavedAnalysis } from '../../types/history.types';

export class ApplicationService {
    private collectionName = 'user_applications';

    /**
     * Create a new application from a saved analysis
     */
    async createApplicationFromAnalysis(analysis: SavedAnalysis): Promise<string> {
        try {
            const user = auth.currentUser;
            const userId = user?.uid || 'anonymous_user';

            // Check if already exists to prevent duplicates, but UPDATE stats if it does
            const existing = await this.getApplicationByAnalysisId(analysis.id);
            if (existing) {
                // Update the score and basics in case they changed
                const appRef = doc(db, this.collectionName, existing.id);
                await updateDoc(appRef, {
                    atsScore: analysis.atsScore,
                    jobTitle: analysis.jobTitle,
                    company: analysis.company,
                    updatedAt: Timestamp.now(),
                    lastResumeUpdateAt: Timestamp.now()
                });
                console.log('Application updated with new analysis stats:', existing.id);
                return existing.id;
            }

            const initialStage: ApplicationStage = 'not_applied';
            const initialTimeline: TimelineEvent = {
                stage: initialStage,
                date: new Date(),
                note: 'Moved to Applications from Analysis'
            };

            const appData: any = {
                userId,
                analysisId: analysis.id,
                jobTitle: analysis.jobTitle || 'Untitled Position',
                company: analysis.company || 'Unknown Company',
                // defensive check for missing jobData
                jobDescription: analysis.jobData?.description || '',
                atsScore: analysis.atsScore || 0,
                currentStage: initialStage,
                lastStatusUpdate: Timestamp.now(),
                lastResumeUpdateAt: Timestamp.now(),
                timeline: [initialTimeline],
                isArchived: false,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            const docRef = await addDoc(collection(db, this.collectionName), appData);
            console.log('Application created with ID:', docRef.id);
            return docRef.id;

        } catch (error) {
            console.error('Error creating application:', error);
            throw error;
        }
    }

    /**
     * Update application status
     */
    async updateStatus(
        applicationId: string,
        newStage: ApplicationStage,
        note?: string,
        customStageName?: string,
        date: Date = new Date()
    ): Promise<boolean> {
        try {
            const appRef = doc(db, this.collectionName, applicationId);
            // We need to fetch current timeline to append
            // For now, using arrayUnion might be tricky with custom objects if we want strict ordering, 
            // but fetching first is safer for complex timeline logic.

            // Simple approach: standard update
            const { getDoc } = require('firebase/firestore');
            const snapshot = await getDoc(appRef);
            if (!snapshot.exists()) return false;

            const currentData = snapshot.data();
            const newEvent: TimelineEvent = {
                stage: newStage,
                date: date,
                note: note,
                customStageName
            };

            const timeline = currentData.timeline || [];
            timeline.push(newEvent);

            const updates: any = {
                currentStage: newStage,
                lastStatusUpdate: Timestamp.fromDate(date),
                timeline: timeline,
                updatedAt: Timestamp.now(),
                customStageName: customStageName || null
            };

            // Archive logic
            if (['offer', 'rejected', 'withdrawn'].includes(newStage)) {
                updates.isArchived = true;
            }

            await updateDoc(appRef, updates);

            // SYNC TO DASHBOARD (Analysis Record)
            // If we have an associated analysisId, update its denormalized status
            if (currentData.analysisId) {
                const { doc: docRef } = require('firebase/firestore'); // ensure import
                const analysisRef = docRef(db, 'user_analyses', currentData.analysisId);

                // Determine if locked? 
                // Spec: "Once status = 'Submitted', ... locked"
                const isLocked = ['submitted', 'phone_screen', 'technical', 'final_round', 'offer', 'rejected', 'withdrawn'].includes(newStage);

                await updateDoc(analysisRef, {
                    applicationStatus: newStage,
                    isLocked: isLocked,
                    updatedAt: Timestamp.now()
                }).catch((err: any) => console.error("Failed to sync status to analysis:", err));
            }

            return true;
        } catch (error) {
            console.error('Error updating status:', error);
            return false;
        }
    }

    async setArchived(applicationId: string, isArchived: boolean): Promise<boolean> {
        try {
            const appRef = doc(db, this.collectionName, applicationId);
            await updateDoc(appRef, { isArchived, updatedAt: Timestamp.now() });
            return true;
        } catch (error) {
            console.error('Error modifying archive status:', error);
            return false;
        }
    }

    async updatePrepStatus(applicationId: string, status: any, forceNewHistory: boolean = false): Promise<void> {
        try {
            const appRef = doc(db, this.collectionName, applicationId);
            const { getDoc } = require('firebase/firestore');

            // We need to fetch current app to manage history array
            const appSnap = await getDoc(appRef);
            if (!appSnap.exists()) throw new Error("App not found");
            const appData = appSnap.data();

            // Construct update object with dot notation
            const updates: any = {};

            // 1. Current State (Legacy/Active View)
            if (status.status) updates['prepGuide.status'] = status.status;
            if (status.progress !== undefined) updates['prepGuide.progress'] = status.progress;
            if (status.currentStep) updates['prepGuide.currentStep'] = status.currentStep;

            // Update sections if provided
            if (status.sections) {
                Object.keys(status.sections).forEach(key => {
                    updates[`prepGuide.sections.${key}`] = status.sections[key];
                });
            }
            if (status.startedAt) updates['prepGuide.startedAt'] = status.startedAt;
            if (status.generatedAt) updates['prepGuide.generatedAt'] = status.generatedAt;
            if (status.downloadUrl) updates['prepGuide.downloadUrl'] = status.downloadUrl;

            // 2. History Management
            let history = appData.prepGuideHistory || [];

            if (forceNewHistory) {
                // New Run -> Add new entry
                // Generate a simple ID based on timestamp
                const runId = `run_${Date.now()}`;

                history.push({
                    id: runId,
                    status: 'generating',
                    startedAt: status.startedAt || new Date()
                });
            } else if (history.length > 0) {
                // Update the LAST entry
                const currentRun = history[history.length - 1];

                // Only update if it makes sense (e.g. not updating an old run)
                // If the last run is already completed/failed, we shouldn't be updating it unless we are correcting it?
                // But normally 'generating' starts a new one. 
                // So if we are here, we are updating the active run.

                if (status.historyStatus || status.status) currentRun.status = status.historyStatus || status.status;
                if (status.generatedAt) currentRun.generatedAt = status.generatedAt;

                history[history.length - 1] = currentRun;
            }

            updates['prepGuideHistory'] = history;
            updates['updatedAt'] = Timestamp.now();

            await updateDoc(appRef, updates);
        } catch (error) {
            console.error('Error updating prep status:', error);
            throw error;
        }
    }

    /**
     * Save generated cover letter
     */
    async saveCoverLetter(applicationId: string, content: string): Promise<boolean> {
        try {
            const appRef = doc(db, this.collectionName, applicationId);
            await updateDoc(appRef, {
                coverLetter: {
                    content,
                    generatedAt: Timestamp.now(),
                    lastEditedAt: Timestamp.now()
                },
                updatedAt: Timestamp.now()
            });
            return true;
        } catch (error) {
            console.error('Error saving cover letter:', error);
            return false;
        }
    }

    /**
     * Get application by analysis ID
     */
    async getApplicationByAnalysisId(analysisId: string): Promise<Application | null> {
        try {
            const user = auth.currentUser;
            const userId = user?.uid || 'anonymous_user';

            const q = query(
                collection(db, this.collectionName),
                where('userId', '==', userId),
                where('analysisId', '==', analysisId)
            );

            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                return this.mapDocToApplication(snapshot.docs[0]);
            }
            return null;
        } catch (error) {
            console.error('Error finding application:', error);
            return null;
        }
    }

    /**
     * Subscribe to applications list
     */
    subscribeToApplications(callback: (apps: Application[]) => void): () => void {
        try {
            const user = auth.currentUser;
            const userId = user?.uid || 'anonymous_user';

            const q = query(
                collection(db, this.collectionName),
                where('userId', '==', userId)
                // orderBy('createdAt', 'desc') // Requires index, skip for now or do client sort
            );

            return onSnapshot(q, (snapshot: any) => {
                const apps = snapshot.docs.map((d: any) => this.mapDocToApplication(d));
                // Client side sort
                apps.sort((a: Application, b: Application) => b.createdAt.getTime() - a.createdAt.getTime());
                callback(apps);
            });
        } catch (error) {
            console.error('Error subscribing to applications:', error);
            return () => { };
        }
    }

    private mapDocToApplication(doc: any): Application {
        const data = doc.data();
        return {
            id: doc.id,
            userId: data.userId,
            analysisId: data.analysisId,
            jobTitle: data.jobTitle,
            company: data.company,
            jobDescription: data.jobDescription,
            atsScore: data.atsScore,
            currentStage: data.currentStage,
            customStageName: data.customStageName,
            lastStatusUpdate: data.lastStatusUpdate.toDate(),
            timeline: data.timeline.map((t: any) => ({
                ...t,
                date: t.date.seconds ? t.date.toDate() : new Date(t.date) // Handle FS Timestamp or string/date
            })),
            isArchived: data.isArchived,
            submittedResumeData: data.submittedResumeData ? JSON.parse(data.submittedResumeData) : undefined,
            lastResumeUpdateAt: data.lastResumeUpdateAt ? data.lastResumeUpdateAt.toDate() : undefined,
            coverLetter: data.coverLetter ? {
                ...data.coverLetter,
                generatedAt: data.coverLetter.generatedAt.toDate(),
                lastEditedAt: data.coverLetter.lastEditedAt.toDate()
            } : undefined,
            prepGuide: data.prepGuide ? {
                ...data.prepGuide,
                startedAt: data.prepGuide.startedAt ? data.prepGuide.startedAt.toDate() : undefined,
                generatedAt: data.prepGuide.generatedAt ? data.prepGuide.generatedAt.toDate() : undefined
            } : undefined,
            prepGuideHistory: data.prepGuideHistory ? data.prepGuideHistory.map((h: any) => ({
                ...h,
                startedAt: h.startedAt ? h.startedAt.toDate() : undefined,
                generatedAt: h.generatedAt ? h.generatedAt.toDate() : undefined
            })) : undefined,
            interviewNotes: data.interviewNotes,
            finalResult: data.finalResult,
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate()
        } as Application;
    }
}

export const applicationService = new ApplicationService();
