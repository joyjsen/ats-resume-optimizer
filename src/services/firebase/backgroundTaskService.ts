import { getFirestoreDb, getFirebaseAuth } from './config';

export type BackgroundTaskType = 'optimize_resume' | 'add_skill' | 'prep_guide' | 'cover_letter' | 'analyze_resume';

export interface BackgroundTask {
    id: string;
    type: BackgroundTaskType;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    payload: any;
    result?: any;
    error?: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
}

class BackgroundTaskService {
    private listeners: Map<string, any> = new Map();

    async createTask(type: BackgroundTaskType, payload: any, onComplete?: (t: BackgroundTask) => void, onError?: (t: BackgroundTask) => void): Promise<string> {
        const auth = await getFirebaseAuth();
        if (!auth.currentUser) throw new Error('User not authenticated');

        const { collection, doc, setDoc, query, where, getDocs, limit, serverTimestamp } = await import('firebase/firestore');
        const db = await getFirestoreDb();

        if (payload.analysisTaskId) {
            try {
                const q = query(collection(db, 'background_tasks'), where('type', '==', type), where('payload.analysisTaskId', '==', payload.analysisTaskId), where('status', 'in', ['pending', 'processing']), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const existingId = snap.docs[0].id;
                    if (onComplete || onError) this.listenToTask(existingId, onComplete, onError);
                    return existingId;
                }
            } catch (e) { }
        }

        const taskId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const taskRef = doc(collection(db, 'background_tasks'), taskId);
        await setDoc(taskRef, { id: taskId, type, status: 'pending', userId: auth.currentUser.uid, payload, createdAt: serverTimestamp() });

        if (onComplete || onError) this.listenToTask(taskId, onComplete, onError);
        return taskId;
    }

    async listenToTask(taskId: string, onComplete?: (t: BackgroundTask) => void, onError?: (t: BackgroundTask) => void) {
        if (this.listeners.has(taskId)) {
            const u = this.listeners.get(taskId);
            if (typeof u === 'function') u();
            this.listeners.delete(taskId);
        }

        const { doc, onSnapshot } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        const unsub = onSnapshot(doc(db, 'background_tasks', taskId), (snapshot) => {
            if (!snapshot.exists()) return;
            const data = snapshot.data();
            const task: BackgroundTask = {
                id: taskId,
                type: data.type,
                status: data.status,
                payload: data.payload,
                result: data.result,
                error: data.error,
                createdAt: data.createdAt?.toDate?.() || new Date(),
                startedAt: data.startedAt?.toDate?.(),
                completedAt: data.completedAt?.toDate?.(),
                failedAt: data.failedAt?.toDate?.(),
            };

            if (task.status === 'completed') {
                if (onComplete) onComplete(task);
                this.stopListening(taskId);
            } else if (task.status === 'failed') {
                if (onError) onError(task);
                this.stopListening(taskId);
            }
        });

        this.listeners.set(taskId, unsub);
    }

    stopListening(taskId: string): void {
        const u = this.listeners.get(taskId);
        if (typeof u === 'function') u();
        this.listeners.delete(taskId);
    }

    async cancelTask(taskId: string): Promise<void> {
        try {
            const { doc, deleteDoc } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            await deleteDoc(doc(db, 'background_tasks', taskId));
            this.stopListening(taskId);
        } catch (error) { }
    }

    cleanup(): void {
        this.listeners.forEach((u) => { if (typeof u === 'function') u(); });
        this.listeners.clear();
    }
}

export const backgroundTaskService = new BackgroundTaskService();
