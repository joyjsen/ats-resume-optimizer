# Social Authentication Setup Guide

This guide details the steps required to configure the social login buttons (Google, Microsoft, Apple, Facebook, Phone) implemented in your application.

## Prerequisites
-   Access to **Firebase Console**: [console.firebase.google.com](https://console.firebase.google.com/)
-   **Google Cloud Console** (linked to Firebase)
-   **Azure Portal** (for Microsoft)
-   **Meta for Developers** (for Facebook)
-   **Apple Developer Account** (for Apple)

---

## 1. Firebase Project Configuration
Before configuring individual providers, enable them in Firebase:
1.  Go to **Firebase Console** > **Build** > **Authentication**.
2.  Click the **Sign-in method** tab.
3.  Click **Add new provider** and enable:
    -   **Google**
    -   **Microsoft**
    -   **Apple**
    -   **Facebook**
    -   **Phone**

---

## 2. Google Sign-In Setup
**Goal**: Get Client IDs for `app.json` or your `.env` file.
1.  **Firebase Console**:
    -   In Authentication > Google, verify "Web SDK configuration" is auto-enabled.
    -   Copy the **Web Client ID**.
2.  **Google Cloud Console**:
    -   Go to APIs & Services > Credentials.
    -   **Android**: Create an "Android" Client ID. You will need your SHA-1 fingerprint (run `npx expo credentials:manager` or `keytool` dependent on your keystore).
    -   **iOS**: Create an "iOS" Client ID. Use your Bundle ID (e.g., `com.antigravity.atsoptimizer`).
3.  **Expo Config**:
    -   In `app.json`, add your scheme (e.g., `"scheme": "ats-optimizer"`).

---

## 3. Microsoft Authentication
**Goal**: Get **Application (Client) ID** from Azure.
1.  Go to [Azure Portal](https://portal.azure.com/) > **Azure Active Directory** (or Entra ID) > **App registrations**.
2.  Click **New registration**.
    -   Name: "ATS Resume Optimizer".
    -   Supported account types: "Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts".
    -   Redirect URI (Web): `https://auth.expo.io/@youruser/your-slug` (for Expo Go) or your production redirect.
3.  **Copy the Application (Client) ID**.
4.  **Certificates & secrets**: Create a client secret (optional for implicit flow, but often needed for backend web apps). For mobile/Expo, we usually use PKCE with just Client ID.
5.  **API Permissions**: Ensure `User.Read` is granted.

---

## 4. Facebook Login
**Goal**: Get **App ID**.
1.  Go to [Meta for Developers](https://developers.facebook.com/).
2.  Create a new App > **Consumer** or **Business**.
3.  Add **Facebook Login** product.
4.  **Settings** > **Basic**:
    -   Copy **App ID**.
5.  **Facebook Login** > **Settings**:
    -   Enable "Embedded Browser OAuth Login".
    -   Add Valid OAuth Redirect URIs (same as Expo redirect).

---

## 5. Apple Sign-In
**Goal**: Service ID and Key.
1.  Go to [Apple Developer Portal](https://developer.apple.com/).
2.  **Certificates, Identifiers & Profiles** > **Identifiers**.
3.  Create a new App ID (enable "Sign In with Apple").
4.  Create a **Service ID** (if using web flow) or just rely on the Bundle ID capability for native iOS.
5.  **Keys**: Create a new key, enable "Sign In with Apple", and download the `.p8` file (uploaded to Firebase for relay functionality).

---

## 6. Code Integration
Once you have these keys, update `src/services/firebase/authService.ts` and the UI buttons:
1.  **Install SDKs**:
    ```bash
    npx expo install expo-auth-session expo-crypto
    ```
2.  **Configure Hooks** in `sign-in.tsx`:
    ```typescript
    import * as Google from 'expo-auth-session/providers/google';
    
    // Inside component
    const [request, response, promptAsync] = Google.useAuthRequest({
      androidClientId: 'YOUR_ANDROID_CLIENT_ID',
      iosClientId: 'YOUR_IOS_CLIENT_ID',
      webClientId: 'YOUR_WEB_CLIENT_ID',
    });
    ```
3.  **Link to Service**:
    When `response.type === 'success'`, pass `response.authentication.accessToken` to `authService.loginWithGoogle(...)`.

---

## 7. Phone Auth
1.  **Firebase Console**: Enable Phone provider.
2.  **Testing**: Add "Phone numbers for testing" (e.g., `+1 5555555555`, Code `123456`) to avoid SMS costs during dev.
3.  **Client**: Phone auth usually requires a recaptcha verifier on web.
    ```typescript
    import { RecaptchaVerifier } from 'firebase/auth'; // Web SDK typical flow
    ```
    For React Native, use `react-native-firebase` (native) or a web-view based approach. The Firebase JS SDK handles it reasonably well on web builds.

---
**Note:** For development with Expo Go, **Google** and **Facebook** often require specific proxy configurations or behave differently than production builds. Testing on a physical device build (EAS Build) is recommended for final verification.
