import { getFirestoreDb } from './config';
import * as ImageManipulator from 'expo-image-manipulator';

export class StorageService {
    async uploadProfilePhoto(uid: string, uri: string): Promise<string> {
        try {
            const manipulatedImage = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 300, height: 300 } }],
                { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            const dataUrl = `data:image/jpeg;base64,${manipulatedImage.base64}`;

            const { doc, updateDoc } = await import('firebase/firestore');
            const db = await getFirestoreDb();
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, {
                photoBase64: dataUrl,
                photoURL: dataUrl,
            });

            return dataUrl;
        } catch (error) {
            console.error("Error uploading profile photo:", error);
            throw error;
        }
    }
}

export const storageService = new StorageService();
