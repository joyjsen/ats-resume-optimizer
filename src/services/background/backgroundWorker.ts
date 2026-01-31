import { Platform, AppState, AppStateStatus } from 'react-native';
import { notificationService } from '../firebase/notificationService';

let BackgroundService: any = null;

try {
    if (Platform.OS !== 'web') {
        BackgroundService = require('react-native-background-actions').default;
    }
} catch (e) {
    console.warn('[BackgroundWorker] native module not available');
}

const options = {
    taskName: 'AIAnalysisTask',
    taskTitle: 'ATS Resume Optimizer',
    taskDesc: 'Processing in background...',
    taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
    },
    color: '#6200ee',
    linkingURI: '',
    parameters: {
        delay: 1000,
    },
    // Android-specific: Keep service in foreground
    progressBar: {
        max: 100,
        value: 0,
        indeterminate: true,
    },
};

/**
 * BackgroundWorker - Manages background task execution
 *
 * IMPORTANT: Due to iOS limitations, JavaScript execution can be suspended
 * when the app is backgrounded. This worker provides best-effort background
 * execution but tasks may pause and resume when the app returns to foreground.
 */
export class BackgroundWorker {
    private static isRunning = false;
    private static currentTask: (() => Promise<void>) | null = null;
    private static currentResolve: (() => void) | null = null;
    private static currentReject: ((error: any) => void) | null = null;
    private static appStateSubscription: any = null;
    private static lastActiveTime: number = Date.now();
    private static heartbeatInterval: any = null;
    private static keepAliveInterval: any = null;
    private static isCancelled = false;

    /**
     * Initialize the background worker - call this at app startup
     */
    static initialize(): void {
        // Listen to app state changes to detect when app comes back to foreground
        if (!this.appStateSubscription) {
            this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
            console.log('[BackgroundWorker] Initialized app state listener');
        }
    }

    /**
     * Handle app state changes
     */
    private static backgroundTimeout: any = null;

    /**
     * Handle app state changes
     */
    private static handleAppStateChange(nextAppState: AppStateStatus): void {
        console.log(`[BackgroundWorker] App state changed to: ${nextAppState}`);

        if (nextAppState === 'active') {
            // App came back to foreground
            const timeSuspended = Date.now() - this.lastActiveTime;
            console.log(`[BackgroundWorker] App active after ${timeSuspended}ms`);

            // Clear any pending background warning
            if (this.backgroundTimeout) {
                console.log('[BackgroundWorker] Clearing pending background warning');
                clearTimeout(this.backgroundTimeout);
                this.backgroundTimeout = null;
            }

            // If we have a running task and it's been more than 5 seconds,
            // the task might have been suspended - it should continue automatically
            if (this.isRunning && timeSuspended > 5000) {
                console.log('[BackgroundWorker] App returned from background. Task continues.');
            }
        } else if (nextAppState === 'background') {
            this.lastActiveTime = Date.now();
            console.log('[BackgroundWorker] App going to background');

            // Warn user if task is running
            if (this.isRunning) {
                // Feature Change: "Rewrite & Optimize Resume", "Skill Addition", "Prep Guide", "Cover Letter" 
                // should NOT pause or warn. They should just continue processing.
                const allowedBackgroundTasks = ['optimize_resume', 'add_skill', 'prep_guide', 'cover_letter', 'resume_optimization'];

                if (allowedBackgroundTasks.includes(this.currentTaskType || '')) {
                    console.log(`[BackgroundWorker] Task ${this.currentTaskType} is allowed to run in background. No warning.`);
                    // No warning scheduled. The background service (keep-alive) will handle it.
                } else {
                    // Immediate warning for other tasks (like initial analysis if not safe)
                    console.log('[BackgroundWorker] Sending immediate background warning for non-background task...');
                    notificationService.notifyBackgroundWarning().catch(e => console.warn(e));
                }
            }
        }
    }

    /**
     * Start a task with background execution support
     */
    private static currentTaskId: string | null = null;
    private static currentTaskType: string | null = null;

