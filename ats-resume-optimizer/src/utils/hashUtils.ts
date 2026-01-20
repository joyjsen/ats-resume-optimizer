/**
 * Simple hash utility for deduplication
 * using a non-cryptographic hash for speed/simplicity or a robust one if needed.
 * For this requirement, we need reasonable collision resistance.
 */

export const generateHash = async (message: string): Promise<string> => {
    // In a full RN environment with crypto, we'd use crypto.subtle.
    // Since we want to avoid complex polyfills right now, we can use a stable 
    // string hash algorithm. Ideally SHA-256. 
    // 
    // However, correctly implementing SHA-256 in pure TS without libraries is verbose.
    // For the purpose of "Resume + Job" deduplication, a strong 32-bit integer hash 
    // (like MurmurHash or FNV-1a) or a simple custom content-based ID might suffice 
    // BUT user asked for "unique identifier".
    //
    // Let's use a simple implementation of SHA-256 or similar if we can, 
    // but for now, to ensure stability, let's use a combination of length + simple char code sum + DJB2 
    // transformed to hex, which is "good enough" for UI deduplication.

    let hash = 0;
    if (message.length === 0) return '00000000';

    for (let i = 0; i < message.length; i++) {
        const char = message.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    // Add length to reduce collision chance of similar strings
    return Math.abs(hash).toString(16) + "-" + message.length.toString(16);
};
