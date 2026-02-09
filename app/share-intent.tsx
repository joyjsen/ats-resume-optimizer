import { Redirect } from 'expo-router';

export default function ShareIntentRoute() {
    // This route handles the incoming deep link from expo-share-intent
    // (riresume:///share-intent) and redirects to the landing page.
    return <Redirect href="/" />;
}
