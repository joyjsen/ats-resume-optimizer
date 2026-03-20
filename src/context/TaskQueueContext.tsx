import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import { Alert } from 'react-native';
// type-only imports
import type { AnalysisTask } from '../types/task.types';


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
        const { getFirestoreDb: localGetFirestoreDb, getFirebaseAuth: localGetFirebaseAuth } = await import('../services/firebase/config');
        const db = await localGetFirestoreDb();
        const auth = await localGetFirebaseAuth();
        const { collection, query, where, getDocs, doc, updateDoc, Timestamp } = await import('firebase/firestore');


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
        let unsubscribeAuth: (() => void) | undefined;

        const init = async () => {
            const { onAuthStateChanged } = await import('firebase/auth');
            const { getFirebaseAuth } = await import('../services/firebase/config');
            const auth = await getFirebaseAuth();
            const { taskService } = await import('../services/firebase/taskService');
            const localTaskService = taskService;

            unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
                // Clear existing subscriptions on auth change
                subscriptionsRef.current.forEach(unsub => unsub());
                subscriptionsRef.current = [];

                if (user) {
                    console.log("[TaskQueue] User logged in, setting up subscriptions...");
                    cleanupStaleTasks().catch(console.error);

                    // 1. Subscribe to Active Tasks (UI optimization)
                    const subActive = await localTaskService.subscribeToActiveTasks((tasks: AnalysisTask[]) => {
                        console.log(`[TaskQueue] UI Subscription update: ${tasks.length} active tasks.`);
                        setActiveTasks(tasks);
                    }, (error: any) => {
                        const errorCode = error?.code || '';
                        if (errorCode !== 'permission-denied' && !errorCode.includes('permission')) {
                            console.error("[TaskQueue] UI Subscription Error:", error);
                        }
                    });
                    subscriptionsRef.current.push(subActive);

                    // 2. Subscribe to Queued Tasks
                    const subQueued = await localTaskService.subscribeToQueuedTasks((tasks: AnalysisTask[]) => {
                        console.log(`[TaskQueue] Worker Subscription update: ${tasks.length} queued tasks.`);
                        processQueue(tasks);
                    }, (error: any) => {
                        const errorCode = error?.code || '';
                        if (errorCode !== 'permission-denied' && !errorCode.includes('permission')) {
                            console.error("[TaskQueue] Worker Subscription Error:", error);
                        }
                    });
                    subscriptionsRef.current.push(subQueued);


                } else {
                    console.log("[TaskQueue] User logged out, cleared tasks.");
                    setActiveTasks([]);
                }
            });
        };

        const initPromise = init();

        return () => {
            initPromise.then(() => {
                if (unsubscribeAuth) unsubscribeAuth();
                subscriptionsRef.current.forEach(unsub => unsub());
                subscriptionsRef.current = [];
            });
        };
    }, []);

    const isProcessingQueueRef = useRef(false);

    const processQueue = async (tasks: AnalysisTask[]) => {
        if (isProcessingQueueRef.current) {
            console.log("[TaskQueue] Queue processing already in progress, skipping.");
            return;
        }
        isProcessingQueueRef.current = true;

        try {
            const queuedTasks = tasks.filter(t => t.status === 'queued');

            if (queuedTasks.length > 0) {
                console.log(`[TaskQueue] ${queuedTasks.length} queued tasks found.`);
            }

            for (const task of queuedTasks) {
                if (processingRef.current.has(task.id)) {
                    console.log(`[TaskQueue] Task ${task.id} is already being processed (Set check).`);
                    continue;
                }

                console.log(`[TaskQueue] Locking & Starting execution for task: ${task.id} (${task.type})`);
                processingRef.current.add(task.id);

                // Execute in background "thread" (promise)
                const executeTask = async () => {
                    const { BackgroundWorker: localBackgroundWorker } = await import('../services/background/backgroundWorker');
                    const { executeAnalysisTask: localExecuteAnalysisTask } = await import('../workers/analysisWorker');
                    // Start background service if not already running
                    await localBackgroundWorker.start(async () => {
                        try {
                            await localExecuteAnalysisTask(task.id, task.payload, task.type);


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
                            console.log(`[TaskQueue] Unlocking task: ${task.id}`);
                            processingRef.current.delete(task.id);
                        }
                    }, task.id, task.type); // Pass taskId and taskType
                };

                // Trigger execution but don't await the result (fire and forget)
                // However, we DO want to ensure the loop continues synchronously to lock subsequent tasks
                executeTask().catch(e => {
                    if (e.message !== 'Task was force stopped' && !e.message?.includes('NOT_FOUND')) {
                        console.error("[TaskQueue] Background Task Launcher Exception:", e);
                    }
                    processingRef.current.delete(task.id);
                });
            }
        } finally {
            isProcessingQueueRef.current = false;
        }
    };

    // Monitor for cancellation of currently running task
    useEffect(() => {
        let isActive = true;
        const check = async () => {
            const { BackgroundWorker: localBackgroundWorker } = await import('../services/background/backgroundWorker');
            if (!isActive) return;

            const currentId = localBackgroundWorker.getCurrentTaskId();

            if (currentId && activeTasks.length > 0) {
                const isTaskValid = activeTasks.find(t => t.id === currentId && t.status !== 'cancelled' && t.status !== 'failed');
                if (!isTaskValid) {
                    const taskInList = activeTasks.find(t => t.id === currentId);
                    if (taskInList) {
                        if (taskInList.status === 'cancelled' || taskInList.status === 'failed' || taskInList.status === 'completed') {
                            console.log(`[TaskQueue] Detected running task ${currentId} is now ${taskInList.status}. Force stopping worker.`);
                            localBackgroundWorker.forceStop();
                        }
                    } else {
                        console.log(`[TaskQueue] Detected running task ${currentId} is missing from active list. Force stopping worker.`);
                        localBackgroundWorker.forceStop();
                    }
                }
            }
        };

        check().catch(console.error);

        return () => {
            isActive = false;
        };
    }, [activeTasks]);

    const contextValue = useMemo(() => ({ activeTasks }), [activeTasks]);

    return (
        <TaskQueueContext.Provider value={contextValue}>
            {children}
        </TaskQueueContext.Provider>
    );
};
