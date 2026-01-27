import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    Timestamp
} from 'firebase/firestore';
import { db, auth } from './config';
import { SavedAnalysis } from '../../types/history.types';
import { AnalysisResult } from '../../types/analysis.types';
import { JobPosting } from '../../types/job.types';
import { ParsedResume } from '../../types/resume.types';

export class HistoryService {
    private collectionName = 'user_analyses';

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
            const userId = user?.uid || 'anonymous_user';

            const docData: any = {
                userId,
                jobTitle: job.title,
                company: job.company,
                atsScore: analysis.atsScore,
                action: analysis.recommendation.action,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(), // Initial update time = created time
                analysisData: JSON.stringify(analysis),
                jobData: JSON.stringify(job),
                resumeData: JSON.stringify(resume || {}),
                jobHash: jobHash || null,
                resumeHash: resumeHash || null,
                optimizedResumeData: null, // Always null initially unless explicitly validated
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

            const docRef = await addDoc(collection(db, this.collectionName), docData);
            console.log('Analysis saved with ID: ', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Error saving analysis history:', error);
            // Don't block the UI flow if save fails
            return '';
        }
    }

    /**
     * Update an existing analysis (e.g. adding optimization results)
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
            const { doc, updateDoc } = require('firebase/firestore');

            const docData: any = {
                updatedAt: Timestamp.now()
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

            const docRef = doc(db, this.collectionName, docId);
            await updateDoc(docRef, docData);
            console.log('Analysis updated for ID: ', docId);
            return true;
        } catch (error) {
            console.error('Error updating analysis history:', error);
            return false;
        }
    }

    /**
     * Promote draft optimization to final (Validate)
     */
    async promoteDraftToFinal(docId: string): Promise<boolean> {
        try {
            const { doc, getDoc, updateDoc } = require('firebase/firestore');
            const docRef = doc(db, this.collectionName, docId);
            const snapshot = await getDoc(docRef);

            if (!snapshot.exists()) return false;

            const data = snapshot.data();
            if (!data.draftOptimizedResumeData) return false; // Nothing to promote

            await updateDoc(docRef, {
                optimizedResumeData: data.draftOptimizedResumeData,
                changesData: data.draftChangesData,
                optimizedMatchAnalysis: data.draftMatchAnalysis || null, // Persist the new match analysis!
                draftOptimizedResumeData: null,
                draftChangesData: null,
                draftAtsScore: null,
                draftMatchAnalysis: null,
                updatedAt: Timestamp.now(),
                // If we also want to update the displayed score immediately in the DB index:
                ...(data.draftAtsScore ? { atsScore: data.draftAtsScore } : {})
            });
            console.log('Analysis promoted to final for ID: ', docId);

            // AUTO-POPULATE APPLICATIONS
            try {
                const { applicationService } = require('./applicationService');
                // We need the full SavedAnalysis object to create the application
                // Construct a temporary one from the snapshot data + updates
                const analysisForApp = {
                    id: docId,
                    userId: data.userId,
                    jobTitle: data.jobTitle,
                    company: data.company,
                    atsScore: data.draftAtsScore || data.atsScore, // Use new score
                    jobData: JSON.parse(data.jobData),
                    // ... other fields if needed by create func
                } as SavedAnalysis;

                const appId = await applicationService.createApplicationFromAnalysis(analysisForApp);

                // Link back
                if (appId) {
                    await updateDoc(docRef, { applicationId: appId });
                }
            } catch (appError) {
                console.error("Failed to auto-create application:", appError);
                // Don't fail the promotion just because app tracking failed
            }

            return true;
        } catch (error) {
            console.error('Error promoting draft:', error);
            return false;
        }
    }

    /**
     * Ensure Application is synced with Analysis (Self-Healing)
     */
    async ensureApplicationSync(analysis: SavedAnalysis): Promise<void> {
        try {
            const { applicationService } = require('./applicationService');
            // This will create if missing, or UPDATE if exists (thanks to our recent fix)
            await applicationService.createApplicationFromAnalysis(analysis);
        } catch (error) {
            console.error("Self-healing sync failed:", error);
        }
    }

