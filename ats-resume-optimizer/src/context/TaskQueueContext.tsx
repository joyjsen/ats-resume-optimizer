import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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

    useEffect(() => {
        // Cleanup stale tasks (older than 10 mins) on mount
        const cleanupStaleTasks = async () => {
            const { db } = require('../services/firebase/config');
            const { collection, query, where, getDocs, doc, updateDoc, Timestamp, deleteDoc } = require('firebase/firestore');
            const { auth } = require('../services/firebase/config');

            const user = auth.currentUser;
            if (!user) return;

            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

            // Query for processing/queued tasks created before 10 mins ago
            // Note: complex query might require index. Simple client-side filter is safer for now if list is small.
            const q = query(
                collection(db, 'analysis_tasks'),
                where('userId', '==', user.uid),
                where('status', 'in', ['queued', 'processing'])
            );

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
        };

        cleanupStaleTasks().catch(console.error);

        // Subscribe to my active tasks
        const unsubscribe = taskService.subscribeToActiveTasks((tasks) => {
            setActiveTasks(tasks);
            processQueue(tasks);
        });

        return () => unsubscribe();
    }, []);

    const processQueue = async (tasks: AnalysisTask[]) => {
        // Simple logic: If there's a QUEUED task that is not currently being processed by THIS instance
        // (Note: In a real multi-device scenario, we'd need a 'lockedBy' field in Firestore to avoid double processing.
        // For this single-user-device "background" emulation, we assume we are the only worker for 'queued' tasks created by us.)

        const queuedTasks = tasks.filter(t => t.status === 'queued');

        for (const task of queuedTasks) {
            if (processingRef.current.has(task.id)) continue; // Already picked up

            processingRef.current.add(task.id);

            // Execute in background "thread" (promise)
            executeAnalysisTask(task.id, task.payload, task.type)
                .then(() => {
                    processingRef.current.delete(task.id);
                })
                .catch((error) => {
                    processingRef.current.delete(task.id);
                    // Notify user immediately of failure if they are in the app
                    Alert.alert(
                        "Task Failed",
                        `Optimization for ${(task.payload as any)?.job?.company || 'Job'} failed: ${error?.message || 'Unknown error'}`
                    );
                });
        }
    };

    return (
        <TaskQueueContext.Provider value={{ activeTasks }}>
            {children}
        </TaskQueueContext.Provider>
    );
};
