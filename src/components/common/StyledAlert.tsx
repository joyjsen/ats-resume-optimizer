import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import { Text, useTheme, Portal } from 'react-native-paper';

interface StyledAlertProps {
    visible: boolean;
    title: string;
    description: string;
    buttonText: string;
    onClose: () => void;
}

export const StyledAlert: React.FC<StyledAlertProps> = ({ visible, title, description, buttonText, onClose }) => {
    const theme = useTheme();
    const overlayOpacity = useRef(new RNAnimated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            RNAnimated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        } else {
            RNAnimated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Portal>
            <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.dark ? "rgba(8,6,18,0.85)" : "rgba(255,255,255,0.85)", zIndex: 9999, justifyContent: 'center', alignItems: 'center', opacity: overlayOpacity }]} pointerEvents="auto">
                <View style={{ backgroundColor: theme.dark ? '#1E1830' : '#fff', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: "rgba(124,58,237,0.5)", shadowColor: "#7C3AED", shadowOpacity: 0.25, shadowRadius: 12, elevation: 8, maxWidth: '85%' }}>
                    <Text style={{ color: theme.dark ? "#F5F3FF" : "#111", fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>{title}</Text>
                    <Text style={{ color: theme.dark ? "#9CA3AF" : "#555", fontSize: 14, lineHeight: 20, marginBottom: 20, textAlign: 'center' }}>{description}</Text>
                    
                    <TouchableOpacity style={{ backgroundColor: "#7C3AED", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 50, alignSelf: 'center' }} onPress={onClose}>
                        <Text style={{ color: "white", fontSize: 14, fontWeight: '600' }}>{buttonText}</Text>
                    </TouchableOpacity>
                </View>
            </RNAnimated.View>
        </Portal>
    );
};
