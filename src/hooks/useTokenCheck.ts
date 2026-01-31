import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useProfileStore } from '../store/profileStore';

export const useTokenCheck = () => {
    const { userProfile } = useProfileStore();
    const router = useRouter();

    /**
     * Check if user has enough tokens
     * @param required - Number of tokens required
     * @param onDismissModal - Optional callback to dismiss any open modal before showing alert
     * @returns true if user has enough tokens, false otherwise
     */
    const checkTokens = (required: number = 1, onDismissModal?: () => void): boolean => {
        if (!userProfile) return false;

        if (userProfile.tokenBalance < required) {
            const handleAddTokens = () => {
                if (onDismissModal) onDismissModal();
                router.push('/purchase');
            };

            Alert.alert(
                "Credits Expired",
                "You have run out of tokens. Further activities will be disabled until you add more tokens.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Add Tokens",
                        onPress: handleAddTokens
                    }
                ]
            );
            return false;
        }
        return true;
    };

    return { checkTokens, tokenBalance: userProfile?.tokenBalance || 0 };
};
