// Firebase Storage temporarily disabled due to Xcode 16 + New Architecture compatibility issues
// Profile photo uploads will use base64 encoding stored in Firestore instead

import { doc, updateDoc } from 'firebase/firestore';
import { db } from './config';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

// ARCHITECTURE TODO: Profile photos are stored as base64 data URLs in Firestore.
// This inflates document sizes (100KB-500KB per photo) and increases read costs.
// Migrate to Firebase Storage and store only the download URL in Firestore.
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
            // 1. Resize and compress the image to keep base64 string small for Firestore
            // Profile pictures don't need to be huge. 300x300 is plenty for mobile.
            const manipulatedImage = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 300, height: 300 } }],
                { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            // Create data URL from the manipulated result
            const dataUrl = `data:image/jpeg;base64,${manipulatedImage.base64}`;

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
