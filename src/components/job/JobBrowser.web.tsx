import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function JobBrowser({ visible, onClose }: any) {
    if (!visible) return null;

    return (
        <View style={styles.container}>
            <Text style={styles.text}>Job Browser is not supported on the web version. Please copy and paste the job description manually.</Text>
            <Text style={styles.closeText} onPress={onClose}>Close</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        zIndex: 9999,
    },
    text: {
        color: 'white',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
    },
    closeText: {
        color: '#A78BFA',
        fontSize: 18,
        fontWeight: 'bold',
    }
});
