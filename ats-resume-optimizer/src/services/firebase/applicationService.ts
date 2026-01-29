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
    Timestamp,
    writeBatch
} from 'firebase/firestore';
import { db, auth } from './config';
import { Application, ApplicationStage, TimelineEvent } from '../../types/application.types';
import { SavedAnalysis } from '../../types/history.types';

export class ApplicationService {
    private collectionName = 'user_applications';

    private get applicationsCollection() {
        return collection(db, this.collectionName);
    }

    async createApplicationFromAnalysis(analysis: SavedAnalysis): Promise<string> {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("User must be authenticated to create applications");
            const userId = user.uid;

            const existing = await this.getApplicationByAnalysisId(analysis.id);
            if (existing) {
                await updateDoc(doc(db, this.collectionName, existing.id), {
                    atsScore: analysis.atsScore,
                    jobTitle: analysis.jobTitle,
                    company: analysis.company,
                    updatedAt: serverTimestamp(),
                    lastResumeUpdateAt: serverTimestamp(),
                    analysisStatus: 'optimized',
                    isReadOnly: false
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
                jobDescription: (analysis.jobData as any)?.description || '',
                atsScore: analysis.atsScore || 0,
                currentStage: initialStage,
                lastStatusUpdate: serverTimestamp(),
                lastResumeUpdateAt: serverTimestamp(),
                timeline: [initialTimeline],
                isArchived: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            const docRef = await addDoc(this.applicationsCollection, appData);
            console.log('Application created with ID:', docRef.id);
            return docRef.id;

        } catch (error) {
            console.error('Error creating application:', error);
            throw error;
        }
    }

    async updateStatus(
        applicationId: string,
        newStage: ApplicationStage,
        note?: string,
        customStageName?: string,
        date: Date = new Date()
    ): Promise<boolean> {
        try {
            const appRef = doc(db, this.collectionName, applicationId);
            const snapshot = await getDoc(appRef);
            if (!snapshot.exists()) return false;

            const currentData = snapshot.data();
            const newEvent: TimelineEvent = {
                stage: newStage,
                date: date,
                note: note,
                customStageName
            };

            const timeline = currentData?.timeline || [];
            timeline.push(newEvent);

            const updates: any = {
                currentStage: newStage,
                lastStatusUpdate: Timestamp.fromDate(date),
                timeline: timeline,
                updatedAt: serverTimestamp(),
                customStageName: customStageName || null
            };

            const terminalStages = ['offer', 'rejected', 'withdrawn'];
            if (terminalStages.includes(newStage)) {
                updates.isArchived = true;
            } else {
                updates.isArchived = false;
            }

            await updateDoc(appRef, updates);

            if (currentData?.analysisId) {
                const isLocked = ['submitted', 'phone_screen', 'technical', 'final_round', 'offer', 'rejected', 'withdrawn'].includes(newStage);

                await updateDoc(doc(db, 'user_analyses', currentData.analysisId), {
                    applicationStatus: newStage,
                    isLocked: isLocked,
                    updatedAt: serverTimestamp()
                }).catch((err: any) => console.error("Failed to sync status to analysis:", err));
            }

            try {
                const { activityService } = require('./activityService');
                const stageName = customStageName || newStage.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
                await activityService.logActivity({
                    type: 'application_status_update',
                    description: `Updated status to ${stageName} for ${currentData?.jobTitle || 'Application'}`,
                    resourceId: applicationId,
                    contextData: {
                        applicationId,
                        newStage,
                        previousStage: currentData?.currentStage
                    },
                    platform: 'web'
                });
            } catch (logError) { }

            return true;
        } catch (error) {
            console.error('Error updating status:', error);
            return false;
        }
    }

    async setArchived(applicationId: string, isArchived: boolean): Promise<boolean> {
        try {
            await updateDoc(doc(db, this.collectionName, applicationId), {
                isArchived,
                updatedAt: serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Error modifying archive status:', error);
            return false;
        }
    }

    async deleteApplication(applicationId: string): Promise<boolean> {
        try {
            await deleteDoc(doc(db, this.collectionName, applicationId));
            return true;
        } catch (error) {
            console.error('Error deleting application:', error);
            return false;
        }
    }

    async updatePrepStatus(applicationId: string, status: any, forceNewHistory: boolean = false): Promise<void> {
        try {
            const appRef = doc(db, this.collectionName, applicationId);
            const appSnap = await getDoc(appRef);
            if (!appSnap.exists()) throw new Error("App not found");
            const appData = appSnap.data();

            const updates: any = {};

            if (status.status) updates['prepGuide.status'] = status.status;
            if (status.progress !== undefined) updates['prepGuide.progress'] = status.progress;
            if (status.currentStep) updates['prepGuide.currentStep'] = status.currentStep;

            if (status.sections) {
                Object.keys(status.sections).forEach(key => {
                    updates[`prepGuide.sections.${key}`] = status.sections[key];
                });
            }
            if (status.startedAt) updates['prepGuide.startedAt'] = Timestamp.fromDate(status.startedAt);
            if (status.generatedAt) updates['prepGuide.generatedAt'] = Timestamp.fromDate(status.generatedAt);
            if (status.downloadUrl) updates['prepGuide.downloadUrl'] = status.downloadUrl;

            let history = appData?.prepGuideHistory || [];

            if (forceNewHistory) {
                const runId = `run_${Date.now()}`;
                history.push({
                    id: runId,
                    status: 'generating',
                    startedAt: Timestamp.now()
                });
            } else if (history.length > 0) {
                const currentRun = history[history.length - 1];
                if (status.historyStatus || status.status) currentRun.status = status.historyStatus || status.status;
                if (status.generatedAt) currentRun.generatedAt = Timestamp.fromDate(status.generatedAt);
                history[history.length - 1] = currentRun;
            }

            updates['prepGuideHistory'] = history;
            updates['updatedAt'] = serverTimestamp();

            await updateDoc(appRef, updates);
        } catch (error) {
            console.error('Error updating prep status:', error);
            throw error;
        }
    }

    async saveCoverLetter(applicationId: string, content: string): Promise<boolean> {
        try {
            await updateDoc(doc(db, this.collectionName, applicationId), {
                coverLetter: {
                    content,
                    generatedAt: serverTimestamp(),
                    lastEditedAt: serverTimestamp()
                },
                updatedAt: serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Error saving cover letter:', error);
            return false;
        }
    }

    async getApplicationByAnalysisId(analysisId: string): Promise<Application | null> {
        try {
            const user = auth.currentUser;
            if (!user) return null;
            const userId = user.uid;

            const q = query(
                this.applicationsCollection,
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

    subscribeToApplications(callback: (apps: Application[]) => void): () => void {
        try {
            const user = auth.currentUser;
            if (!user) return () => { };
            const userId = user.uid;

            const q = query(
                this.applicationsCollection,
                where('userId', '==', userId)
            );

            return onSnapshot(q, (snapshot) => {
                const apps = snapshot.docs.map(d => this.mapDocToApplication(d));
                apps.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                callback(apps);
            }, (error) => {
                // @ts-ignore
                if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
                    return;
                }
                console.error('Error subscribing to applications:', error);
            });
        } catch (error) {
            console.error('Error subscribing to applications:', error);
            return () => { };
        }
    }

    async getApplications(): Promise<Application[]> {
        try {
            const user = auth.currentUser;
            if (!user) return [];
            const userId = user.uid;

            const q = query(
                this.applicationsCollection,
                where('userId', '==', userId)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => this.mapDocToApplication(d));
        } catch (error) {
            console.error('Error fetching applications:', error);
            return [];
        }
    }

    private mapDocToApplication(docSnap: any): Application {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            userId: data.userId,
            analysisId: data.analysisId,
            jobTitle: data.jobTitle,
            company: data.company,
            jobDescription: data.jobDescription,
            atsScore: data.atsScore,
            currentStage: data.currentStage,
            customStageName: data.customStageName,
            lastStatusUpdate: (data.lastStatusUpdate as any)?.toDate?.() || new Date(),
            timeline: (data.timeline || []).map((t: any) => ({
                ...t,
                date: (t.date as any)?.toDate ? (t.date as any).toDate() : new Date(t.date)
            })),
            isArchived: data.isArchived,
            analysisStatus: data.analysisStatus,
            isReadOnly: data.analysisStatus === 'pending_resume_update' || data.analysisStatus === 'draft_ready' || data.analysisStatus === 'pending_skill_update',

            submittedResumeData: data.submittedResumeData ? JSON.parse(data.submittedResumeData) : undefined,
            lastResumeUpdateAt: (data.lastResumeUpdateAt as any)?.toDate?.(),
            coverLetter: data.coverLetter ? {
                status: data.coverLetter.status,
                content: data.coverLetter.content || '',
                generatedAt: (data.coverLetter.generatedAt as any)?.toDate?.(),
                lastEditedAt: (data.coverLetter.lastEditedAt as any)?.toDate?.(),
                startedAt: (data.coverLetter.startedAt as any)?.toDate?.(),
                completedAt: (data.coverLetter.completedAt as any)?.toDate?.()
            } : undefined,
            prepGuide: data.prepGuide ? {
                ...data.prepGuide,
                startedAt: (data.prepGuide.startedAt as any)?.toDate?.(),
                generatedAt: (data.prepGuide.generatedAt as any)?.toDate?.()
            } : undefined,
            prepGuideHistory: data.prepGuideHistory ? data.prepGuideHistory.map((h: any) => ({
                ...h,
                startedAt: (h.startedAt as any)?.toDate?.(),
                generatedAt: (h.generatedAt as any)?.toDate?.()
            })) : undefined,
            interviewNotes: data.interviewNotes,
            finalResult: data.finalResult,
            createdAt: (data.createdAt as any)?.toDate?.() || new Date(),
            updatedAt: (data.updatedAt as any)?.toDate?.() || new Date()
        } as Application;
    }
}

export const applicationService = new ApplicationService();
