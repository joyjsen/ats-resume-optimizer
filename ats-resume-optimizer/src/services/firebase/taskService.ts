import {
    collection,
    addDoc,
    doc,
    updateDoc,
    onSnapshot,
    query,
    where,
    Timestamp,
    orderBy
} from 'firebase/firestore';
import { db, auth } from './config';
import { AnalysisTask, TaskStatus, TaskType } from '../../types/task.types';

export class TaskService {
    private collectionName = 'analysis_tasks';

    /**
     * Create a new task and add to queue
     */
    async createTask(type: TaskType, payload: any): Promise<string> {
        const user = auth.currentUser;
        const userId = user?.uid || 'anonymous_user';

        const taskData = {
            userId,
            type,
            status: 'queued',
            progress: 0,
            stage: 'Pending...',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            payload: JSON.stringify(payload) // Store complex objects as JSON string
        };

        const docRef = await addDoc(collection(db, this.collectionName), taskData);
        return docRef.id;
    }

    /**
     * Update task progress
     */
    async updateProgress(taskId: string, progress: number, stage: string) {
        const docRef = doc(db, this.collectionName, taskId);
        await updateDoc(docRef, {
            progress,
            stage,
            status: 'processing',
            updatedAt: Timestamp.now()
        });
    }

    /**
     * Mark task as completed
     */
    async completeTask(taskId: string, resultId: string) {
        const docRef = doc(db, this.collectionName, taskId);
        await updateDoc(docRef, {
            status: 'completed',
            progress: 100,
            stage: 'Completed',
            resultId,
            updatedAt: Timestamp.now()
        });
    }

    /**
     * Mark task as failed
     */
    async failTask(taskId: string, error: string) {
        const docRef = doc(db, this.collectionName, taskId);
        await updateDoc(docRef, {
            status: 'failed',
            error,
            updatedAt: Timestamp.now()
        });
    }

    /**
     * Subscribe to active tasks for the current user
     */
    subscribeToActiveTasks(callback: (tasks: AnalysisTask[]) => void) {
        const user = auth.currentUser;
        const userId = user?.uid || 'anonymous_user';

        // Listen for queued or processing tasks
        const q = query(
            collection(db, this.collectionName),
            where('userId', '==', userId),
            where('status', 'in', ['queued', 'processing']),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const tasks = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate(),
                    updatedAt: data.updatedAt?.toDate(),
                    payload: data.payload ? JSON.parse(data.payload) : {}
                } as AnalysisTask;
            });
            callback(tasks);
        });
    }
}

export const taskService = new TaskService();