    /**
     * Discard draft optimization (Revert to last saved state)
     */
    async discardDraft(docId: string): Promise<boolean> {
        try {
            const { doc, updateDoc } = require('firebase/firestore');
            const docRef = doc(db, this.collectionName, docId);

            await updateDoc(docRef, {
                draftOptimizedResumeData: null,
                draftChangesData: null,
                draftAtsScore: null,
                draftMatchAnalysis: null,
                updatedAt: Timestamp.now()
            });
            console.log('Draft discarded for ID: ', docId);
            return true;
        } catch (error) {
            console.error('Error discarding draft:', error);
            return false;
        }
    }

    /**
     * Delete an analysis from Firestore
     */
    async deleteAnalysis(docId: string): Promise<boolean> {
        try {
            const { doc, deleteDoc } = require('firebase/firestore');
            const docRef = doc(db, this.collectionName, docId);
            await deleteDoc(docRef);
            console.log('Analysis deleted: ', docId);
            return true;
            console.log('Analysis deleted: ', docId);
            return true;
        } catch (error) {
            console.error('Error deleting analysis:', error);
            return false;
        }
    }

    /**
     * Check for existing analysis with same hashes
     */
    async findExistingAnalysis(jobHash: string, resumeHash: string): Promise<SavedAnalysis | null> {
        try {
            const user = auth.currentUser;
            const userId = user?.uid || 'anonymous_user';

            const q = query(
                collection(db, this.collectionName),
                where('userId', '==', userId),
                where('jobHash', '==', jobHash),
                where('resumeHash', '==', resumeHash)
            );

            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                // Return the most recent one if multiple (though unexpected)
                const doc = querySnapshot.docs[0];
                const data = doc.data();
                return {
                    id: doc.id,
                    userId: data.userId,
                    jobTitle: data.jobTitle,
                    company: data.company,
                    atsScore: data.atsScore,
                    action: data.action,
                    createdAt: data.createdAt.toDate(),
                    analysisData: JSON.parse(data.analysisData),
                    jobData: JSON.parse(data.jobData),
                    resumeData: data.resumeData ? JSON.parse(data.resumeData) : undefined,
                    optimizedResumeData: data.optimizedResumeData ? JSON.parse(data.optimizedResumeData) : undefined,
                    changesData: data.changesData ? JSON.parse(data.changesData) : undefined,
                    draftOptimizedResumeData: data.draftOptimizedResumeData ? JSON.parse(data.draftOptimizedResumeData) : undefined,
                    draftChangesData: data.draftChangesData ? JSON.parse(data.draftChangesData) : undefined,
                    draftAtsScore: data.draftAtsScore,
                    draftMatchAnalysis: data.draftMatchAnalysis ? JSON.parse(data.draftMatchAnalysis) : undefined,
                    jobHash: data.jobHash,
                    resumeHash: data.resumeHash
                } as SavedAnalysis;
            }
            return null;
        } catch (error) {
            console.error('Error finding existing analysis:', error);
            return null;
        }
    }

    /**
     * Subscribe to user's analysis history for real-time updates
     */
    subscribeToUserHistory(callback: (history: SavedAnalysis[]) => void): () => void {
        try {
            const { onSnapshot } = require('firebase/firestore');
            const user = auth.currentUser;
            const userId = user?.uid || 'anonymous_user';

            const q = query(
                collection(db, this.collectionName),
                where('userId', '==', userId)
            );

            return onSnapshot(q, (snapshot: any) => {
                const fetchedHistory = snapshot.docs.map((doc: any) => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        userId: data.userId,
                        jobTitle: data.jobTitle,
                        company: data.company,
                        atsScore: data.atsScore,
                        action: data.action,
                        createdAt: data.createdAt.toDate(),
                        updatedAt: data.updatedAt ? data.updatedAt.toDate() : data.createdAt.toDate(),
                        analysisData: JSON.parse(data.analysisData),
                        jobData: JSON.parse(data.jobData),
                        resumeData: data.resumeData ? JSON.parse(data.resumeData) : undefined,
                        optimizedResumeData: data.optimizedResumeData ? JSON.parse(data.optimizedResumeData) : undefined,
                        changesData: data.changesData ? JSON.parse(data.changesData) : undefined,
                        draftOptimizedResumeData: data.draftOptimizedResumeData ? JSON.parse(data.draftOptimizedResumeData) : undefined,
                        draftChangesData: data.draftChangesData ? JSON.parse(data.draftChangesData) : undefined,
                        draftAtsScore: data.draftAtsScore,
                        draftMatchAnalysis: data.draftMatchAnalysis ? JSON.parse(data.draftMatchAnalysis) : undefined,
                    } as SavedAnalysis;
                });

                // Client-side sort
                const sorted = fetchedHistory.sort((a: SavedAnalysis, b: SavedAnalysis) => {
                    const timeA = a.updatedAt ? a.updatedAt.getTime() : a.createdAt.getTime();
                    const timeB = b.updatedAt ? b.updatedAt.getTime() : b.createdAt.getTime();
                    return timeB - timeA;
                });

                callback(sorted);
            }, (error: any) => {
                console.error("Error in history subscription:", error);
            });
        } catch (error) {
            console.error("Failed to setup subscription:", error);
            return () => { }; // No-op unsubscribe
        }
    }

    /**
     * Get user's analysis history (One-time fetch)
     */
    async getUserHistory(): Promise<SavedAnalysis[]> {
        try {
            const user = auth.currentUser;
            const userId = user?.uid || 'anonymous_user';

            // optimization: remove orderBy to avoid needing a composite index for this MVP
            const q = query(
                collection(db, this.collectionName),
                where('userId', '==', userId)
            );

            const querySnapshot = await getDocs(q);

            const fetchedHistory = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    userId: data.userId,
                    jobTitle: data.jobTitle,
                    company: data.company,
                    atsScore: data.atsScore,
                    action: data.action,
                    createdAt: data.createdAt.toDate(),
                    updatedAt: data.updatedAt ? data.updatedAt.toDate() : data.createdAt.toDate(), // Fallback
                    analysisData: JSON.parse(data.analysisData),
                    jobData: JSON.parse(data.jobData),
                    // Parse optional extended data (handle backward compatibility)
                    resumeData: data.resumeData ? JSON.parse(data.resumeData) : undefined,
                    optimizedResumeData: data.optimizedResumeData ? JSON.parse(data.optimizedResumeData) : undefined,
                    changesData: data.changesData ? JSON.parse(data.changesData) : undefined,
                    draftOptimizedResumeData: data.draftOptimizedResumeData ? JSON.parse(data.draftOptimizedResumeData) : undefined,
                    draftChangesData: data.draftChangesData ? JSON.parse(data.draftChangesData) : undefined,
                    draftAtsScore: data.draftAtsScore,
                    draftMatchAnalysis: data.draftMatchAnalysis ? JSON.parse(data.draftMatchAnalysis) : undefined,
                } as SavedAnalysis;
            });

            // Client-side sort (Newest Updated First)
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

    /**
     * Get a single analysis by ID
     */
    async getAnalysisById(docId: string): Promise<SavedAnalysis | null> {
        try {
            const { doc, getDoc } = require('firebase/firestore');
            const docRef = doc(db, this.collectionName, docId);
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                const data = snapshot.data();
                return {
                    id: snapshot.id,
                    userId: data.userId,
                    jobTitle: data.jobTitle,
                    company: data.company,
                    atsScore: data.atsScore,
                    action: data.action,
                    createdAt: data.createdAt.toDate(),
                    analysisData: JSON.parse(data.analysisData),
                    jobData: JSON.parse(data.jobData),
                    resumeData: data.resumeData ? JSON.parse(data.resumeData) : undefined,
                    optimizedResumeData: data.optimizedResumeData ? JSON.parse(data.optimizedResumeData) : undefined,
                    changesData: data.changesData ? JSON.parse(data.changesData) : undefined,
                    draftOptimizedResumeData: data.draftOptimizedResumeData ? JSON.parse(data.draftOptimizedResumeData) : undefined,
                    draftChangesData: data.draftChangesData ? JSON.parse(data.draftChangesData) : undefined,
                    draftAtsScore: data.draftAtsScore,
                    draftMatchAnalysis: data.draftMatchAnalysis ? JSON.parse(data.draftMatchAnalysis) : undefined,
                } as SavedAnalysis;
            }
            return null;
        } catch (error) {
            console.error("Error getting analysis by ID:", error);
            return null;
        }
    }
}

export const historyService = new HistoryService();
