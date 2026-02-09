import React from 'react';
import { View, StyleSheet } from 'react-native';
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
                    right={
                        urlValue ? (
                            <TextInput.Icon
                                icon="close-circle-outline"
                                onPress={() => onUrlChange('')}
                                forceTextInputFocus={false}
                            />
                        ) : null
                    }
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
        gap: 12,
    },
    toggle: {
        marginBottom: 8,
    },
    textArea: {
        minHeight: 120,
    },
    helper: {
        opacity: 0.6,
    },
});
