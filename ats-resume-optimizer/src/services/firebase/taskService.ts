import {
    collection,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';
import { db, auth } from './config';
import { AnalysisTask, TaskStatus, TaskType } from '../../types/task.types';

export class TaskService {
    private collectionName = 'analysis_tasks';

    private get tasksCollection() {
        return collection(db, this.collectionName);
    }

    /**
     * Create a new task and add to queue
     */
    async createTask(type: TaskType, payload: any): Promise<string> {
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

        const docRef = await addDoc(this.tasksCollection, taskData);
        console.log(`[TaskService] Task created successfully. ID: ${docRef.id}`);
        return docRef.id;
    }

    /**
     * Update task progress
     */
    async updateProgress(taskId: string, progress: number, stage: string) {
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
            console.log(`[TaskService] updateProgress: Successfully updated task ${taskId} to ${progress}%`);
        } catch (error: any) {
            if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
                console.warn(`[TaskService] Task ${taskId} was deleted (permission denied during update).`);
                throw new Error(`Task ${taskId} no longer exists`);
            }
            if (error?.message?.includes('no longer exists')) {
                // Determine if this was the error we threw ourselves
                // If so, just rethrow it without logging error
                throw error;
            }
            console.error(`[TaskService] Error updating task ${taskId}:`, error);
            throw error;
        }
    }

    /**
     * Get a task by ID (returns null if not found)
     */
    async getTask(taskId: string): Promise<AnalysisTask | null> {
        const docRef = doc(db, this.collectionName, taskId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
            return null;
        }
        return { id: snap.id, ...snap.data() } as AnalysisTask;
    }

    /**
     * Mark task as completed
     */
    async completeTask(taskId: string, resultId: string) {
        const docRef = doc(db, this.collectionName, taskId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            console.warn(`[TaskService] Cannot complete task: Task ${taskId} no longer exists.`);
            return;
        }

        await updateDoc(docRef, {
            status: 'completed',
            progress: 100,
            stage: 'Completed',
            resultId,
            updatedAt: serverTimestamp()
        });
    }

    /**
     * Mark task as failed
     */
    async failTask(taskId: string, error: string) {
        const docRef = doc(db, this.collectionName, taskId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            console.warn(`[TaskService] Cannot mark task as failed: Task ${taskId} no longer exists.`);
            return;
        }

        await updateDoc(docRef, {
            status: 'failed',
            error,
            updatedAt: serverTimestamp()
        });
    }

    /**
     * Delete a task
     */
    async deleteTask(taskId: string) {
        console.log(`[TaskService] Attempting to delete task: ${taskId}`);
        const docRef = doc(db, this.collectionName, taskId);

        const snap = await getDoc(docRef);
        if (!snap.exists()) {
            console.warn(`[TaskService] Cannot delete task: Task ${taskId} does not exist.`);
            return;
        }

        const data = snap.data();
        if (data?.userId !== auth.currentUser?.uid) {
            throw new Error("Unauthorized: Cannot delete another user's task");
        }

        await deleteDoc(docRef);
        console.log(`[TaskService] Successfully deleted task: ${taskId}`);
    }

    /**
     * Subscribe to a specific task (by ID)
     */
    subscribeToTask(taskId: string, callback: (task: AnalysisTask) => void, onError?: (error: any) => void) {
        const docRef = doc(db, this.collectionName, taskId);
        return onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const task = {
                    id: docSnap.id,
                    ...data,
                    createdAt: (data?.createdAt as any)?.toDate ? (data.createdAt as any).toDate() : new Date(),
                    updatedAt: (data?.updatedAt as any)?.toDate ? (data.updatedAt as any).toDate() : new Date(),
                    payload: data?.payload ? JSON.parse(data.payload) : {}
                } as AnalysisTask;
                callback(task);
            } else {
                console.log(`[TaskService] Task ${taskId} no longer exists (likely cancelled)`);
                const cancelledTask = {
                    id: taskId,
                    status: 'cancelled',
                    error: 'Task was cancelled by user',
                    progress: 0,
                    stage: 'Cancelled'
                } as AnalysisTask;
                callback(cancelledTask);
            }
        }, (error) => {
            const errorCode = (error as any)?.code || '';
            if (errorCode === 'permission-denied' || errorCode.includes('permission')) {
                console.log(`[TaskService] Task ${taskId} subscription ended (permission denied - likely deleted)`);
                const cancelledTask = {
                    id: taskId,
                    status: 'cancelled',
                    error: 'Task was cancelled by user',
                    progress: 0,
                    stage: 'Cancelled'
                } as AnalysisTask;
                callback(cancelledTask);
            } else {
                console.error(`[TaskService] Subscription error for task ${taskId}:`, error);
                if (onError) onError(error);
            }
        });
    }

    /**
     * Subscribe to active tasks for the current user
     */
    subscribeToActiveTasks(callback: (tasks: AnalysisTask[]) => void, onError?: (error: any) => void) {
        const user = auth.currentUser;
        if (!user) return () => { };
        const userId = user.uid;

        const q = query(
            this.tasksCollection,
            where('userId', '==', userId),
            orderBy('updatedAt', 'desc'),
            limit(10)
        );

        return onSnapshot(q, (snapshot) => {
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
        }, (error) => {
            if (onError) onError(error);
            else console.error(`[TaskService] Active Tasks subscription error:`, error);
        });
    }

    /**
     * Subscribe to queued tasks only (for Worker execution)
     */
    subscribeToQueuedTasks(callback: (tasks: AnalysisTask[]) => void, onError?: (error: any) => void) {
        const user = auth.currentUser;
        if (!user) return () => { };

        const q = query(
            this.tasksCollection,
            where('userId', '==', user.uid),
            where('status', '==', 'queued')
        );

        return onSnapshot(q, (snapshot) => {
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
        }, (error) => {
            if (onError) onError(error);
            else console.error(`[TaskService] Queued Tasks subscription error:`, error);
        });
    }
}

export const taskService = new TaskService();
