import {
    collection,
    doc,
    setDoc,
    onSnapshot,
    serverTimestamp,
    Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from './config';

export type BackgroundTaskType = 'optimize_resume' | 'add_skill' | 'prep_guide' | 'cover_letter';

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

type TaskCallback = (task: BackgroundTask) => void;

class BackgroundTaskService {
    private listeners: Map<string, Unsubscribe> = new Map();

    /**
     * Create a background task and start listening for its completion
     * This is the "fire and forget" pattern - the Cloud Function will pick it up automatically
     *
     * @param type - The type of background task
     * @param payload - The data needed for the task
     * @param onComplete - Callback when task completes successfully
     * @param onError - Callback when task fails
     * @returns The task ID
     */
    async createTask(
        type: BackgroundTaskType,
        payload: any,
        onComplete?: TaskCallback,
        onError?: TaskCallback
    ): Promise<string> {
        const user = auth.currentUser;
        if (!user) throw new Error('User not authenticated');

        const taskId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const taskRef = doc(collection(db, 'background_tasks'), taskId);

        const taskData = {
            id: taskId,
            type,
            status: 'pending',
            userId: user.uid,
            payload,
            createdAt: serverTimestamp(),
        };

        console.log(`[BackgroundTaskService] Creating task ${taskId} of type ${type}`);

        // Create the task document - this will trigger the Cloud Function
        await setDoc(taskRef, taskData);

        // Start listening for task completion
        if (onComplete || onError) {
            this.listenToTask(taskId, onComplete, onError);
        }

        return taskId;
    }

    /**
     * Listen to a task's status changes
     */
    listenToTask(
        taskId: string,
        onComplete?: TaskCallback,
        onError?: TaskCallback
    ): Unsubscribe {
        // Clean up any existing listener for this task
        if (this.listeners.has(taskId)) {
            this.listeners.get(taskId)!();
            this.listeners.delete(taskId);
        }

        const taskRef = doc(db, 'background_tasks', taskId);

        const unsubscribe = onSnapshot(taskRef, (snapshot) => {
            if (!snapshot.exists()) return;

            const data = snapshot.data();
            const task: BackgroundTask = {
                id: taskId,
                type: data.type,
                status: data.status,
                payload: data.payload,
                result: data.result,
                error: data.error,
                createdAt: data.createdAt?.toDate() || new Date(),
                startedAt: data.startedAt?.toDate(),
                completedAt: data.completedAt?.toDate(),
                failedAt: data.failedAt?.toDate(),
            };

            console.log(`[BackgroundTaskService] Task ${taskId} status: ${task.status}`);

            if (task.status === 'completed') {
                console.log(`[BackgroundTaskService] Task ${taskId} completed successfully`);
                if (onComplete) onComplete(task);
                // Clean up listener
                this.stopListening(taskId);
            } else if (task.status === 'failed') {
                // Check if this is a cancellation-related error
                const isCancellationError = task.error?.includes('NOT_FOUND') ||
                    task.error?.includes('no longer exists') ||
                    task.error?.includes('cancelled by user') ||
                    task.error?.includes('Task cancelled');
                if (isCancellationError) {
                    console.log(`[BackgroundTaskService] Task ${taskId} was cancelled.`);
                } else {
                    console.error(`[BackgroundTaskService] Task ${taskId} failed: ${task.error}`);
                }
                if (onError) onError(task);
                // Clean up listener
                this.stopListening(taskId);
            }
        }, (error) => {
            console.error(`[BackgroundTaskService] Error listening to task ${taskId}:`, error);
            if (onError) {
                onError({
                    id: taskId,
                    type: 'optimize_resume', // placeholder
                    status: 'failed',
                    payload: {},
                    error: error.message,
                    createdAt: new Date(),
                });
            }
        });

        this.listeners.set(taskId, unsubscribe);
        return unsubscribe;
    }

    /**
     * Stop listening to a task
     */
    stopListening(taskId: string): void {
        if (this.listeners.has(taskId)) {
            this.listeners.get(taskId)!();
            this.listeners.delete(taskId);
            console.log(`[BackgroundTaskService] Stopped listening to task ${taskId}`);
        }
    }

    /**
     * Cancel a background task by deleting the document
     * This will cause the Cloud Function to fail when it tries to update the task
     */
    async cancelTask(taskId: string): Promise<void> {
        try {
            const { deleteDoc } = await import('firebase/firestore');
            const taskRef = doc(db, 'background_tasks', taskId);
            await deleteDoc(taskRef);
            this.stopListening(taskId);
            console.log(`[BackgroundTaskService] Cancelled and deleted task ${taskId}`);
        } catch (error: any) {
            console.warn(`[BackgroundTaskService] Could not delete task ${taskId}:`, error.message);
        }
    }

    /**
     * Get the active background task ID for a given analysis task
     * Returns the task ID if found, null otherwise
     */
    getActiveTaskIdForAnalysis(analysisTaskId: string): string | null {
        // Check all active listeners for a task that matches this analysis task
        for (const [taskId] of this.listeners) {
            if (taskId.includes('optimize_resume') || taskId.includes('add_skill')) {
                // The task ID format is: type_timestamp_random
                // We can't directly map to analysisTaskId, so we return the first active one
                return taskId;
            }
        }
        return null;
    }

    /**
     * Stop all listeners
     */
    cleanup(): void {
        this.listeners.forEach((unsubscribe, taskId) => {
            unsubscribe();
            console.log(`[BackgroundTaskService] Cleaned up listener for ${taskId}`);
        });
        this.listeners.clear();
    }
}

export const backgroundTaskService = new BackgroundTaskService();
