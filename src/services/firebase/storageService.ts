// Firebase Storage temporarily disabled due to Xcode 16 + New Architecture compatibility issues
// Profile photo uploads will use base64 encoding stored in Firestore instead

import { doc, updateDoc } from 'firebase/firestore';
import { db } from './config';
import * as FS from 'expo-file-system/legacy';
const FileSystem = FS as any;

export class StorageService {

    /**
     * Upload a profile photo for a user
     * Uses base64 encoding stored in Firestore as a workaround
     * @param uid User ID
     * @param uri Local file URI
     * @returns Base64 data URL (stored in Firestore)
     */
    async uploadProfilePhoto(uid: string, uri: string): Promise<string> {
        try {
            // Read file as base64
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: 'base64',
            });

            // Create data URL
            const dataUrl = `data:image/jpeg;base64,${base64}`;

            // Store in user profile document
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, {
                photoBase64: dataUrl,
                photoURL: dataUrl, // For compatibility
            });

            return dataUrl;
        } catch (error) {
            console.error("Error uploading profile photo:", error);
            throw error;
        }
    }
}

export const storageService = new StorageService();