    /**
     * Start a task with background execution support
     */
    static async start(task: () => Promise<void>, taskId?: string, taskType?: string): Promise<void> {
        console.log('[BackgroundWorker] Starting task...');

        // If already running, just execute the task directly
        // (react-native-background-actions only supports one task at a time)
        if (this.isRunning) {
            console.log('[BackgroundWorker] Already running, executing task directly');
            return task();
        }

        return new Promise<void>(async (resolve, reject) => {
            this.currentTaskId = taskId || null;
            this.currentTaskType = taskType || null;
            this.currentTask = task;
            this.currentResolve = resolve;
            this.currentReject = reject;
            this.isRunning = true;
            this.isCancelled = false; // Reset cancellation flag for new task

            // Start heartbeat to keep track of execution
            this.startHeartbeat();

            if (BackgroundService && Platform.OS !== 'web') {
                try {
                    console.log(`[BackgroundWorker] Starting background service for task ${taskId || 'unknown'}...`);

                    await BackgroundService.start(async () => {
                        console.log('[BackgroundWorker] Inside background service callback');

                        try {
                            // Execute the actual task
                            await this.executeWithKeepAlive(task);
                            console.log('[BackgroundWorker] Task completed successfully');
                            resolve();
                        } catch (error: any) {
                            console.error('[BackgroundWorker] Task failed:', error);
                            reject(error);
                        } finally {
                            this.cleanup();
                        }
                    }, options);

                } catch (serviceError: any) {
                    console.error('[BackgroundWorker] Failed to start background service:', serviceError);
                    // Fallback: run task directly without background service
                    try {
                        await task();
                        resolve();
                    } catch (taskError) {
                        reject(taskError);
                    } finally {
                        this.cleanup();
                    }
                }
            } else {
                // No background service available, run directly
                console.log('[BackgroundWorker] No background service, running directly');
                try {
                    await task();
                    resolve();
                } catch (error) {
                    reject(error);
                } finally {
                    this.cleanup();
                }
            }
        });
    }

    /**
     * Execute task with periodic keep-alive pings
     */
    private static async executeWithKeepAlive(task: () => Promise<void>): Promise<void> {
        // Create a keep-alive mechanism that pings periodically
        let keepAliveCount = 0;
        this.keepAliveInterval = setInterval(async () => {
            if (this.isCancelled) {
                console.log('[BackgroundWorker] Keep-alive detected cancellation, stopping pings.');
                if (this.keepAliveInterval) {
                    clearInterval(this.keepAliveInterval);
                    this.keepAliveInterval = null;
                }
                return;
            }
            keepAliveCount++;
            console.log(`[BackgroundWorker] Keep-alive ping #${keepAliveCount}`);

            // Update notification to show progress
            try {
                if (BackgroundService) {
                    await BackgroundService.updateNotification({
                        taskDesc: `Processing... (${keepAliveCount * 5}s elapsed)`,
                    });
                }
            } catch (e) {
                // Ignore update errors
            }
        }, 5000);

        try {
            await task();
        } finally {
            if (this.keepAliveInterval) {
                clearInterval(this.keepAliveInterval);
                this.keepAliveInterval = null;
            }
        }
    }

    /**
     * Start heartbeat interval
     */
    private static startHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(() => {
            if (this.isRunning) {
                console.log('[BackgroundWorker] Heartbeat - task still running');
            }
        }, 10000);
    }

    /**
     * Cleanup after task completion
     */
    private static async cleanup(): Promise<void> {
        console.log('[BackgroundWorker] Cleaning up...');

        this.isRunning = false;
        this.isCancelled = true; // Signal to any running loops to stop
        this.currentTaskId = null;
        this.currentTaskType = null;
        this.currentTask = null;
        this.currentResolve = null;
        this.currentReject = null;

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }

        try {
            if (BackgroundService) {
                await BackgroundService.stop();
                console.log('[BackgroundWorker] Background service stopped');
            }
        } catch (e) {
            console.error('[BackgroundWorker] Error stopping service:', e);
        }

        // Reset cancellation flag after cleanup is complete
        this.isCancelled = false;
    }

    /**
     * Update the notification progress text
     */
    static async updateProgress(progressText: string): Promise<void> {
        if (!this.isRunning || !BackgroundService) return;
        try {
            await BackgroundService.updateNotification({
                taskDesc: progressText,
            });
        } catch (e) {
            // Ignore errors
        }
    }

    /**
     * Check if the background service is currently running
     */
    static isActive(): boolean {
        return this.isRunning;
    }

    /**
     * Force stop any running task
     */
    static async forceStop(): Promise<void> {
        if (this.currentReject) {
            this.currentReject(new Error('Task was force stopped'));
        }
        await this.cleanup();
    }

    static getCurrentTaskId(): string | null {
        return this.currentTaskId;
    }
}

// Initialize on module load
BackgroundWorker.initialize();
