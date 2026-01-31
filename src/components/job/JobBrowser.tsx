import React, { useState, useRef } from 'react';
import { View, StyleSheet, Modal, ActivityIndicator, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Button, Appbar, ProgressBar } from 'react-native-paper';

interface JobBrowserProps {
    visible: boolean;
    initialUrl?: string;
    onClose: () => void;
    onImport: (text: string, url: string) => void;
}

export default function JobBrowser({ visible, initialUrl, onClose, onImport }: JobBrowserProps) {
    const webViewRef = useRef<WebView>(null);
    const [url, setUrl] = useState(initialUrl || 'https://www.linkedin.com/jobs');
    const [progress, setProgress] = useState(0);

    // Reset URL when modal opens with a new initialUrl
    React.useEffect(() => {
        if (visible && initialUrl) {
            setUrl(initialUrl);
        } else if (visible && !initialUrl) {
            setUrl('https://www.linkedin.com/jobs');
        }
    }, [visible, initialUrl]);

    // Initial script to enable communication
    const INJECTED_JAVASCRIPT = `(function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'log', message: 'Script Injected'}));
    })();`;

    const handleImport = () => {
        const extractScript = `
            (function() {
                try {
                    // Strategy: Find best container, get text, then clean string.
                    // DO NOT remove elements from DOM to avoid losing content.

                    const contentSelectors = [
                        '.show-more-less-html__markup', // LinkedIn Mobile
                        '.core-section-container', // LinkedIn
                        '#job-details', 
                        '#jobDescriptionText', // Indeed
                        '.job-details-jobs-unified-top-card__content-container',
                        '.jobs-description-content__text',
                        '.job-view-layout',
                        'article',
                        'main'
                    ];

                    let bestElement = null;
                    let strategy = 'fallback';

                    // 1. Try High Precision Selectors
                    for (const sel of contentSelectors) {
                        const el = document.querySelector(sel);
                        if (el && el.innerText.trim().length > 50) {
                            bestElement = el;
                            strategy = sel;
                            break;
                        }
                    }

                    // 2. Fallback to Body (Nuclear)
                    if (!bestElement) {
                         bestElement = document.body;
                    }

                    if (!bestElement) throw new Error("No content found");

                    // 3. Extract Text (and filtering hidden text)
                    let text = bestElement.innerText;
                    
                    // 4. String Cleanup (Post-processing)
                    // Remove likely garbage lines based on keywords
                    const garbageKeywords = [
                        'Sign in', 'Join now', 'Forgot password?', 'Agree & Join', 
                        'Cookies', 'Privacy Policy', 'User Agreement', 
                        'Skip to main content', 'Open App', 'Get the app'
                    ];

                    const lines = text.split('\\n');
                    const cleanLines = lines.filter(line => {
                        const t = line.trim();
                        if (t.length < 3) return false; // fast fail short junk
                        // Filter out lines that are exact garbage matches or look like menu items
                        if (garbageKeywords.some(k => t.includes(k) && t.length < k.length + 20)) return false;
                        return true;
                    });

                    let finalText = cleanLines.join('\\n');

                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'extract',
                        text: finalText,
                        url: window.location.href,
                        strategy: strategy
                    }));

                } catch(err) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'log',
                        message: 'Extraction Error: ' + err.message
                    }));
                }
            })();
        `;
        webViewRef.current?.injectJavaScript(extractScript);
    };

    const handleMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'extract') {
                if (data.text && data.text.length > 30) { // Very low threshold, let user edit
                    onImport(data.text, data.url);
                } else {
                    Alert.alert('Import Failed', `Found only ${data.text?.length || 0} chars. Please copy manually.`);
                }
            } else if (data.type === 'log') {
                console.log('WebView Log:', data.message);
            }
        } catch (e) {
            console.error("Failed to parse WebView message", e);
        }
    };

    // ... handleShouldStartLoadWithRequest ...
    const handleShouldStartLoadWithRequest = (request: any) => {
        if (request.url.startsWith('about:')) return true;
        if (!request.url.startsWith('http')) return false;
        return true;
    };

    const clearCache = () => {
        webViewRef.current?.clearCache(true);
        setUrl('https://www.linkedin.com/jobs');
        Alert.alert('Browser Reset', 'Cache cleared. Reloading LinkedIn.');
    };

    const removeOverlays = () => {
        const script = `
            (function() {
                try {
                    // Aggressive list again
                    const selectors = [
                        'iframe[title*="Sign in"]',
                        'iframe[src*="google"]',
                        '#artdeco-modal-outlet',
                        '.artdeco-modal-overlay',
                        '.modal-overlay',
                        '.dialog-container',
                        '#gls-banner-overlay',
                        '#hiring-overlay',
                        'div[class*="overlay"]', 
                        'div[class*="modal"]',
                        'div[id*="google"]' 
                    ];
                    
                    let count = 0;
                    
                    // Safety check function
                    const isSafeToRemove = (el) => {
                        const style = window.getComputedStyle(el);
                        // Don't remove if it's the main job description container
                        if (el.classList.contains('job-view-layout') || 
                            el.id === 'jobDescriptionText' ||
                            el.querySelector('.job-view-layout') ||
                            el.querySelector('#jobDescriptionText')) {
                            return false;
                        }
                        return true;
                    };

                    selectors.forEach(sel => {
                        document.querySelectorAll(sel).forEach(el => {
                            if (isSafeToRemove(el)) {
                                el.remove();
                                count++;
                            }
                        });
                    });
                    
                    // Remove high z-index full screen divs (brute force for persistent overlays)
                    const divs = document.querySelectorAll('div');
                    divs.forEach(div => {
                        const style = window.getComputedStyle(div);
                        if (parseInt(style.zIndex) > 50 && 
                            div.innerText.includes('Sign in') && 
                            isSafeToRemove(div)) {
                            div.remove();
                            count++;
                        }
                    });
                    
                    document.body.style.overflow = 'auto';
                    document.documentElement.style.overflow = 'auto';
                    
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'log',
                        message: 'Removed ' + count + ' overlays.'
                    }));
                } catch(e) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({type: 'log', message: 'Error removing overlays: ' + e.message}));
                }
            })();
        `;
        webViewRef.current?.injectJavaScript(script);
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={styles.container}>
                <Appbar.Header style={styles.header}>
                    <Appbar.Action icon="close" onPress={onClose} />
                    <Appbar.Content title="Job Browser" subtitle={url.replace('https://', '').substring(0, 20) + '...'} />
                    <Appbar.Action icon="layers-off" onPress={removeOverlays} />
                    <Appbar.Action icon="refresh" onPress={() => webViewRef.current?.reload()} />
                    <Appbar.Action icon="delete" onPress={clearCache} />
                    <Button mode="contained-tonal" style={{ marginRight: 8 }} onPress={handleImport}>
                        Import
                    </Button>
                </Appbar.Header>

                {progress < 1 && <ProgressBar progress={progress} color="#2196F3" />}

                <WebView
                    ref={webViewRef}
                    source={{ uri: url }}
                    style={{ flex: 1 }}
                    onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
                    onNavigationStateChange={(navState) => setUrl(navState.url)}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    sharedCookiesEnabled={true}
                    thirdPartyCookiesEnabled={true}
                    injectedJavaScript={INJECTED_JAVASCRIPT}
                    onMessage={handleMessage}
                    onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
                    originWhitelist={['*']}
                    userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
                    onError={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        console.warn('WebView error: ', nativeEvent);
                    }}
                />

                <View style={styles.footer}>
                    <View style={styles.quickLinks}>
                        <Button compact onPress={() => { setUrl('https://www.linkedin.com/jobs'); }}>LinkedIn</Button>
                        <Button compact onPress={() => { setUrl('https://www.indeed.com'); }}>Indeed</Button>
                        <Button compact onPress={() => { setUrl('https://www.google.com/about/careers/applications/jobs/results/'); }}>Google</Button>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        elevation: 0,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    footer: {
        padding: 8,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        backgroundColor: '#f9f9f9',
    },
    quickLinks: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    }
});
