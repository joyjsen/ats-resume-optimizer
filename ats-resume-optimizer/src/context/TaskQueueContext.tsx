import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import { Alert } from 'react-native';
import { taskService } from '../services/firebase/taskService';
import { AnalysisTask } from '../types/task.types';
import { executeAnalysisTask } from '../workers/analysisWorker';

interface TaskQueueContextType {
    activeTasks: AnalysisTask[];
}

const TaskQueueContext = createContext<TaskQueueContextType>({ activeTasks: [] });

export const useTaskQueue = () => useContext(TaskQueueContext);

export const TaskQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeTasks, setActiveTasks] = useState<AnalysisTask[]>([]);
    const processingRef = useRef<Set<string>>(new Set());

    // Cleanup stale tasks (older than 10 mins)
    const cleanupStaleTasks = async () => {
        const { db } = require('../services/firebase/config');
        const { collection, query, where, getDocs, doc, updateDoc, Timestamp } = require('firebase/firestore');
        const { auth } = require('../services/firebase/config');

        const user = auth.currentUser;
        if (!user) return;

        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        const q = query(
            collection(db, 'analysis_tasks'),
            where('userId', '==', user.uid),
            where('status', 'in', ['queued', 'processing'])
        );

        try {
            const snapshot = await getDocs(q);
            snapshot.forEach(async (d: any) => {
                const data = d.data();
                const createdAt = data.createdAt?.toDate();
                if (createdAt && createdAt < tenMinutesAgo) {
                    console.warn(`Marking stale task ${d.id} as failed.`);
                    await updateDoc(doc(db, 'analysis_tasks', d.id), {
                        status: 'failed',
                        error: 'Task timed out (stale)',
                        updatedAt: Timestamp.now()
                    });
                }
            });
        } catch (e) {
            console.error("Cleanup stale tasks error:", e);
        }
    };

    const subscriptionsRef = useRef<(() => void)[]>([]);

    useEffect(() => {
        const { auth } = require('../services/firebase/config');

        const unsubscribeAuth = auth.onAuthStateChanged((user: any) => {
            // Always cleanup previous subscriptions on auth state change
            subscriptionsRef.current.forEach(unsub => unsub());
            subscriptionsRef.current = [];

            if (user) {
                console.log("[TaskQueue] User authenticated, initializing subscriptions...");
                cleanupStaleTasks().catch(console.error);

                // 1. Subscribe to Active Tasks
                const subActive = taskService.subscribeToActiveTasks((tasks) => {
                    console.log(`[TaskQueue] UI Subscription update: ${tasks.length} tasks.`);
                    setActiveTasks(tasks);
                }, (error) => {
                    // Ignore permission errors during logout transition or when tasks are deleted
                    const errorCode = error?.code || '';
                    if (errorCode !== 'permission-denied' && !errorCode.includes('permission')) {
                        console.error("[TaskQueue] UI Subscription Error:", error);
                    } else {
                        console.log("[TaskQueue] Ignoring permission error (likely logout or deleted task)");
                    }
                });
                subscriptionsRef.current.push(subActive);

                // 2. Subscribe to Queued Tasks
                const subQueued = taskService.subscribeToQueuedTasks((tasks) => {
                    console.log(`[TaskQueue] Worker Subscription update: ${tasks.length} queued tasks.`);
                    processQueue(tasks);
                }, (error) => {
                    // Ignore permission errors during logout transition or when tasks are deleted
                    const errorCode = error?.code || '';
                    if (errorCode !== 'permission-denied' && !errorCode.includes('permission')) {
                        console.error("[TaskQueue] Worker Subscription Error:", error);
                    } else {
                        console.log("[TaskQueue] Ignoring permission error (likely logout or deleted task)");
                    }
                });
                subscriptionsRef.current.push(subQueued);

            } else {
                console.log("[TaskQueue] User logged out, cleared tasks.");
                setActiveTasks([]);
            }
        });

        return () => {
            unsubscribeAuth();
            subscriptionsRef.current.forEach(unsub => unsub());
        };
    }, []);

    const processQueue = async (tasks: AnalysisTask[]) => {
        const queuedTasks = tasks.filter(t => t.status === 'queued');

        if (queuedTasks.length > 0) {
            console.log(`[TaskQueue] ${queuedTasks.length} queued tasks found.`);
        }

        for (const task of queuedTasks) {
            if (processingRef.current.has(task.id)) {
                console.log(`[TaskQueue] Task ${task.id} is already being processed.`);
                continue;
            }

            console.log(`[TaskQueue] Starting execution for task: ${task.id} (${task.type})`);
            processingRef.current.add(task.id);

            // Execute in background "thread" (promise)
            const executeTask = async () => {
                const { BackgroundWorker } = require('../services/background/backgroundWorker');

                // Start background service if not already running
                await BackgroundWorker.start(async () => {
                    try {
                        await executeAnalysisTask(task.id, task.payload, task.type);
                        console.log(`[TaskQueue] Worker finished for task: ${task.id}`);
                    } catch (error: any) {
                        console.error(`[TaskQueue] Worker failed for task: ${task.id}`, error);
                        // Notify user immediately of failure if they are in the app
                        Alert.alert(
                            "Task Failed",
                            `Optimization for ${(task.payload as any)?.job?.company || 'Job'} failed: ${error?.message || 'Unknown error'}`
                        );
                        throw error;
                    } finally {
                        processingRef.current.delete(task.id);
                    }
                }, task.id, task.type); // Pass taskId and taskType
            };

            executeTask().catch(e => {
                if (e.message !== 'Task was force stopped') {
                    console.error("[TaskQueue] Background Task Launcher Exception:", e);
                } else {
                    console.log("[TaskQueue] Task cancellation handled gracefully.");
                }
                processingRef.current.delete(task.id);
            });
        }
    };

    // Monitor for cancellation of currently running task
    useEffect(() => {
        const { BackgroundWorker } = require('../services/background/backgroundWorker');
        const currentId = BackgroundWorker.getCurrentTaskId();

        if (currentId && activeTasks.length > 0) {
            const isTaskValid = activeTasks.find(t => t.id === currentId && t.status !== 'cancelled' && t.status !== 'failed');
            // If the task is running in worker but NOT in active tasks (deleted) OR flagged as cancelled/failed
            if (!isTaskValid) {
                // Double check if it was just completed (completed tasks might stay in activeTasks list for a bit, or might be removed depending on filter)
                // But we only proceed if we are SURE it's gone or cancelled.
                // Note: activeTasks usually returns LIMIT 10 ordered by desc. If it's old it might fall off, but "running" tasks are usually new.
                // Safer check: look for specific cancellation status or TOTAL absence if we trust subscription.

                const taskInList = activeTasks.find(t => t.id === currentId);
                // If it is in list but status is cancelled/failed/completed -> Stop it
                if (taskInList) {
                    if (taskInList.status === 'cancelled' || taskInList.status === 'failed' || taskInList.status === 'completed') {
                        console.log(`[TaskQueue] Detected running task ${currentId} is now ${taskInList.status}. Force stopping worker.`);

                        // Also cancel the background task to stop the Cloud Function
                        const { backgroundTaskService } = require('../services/firebase/backgroundTaskService');
                        const bgTaskId = backgroundTaskService.getActiveTaskIdForAnalysis(currentId);
                        if (bgTaskId) {
                            backgroundTaskService.cancelTask(bgTaskId).catch((e: any) =>
                                console.warn(`[TaskQueue] Could not cancel background task:`, e.message)
                            );
                            backgroundTaskService.stopListening(bgTaskId); // Stop only this listener
                        }

                        BackgroundWorker.forceStop();
                    }
                } else {
                    // Task completely gone from list? Potentially deleted.
                    // This is risky if the list is paginated. But for active tasks we fetch top 10.
                    // If a user has > 10 active tasks, the older running one might be lost.
                    // But assume we don't have > 10 active concurrent tasks.
                    console.log(`[TaskQueue] Detected running task ${currentId} is missing from active list. Force stopping worker.`);

                    // Also cancel the background task to stop the Cloud Function
                    const { backgroundTaskService } = require('../services/firebase/backgroundTaskService');
                    const bgTaskId = backgroundTaskService.getActiveTaskIdForAnalysis(currentId);
                    if (bgTaskId) {
                        backgroundTaskService.cancelTask(bgTaskId).catch((e: any) =>
                            console.warn(`[TaskQueue] Could not cancel background task:`, e.message)
                        );
                        backgroundTaskService.stopListening(bgTaskId); // Stop only this listener
                    }

                    BackgroundWorker.forceStop();
                }
            }
        }
    }, [activeTasks]);

    const contextValue = useMemo(() => ({ activeTasks }), [activeTasks]);

    return (
        <TaskQueueContext.Provider value={contextValue}>
            {children}
        </TaskQueueContext.Provider>
    );
};
