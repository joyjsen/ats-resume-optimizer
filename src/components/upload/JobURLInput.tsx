import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { TextInput, Text, SegmentedButtons } from 'react-native-paper';

interface Props {
    urlValue: string;
    textValue: string;
    mode: 'url' | 'text';
    onModeChange: (mode: 'url' | 'text') => void;
    onUrlChange: (text: string) => void;
    onTextChange: (text: string) => void;
    onExtract?: () => void;
    isExtracting?: boolean;
}

const isAndroid = Platform.OS === 'android';

export const JobURLInput = ({ urlValue, textValue, mode, onModeChange, onUrlChange, onTextChange, onExtract, isExtracting }: Props) => {
    return (
        <View style={styles.container}>
            <SegmentedButtons
                value={mode}
                onValueChange={(val) => onModeChange(val as 'url' | 'text')}
                buttons={[
                    { value: 'url', label: 'Job URL' },
                    { value: 'text', label: 'Job Details' },
                ]}
                style={styles.toggle}
                density={isAndroid ? 'medium' : 'regular'}
            />

            {mode === 'url' ? (
                <TextInput
                    mode="outlined"
                    label="Job Posting URL"
                    placeholder="https://linkedin.com/jobs/..."
                    value={urlValue}
                    onChangeText={onUrlChange}
                    autoCapitalize="none"
                    keyboardType="url"
                    dense={isAndroid}
                />
            ) : null}


            <Text variant="bodySmall" style={styles.helper}>
                {mode === 'url'
                    ? 'We will automatically parse skills and requirements from the link.'
                    : 'Paste the full description for best results (or use Browser Import).'}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: isAndroid ? 8 : 12,
    },
    toggle: {
        marginBottom: isAndroid ? 4 : 8,
    },
    textArea: {
        minHeight: isAndroid ? 100 : 120,
    },
    helper: {
        opacity: 0.6,
    },
});

