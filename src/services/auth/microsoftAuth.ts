import { Platform } from 'react-native';
import { UserProfile } from '../../types/profile.types';

// NOTE: in a real app, you would use expo-auth-session/providers/microsoft
// import * as Microsoft from 'expo-auth-session/providers/microsoft';

export class MicrosoftAuthService {
    private graphUrl = 'https://graph.microsoft.com/v1.0';

    /**
     * Map Microsoft Graph User to our UserProfile format
     */
    mapGraphUserToProfile(graphUser: any): Partial<UserProfile> {
        return {
            firstName: graphUser.givenName,
            lastName: graphUser.surname,
            email: graphUser.mail || graphUser.userPrincipalName,
            jobTitle: graphUser.jobTitle,
            officeLocation: graphUser.officeLocation,
            microsoftId: graphUser.id,
            // Simple heuristic for account type, though usually requires more claims inspection
            microsoftAccountType: graphUser.jobTitle ? 'work' : 'personal',
        };
    }

    /**
     * Fetch user profile from Microsoft Graph
     * Requires a valid Access Token obtained via expo-auth-session
     */
    async getGraphProfile(accessToken: string): Promise<any> {
        try {
            const response = await fetch(`${this.graphUrl}/me`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Microsoft Graph Error:", error);
            throw error;
        }
    }

    /**
     * Fetch high-res photo
     */
    async getGraphPhoto(accessToken: string): Promise<string | null> {
        try {
            const response = await fetch(`${this.graphUrl}/me/photo/$value`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (response.ok) {
                // In a real app, you'd convert this blob to a base64 string or upload to Firebase Storage
                // and return the public URL.
                // For now, we return null as we can't easily process blobs in this environment without FileReader/Blob polyfills active
                return null;
            }
            return null;
        } catch (error) {
            return null;
        }
    }
}

export const microsoftAuthService = new MicrosoftAuthService();
