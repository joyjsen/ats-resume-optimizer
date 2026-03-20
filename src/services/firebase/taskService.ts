import { getFirestoreDb, getFirebaseAuth } from './config';
import type { AnalysisTask, TaskStatus, TaskType } from '../../types/task.types';

export class TaskService {
    private collectionName = 'analysis_tasks';

    private async getTasksCollection() {
        const { collection } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        return collection(db, this.collectionName);
    }

    /**
     * Create a new task and add to queue
     */
    async createTask(type: TaskType, payload: any): Promise<string> {
        const { addDoc, serverTimestamp } = await import('firebase/firestore');
        const auth = await getFirebaseAuth();
        const user = auth.currentUser;
        if (!user) throw new Error("User must be authenticated to create tasks");
        const userId = user.uid;

        console.log(`[TaskService] Creating task of type: ${type}`);

        const taskData = {
            userId,
            type,
            status: 'queued' as TaskStatus,
            progress: 0,
            stage: 'Pending...',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            payload: JSON.stringify(payload)
        };

        const tasksColl = await this.getTasksCollection();
        const docRef = await addDoc(tasksColl, taskData);

        console.log(`[TaskService] Task created successfully. ID: ${docRef.id}`);
        return docRef.id;
    }

    /**
     * Update task progress
     */
    async updateProgress(taskId: string, progress: number, stage: string) {
        const { doc, getDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        const docRef = doc(db, this.collectionName, taskId);

        try {
            const snap = await getDoc(docRef);
            if (!snap.exists()) {
                console.warn(`[TaskService] Cannot update progress: Task ${taskId} no longer exists.`);
                throw new Error(`Task ${taskId} no longer exists`);
            }

            await updateDoc(docRef, {
                progress,
                stage,
                status: 'processing',
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
                throw new Error(`Task ${taskId} no longer exists`);
            }
            throw error;
        }
    }

    /**
     * Get a task by ID
     */
    async getTask(taskId: string): Promise<AnalysisTask | null> {
        const { doc, getDoc } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        const docRef = doc(db, this.collectionName, taskId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as AnalysisTask;
    }

    async completeTask(taskId: string, resultId: string) {
        const { doc, getDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        const docRef = doc(db, this.collectionName, taskId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) return;

        await updateDoc(docRef, {
            status: 'completed',
            progress: 100,
            stage: 'Completed',
            resultId,
            updatedAt: serverTimestamp()
        });
    }

    async failTask(taskId: string, error: string) {
        const { doc, getDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        const docRef = doc(db, this.collectionName, taskId);
        try {
            const snap = await getDoc(docRef);
            if (!snap.exists()) return;
            await updateDoc(docRef, { status: 'failed', error, updatedAt: serverTimestamp() });
        } catch (e: any) { }
    }

    async deleteTask(taskId: string) {
        const { doc, getDoc, deleteDoc } = await import('firebase/firestore');
        const db = await getFirestoreDb();
        const auth = await getFirebaseAuth();
        const docRef = doc(db, this.collectionName, taskId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;

        const data = snap.data();
        if (data?.userId !== auth.currentUser?.uid) throw new Error("Unauthorized");

        await deleteDoc(docRef);
    }

    async subscribeToTask(taskId: string, callback: (task: AnalysisTask) => void, onError?: (error: any) => void) {
        let unsub: (() => void) | undefined;
        const init = async () => {
            const { doc, onSnapshot } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const docRef = doc(db, this.collectionName, taskId);
            unsub = onSnapshot(docRef, (docSnap: any) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    callback({
                        id: docSnap.id,
                        ...data,
                        createdAt: (data?.createdAt as any)?.toDate?.() || new Date(),
                        updatedAt: (data?.updatedAt as any)?.toDate?.() || new Date(),
                        payload: data?.payload ? JSON.parse(data.payload) : {}
                    } as AnalysisTask);
                } else {
                    callback({ id: taskId, status: 'cancelled', error: 'Cancelled', progress: 0, stage: 'Cancelled' } as AnalysisTask);
                }
            }, (error: any) => {
                const errorCode = error?.code || '';
                if (errorCode === 'permission-denied' || errorCode.includes('permission')) {
                    callback({ id: taskId, status: 'cancelled', error: 'Cancelled', progress: 0, stage: 'Cancelled' } as AnalysisTask);
                } else if (onError) onError(error);
            });
        };
        const promise = init();
        return () => { promise.then(() => unsub?.()); };
    }

    async subscribeToActiveTasks(callback: (tasks: AnalysisTask[]) => void, onError?: (error: any) => void) {
        let unsub: (() => void) | undefined;
        const init = async () => {
            const { query, where, orderBy, limit, onSnapshot } = await import('firebase/firestore');
            const auth = await getFirebaseAuth();
            const user = auth.currentUser;
            if (!user) return;

            const tasksColl = await this.getTasksCollection();
            const q = query(tasksColl, where('userId', '==', user.uid), orderBy('updatedAt', 'desc'), limit(10));

            unsub = onSnapshot(q, (snapshot: any) => {
                const tasks = snapshot.docs.map(docSnap => {
                    const data = docSnap.data();
                    return {
                        id: docSnap.id,
                        ...data,
                        createdAt: (data?.createdAt as any)?.toDate ? (data.createdAt as any).toDate() : new Date(),
                        updatedAt: (data?.updatedAt as any)?.toDate ? (data.updatedAt as any).toDate() : new Date(),
                        payload: data.payload ? JSON.parse(data.payload) : {}
                    } as AnalysisTask;
                });
                callback(tasks);
            }, (error: any) => {
                if (onError) onError(error);
            });
        };
        const promise = init();
        return () => { promise.then(() => unsub?.()); };
    }

    async subscribeToQueuedTasks(callback: (tasks: AnalysisTask[]) => void, onError?: (error: any) => void) {
        let unsub: (() => void) | undefined;
        const init = async () => {
            const { query, where, onSnapshot } = await import('firebase/firestore');
            const auth = await getFirebaseAuth();
            const user = auth.currentUser;
            if (!user) return;

            const tasksColl = await this.getTasksCollection();
            const q = query(tasksColl, where('userId', '==', user.uid), where('status', '==', 'queued'));

            unsub = onSnapshot(q, (snapshot: any) => {
                const tasks = snapshot.docs.map(docSnap => {
                    const data = docSnap.data();
                    return {
                        id: docSnap.id,
                        ...data,
                        createdAt: (data?.createdAt as any)?.toDate?.() || new Date(),
                        updatedAt: (data?.updatedAt as any)?.toDate?.() || new Date(),
                        payload: data.payload ? JSON.parse(data.payload) : {}
                    } as AnalysisTask;
                });
                callback(tasks);
            }, (error: any) => {
                if (onError) onError(error);
            });
        };
        const promise = init();
        return () => { promise.then(() => unsub?.()); };
    }
}

export const taskService = new TaskService();
