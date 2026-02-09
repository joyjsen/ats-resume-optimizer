import { Redirect } from 'expo-router';

export default function NotFound() {
    // Catch any unmatched routes (like /--/) and redirect back to the app entry point.
    return <Redirect href="/" />;
}
