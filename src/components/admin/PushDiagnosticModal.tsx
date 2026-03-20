import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { Modal, Portal, Text, Button, List, Divider, ActivityIndicator, IconButton, useTheme } from 'react-native-paper';
import { notificationService } from '../../services/firebase/notificationService';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface PushDiagnosticModalProps {
    visible: boolean;
    onDismiss: () => void;
}

export const PushDiagnosticModal: React.FC<PushDiagnosticModalProps> = ({ visible, onDismiss }) => {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [expoToken, setExpoToken] = useState<string | null>(null);
    const [fcmToken, setFcmToken] = useState<string | null>(null);
    const [isDevice, setIsDevice] = useState<boolean | null>(null);

    useEffect(() => {
        if (visible) {
            checkStatus();
        }
    }, [visible]);

    const checkStatus = async () => {
        setLoading(true);
        try {
            const { isDevice: checkIsDevice } = await import('expo-device');
            setIsDevice(checkIsDevice);

            // Get existing or new tokens
            const token = await notificationService.registerForPushNotificationsAsync();
            setExpoToken(token || 'Not Generated');

            // Find FCM token from Firestore or native call if possible
            // Note: FCM token is only available on Android native usually in this setup
            // We'll show what we have in the local store/service if possible
        } catch (error) {
            console.error("Diagnostic check failed:", error);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async (text: string, label: string) => {
        await Clipboard.setStringAsync(text);
        Alert.alert("Copied", `${label} copied to clipboard`);
    };

    const sendTestNotification = async () => {
        try {
            await notificationService.scheduleLocalNotification(
                "Diagnostic Test",
                "If you see this, local notification delivery is working!",
                { type: 'diagnostic' }
            );
            Alert.alert("Success", "Local notification scheduled correctly.");
        } catch (error: any) {
            Alert.alert("Failed", error.message);
        }
    };

    return (
        <Portal>
            <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.header}>
                    <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>Push Diagnostics</Text>
                    <IconButton icon="close" onPress={onDismiss} />
                </View>

                <ScrollView style={styles.content}>
                    <List.Item
                        title="Platform"
                        description={`${Platform.OS.toUpperCase()} (${isDevice ? 'Physical Device' : 'Simulator/Emulator'})`}
                        left={props => <List.Icon {...props} icon={Platform.OS === 'ios' ? 'apple' : 'android'} />}
                    />
                    <Divider />

                    <List.Item
                        title="Expo Push Token"
                        description={expoToken || 'Checking...'}
                        descriptionNumberOfLines={2}
                        left={props => <List.Icon {...props} icon="key-variant" />}
                        right={props => expoToken ? <IconButton icon="content-copy" onPress={() => copyToClipboard(expoToken, 'Expo Token')} /> : null}
                    />
                    <Divider />

                    <View style={styles.actions}>
                        <Button
                            mode="contained"
                            onPress={checkStatus}
                            loading={loading}
                            style={styles.button}
                            icon="refresh"
                        >
                            Refresh Tokens
                        </Button>

                        <Button
                            mode="outlined"
                            onPress={sendTestNotification}
                            style={styles.button}
                            icon="bell-ring"
                        >
                            Test Local Notification
                        </Button>
                    </View>

                    <View style={styles.infoBox}>
                        <MaterialCommunityIcons name="information-outline" size={20} color={theme.colors.primary} />
                        <Text variant="bodySmall" style={styles.infoText}>
                            On iOS Production, notifications require valid APNs credentials in EAS/Firebase. Simulators do not support remote pushes.
                        </Text>
                    </View>
                </ScrollView>
            </Modal>
        </Portal>
    );
};

const styles = StyleSheet.create({
    modal: {
        margin: 20,
        padding: 0,
        borderRadius: 12,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: 20,
        paddingRight: 8,
        paddingTop: 8,
    },
    content: {
        padding: 16,
    },
    actions: {
        marginTop: 24,
        gap: 12,
    },
    button: {
        borderRadius: 8,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: 'rgba(98, 0, 238, 0.05)',
        padding: 12,
        borderRadius: 8,
        marginTop: 24,
        alignItems: 'flex-start',
    },
    infoText: {
        marginLeft: 8,
        flex: 1,
        color: '#666',
    }
});
