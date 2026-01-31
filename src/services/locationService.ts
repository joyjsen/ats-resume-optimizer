import * as Location from 'expo-location';
import { LocationData } from '../types/profile.types';

export class LocationService {
    /**
     * Request permissions and get current location with reverse geocoding
     */
    async getCurrentLocation(): Promise<LocationData | null> {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                throw new Error('Permission to access location was denied');
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const { latitude, longitude } = location.coords;

            // Reverse Geocode
            const addressResponse = await Location.reverseGeocodeAsync({ latitude, longitude });

            if (addressResponse && addressResponse.length > 0) {
                const addr = addressResponse[0];
                const formattedAddress = [
                    addr.street,
                    addr.city,
                    addr.region,
                    addr.country
                ].filter(Boolean).join(', ');

                return {
                    latitude,
                    longitude,
                    city: addr.city || '',
                    state: addr.region || '',
                    country: addr.country || '',
                    formattedAddress,
                    lastUpdated: new Date()
                };
            }

            return {
                latitude,
                longitude,
                city: '',
                state: '',
                country: '',
                formattedAddress: `${latitude}, ${longitude}`,
                lastUpdated: new Date()
            };

        } catch (error) {
            console.error("Location Service Error:", error);
            return null;
        }
    }

    async requestPermissions(): Promise<boolean> {
        const { status } = await Location.requestForegroundPermissionsAsync();
        return status === 'granted';
    }
}

export const locationService = new LocationService();
