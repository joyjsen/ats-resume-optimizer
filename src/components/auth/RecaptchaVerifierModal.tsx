import React, { forwardRef, useImperativeHandle, useState, useRef } from 'react';
import { Modal, StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ApplicationVerifier } from 'firebase/auth';

interface Props {
  firebaseConfig: any;
  title?: string;
  cancelLabel?: string;
}

export interface RecaptchaVerifierRef extends ApplicationVerifier {
  verify: () => Promise<string>;
}

const RecaptchaVerifierModal = forwardRef<RecaptchaVerifierRef, Props>(({ firebaseConfig, title = "Verification", cancelLabel = "Cancel" }, ref) => {
  const [visible, setVisible] = useState(false);
  const [resolver, setResolver] = useState<((token: string) => void) | null>(null);
  const [rejecter, setRejecter] = useState<((error: Error) => void) | null>(null);

  // Ref to the verifier ID
  const verifierId = useRef(Math.random().toString(36).substring(7)).current;

  useImperativeHandle(ref, () => ({
    type: 'recaptcha',
    verify: () => {
      // Return a promise that resolves when the WebView posts back a success token
      return new Promise((resolve, reject) => {
        setVisible(true);
        setResolver(() => resolve);
        setRejecter(() => reject);
      });
    },
    _reset: () => {
      setVisible(false);
      setResolver(null);
      setRejecter(null);
    }
  }));

  const handleMessage = (event: any) => {
    const data = event.nativeEvent.data;
    // Check for specific prefixes if needed, but for now assuming token or error
    if (data.startsWith('error:')) {
      if (rejecter) rejecter(new Error(data.substring(6)));
      cleanup();
    } else {
      // Success code
      if (resolver) resolver(data); // "data" is the verification ID or token
      cleanup();
    }
  };

  const cleanup = () => {
    setVisible(false);
    setResolver(null);
    setRejecter(null);
  }

  const handleCancel = () => {
    if (rejecter) rejecter(new Error('Cancelled by user'));
    cleanup();
  };

  // Improved HTML: Uses Firebase SDK directly to handle keys automatically
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js"></script>
        <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js"></script>
        <style>
          body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: white; font-family: system-ui, -apple-system, sans-serif; }
          #recaptcha-container { transform: scale(1.1); }
          .loading { position: absolute; top: 10px; font-size: 12px; color: #888; }
        </style>
      </head>
      <body>
        <div class="loading" id="status">Loading Security Check...</div>
        <div id="recaptcha-container"></div>
        <script>
          const config = ${JSON.stringify(firebaseConfig)};
          
          try {
              firebase.initializeApp(config);
              
              const verifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                'size': 'normal',
                'callback': function(response) {
                  window.ReactNativeWebView.postMessage(response);
                },
                'expired-callback': function() {
                  window.ReactNativeWebView.postMessage('error:expired');
                }
              });

              // Auto-render
              verifier.render().then(function(widgetId) {
                document.getElementById('status').style.display = 'none';
              });
              
          } catch (e) {
              window.ReactNativeWebView.postMessage('error:' + e.message);
          }
        </script>
      </body>
    </html>
  `;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={handleCancel}>
            <Text style={styles.cancel}>{cancelLabel}</Text>
          </TouchableOpacity>
        </View>
        <WebView
          source={{ html, baseUrl: 'http://localhost' }}
          onMessage={handleMessage}
          style={{ flex: 1 }}
          javaScriptEnabled
          automaticallyAdjustContentInsets
        />
      </SafeAreaView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontWeight: 'bold', fontSize: 16 },
  cancel: { color: 'blue', fontSize: 16 }
});

export default RecaptchaVerifierModal;
