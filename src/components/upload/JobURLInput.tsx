import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Platform, Animated as RNAnimated } from 'react-native';
import { TextInput, Text, SegmentedButtons, useTheme } from 'react-native-paper';

interface Props {
    urlValue: string;
    textValue: string;
    mode: 'url' | 'text';
    onModeChange: (mode: 'url' | 'text') => void;
    onUrlChange: (text: string) => void;
    onTextChange: (text: string) => void;
    onExtract?: () => void;
    isExtracting?: boolean;
    isGlowing?: boolean;
}

const isAndroid = Platform.OS === 'android';

export const JobURLInput = ({ urlValue, textValue, mode, onModeChange, onUrlChange, onTextChange, onExtract, isExtracting, isGlowing }: Props) => {
    const theme = useTheme();
    const glowAnim = useRef(new RNAnimated.Value(0)).current;

    useEffect(() => {
        if (isGlowing) {
            RNAnimated.loop(
                RNAnimated.sequence([
                    RNAnimated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
                    RNAnimated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: false })
                ])
            ).start();
        } else {
            glowAnim.stopAnimation();
            glowAnim.setValue(0);
        }
    }, [isGlowing]);

    const glowColor = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['transparent', theme.colors.primary]
    });

    return (
        <RNAnimated.View style={[styles.container, { borderRadius: 8, borderWidth: 2, borderColor: glowColor, padding: isGlowing ? 4 : 0, shadowColor: isGlowing ? theme.colors.primary : 'transparent', shadowOpacity: glowAnim, shadowRadius: 8, backgroundColor: isGlowing ? 'rgba(156,39,176,0.05)' : 'transparent' }]}>
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
                    mode={Platform.OS === 'web' ? 'flat' : 'outlined'}
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
                    : 'Paste the full description below for best results.'}
            </Text>
        </RNAnimated.View>
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
