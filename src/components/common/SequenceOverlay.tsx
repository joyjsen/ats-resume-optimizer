import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated as RNAnimated, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = RNAnimated.createAnimatedComponent(Path);

interface SequenceOverlayProps {
    targetLayout: { x: number; y: number; width: number; height: number };
    title: string;
    description: string;
    stepIndex: number;
    totalSteps: number;
    onNext: () => void;
    arrowDirection?: 'up' | 'down';
    yOffset?: number; // Manual override for sticky headers
    onBack?: () => void;
    isCentered?: boolean; // Center modal and disable arrows/markers
}

export const SequenceOverlay: React.FC<SequenceOverlayProps> = ({
    targetLayout,
    title,
    description,
    stepIndex,
    totalSteps,
    onNext,
    onSkip,
    arrowDirection = 'up',
    yOffset = 0,
    onBack,
    isCentered = false
}) => {
    const theme = useTheme();
    const { width, height } = useWindowDimensions();
    
    const drawAnim = useRef(new RNAnimated.Value(200)).current;
    const drawArrowHead = useRef(new RNAnimated.Value(40)).current;
    const overlayOpacity = useRef(new RNAnimated.Value(0)).current;

    useEffect(() => {
        // Reset animations on step change
        drawAnim.setValue(200);
        drawArrowHead.setValue(40);
        
        RNAnimated.parallel([
            RNAnimated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            RNAnimated.sequence([
                RNAnimated.delay(150),
                RNAnimated.timing(drawAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
                RNAnimated.timing(drawArrowHead, { toValue: 0, duration: 250, useNativeDriver: true })
            ])
        ]).start();
    }, [stepIndex]);

    // Position calculations
    // If arrowDirection is 'up', arrow is under the target pointing up. Popover is under the arrow.
    // If arrowDirection is 'down', arrow is above the target pointing down. Popover is above the arrow.
    
    // In our SVG layout for "up" pointing:
    // M 20 88 C ... 120 10 -> starts at bottom left, loops to top right. Wait, the original arrow:
    // Original optimize arrow points DOWN: Starts at Top Right (120, 10), points to Bottom Left (20, 88)
    
    let arrowTop = 0;
    let arrowLeft = targetLayout.x + (targetLayout.width / 2) - 20;
    let popoverTop = 0;
    
    if (arrowDirection === 'down') {
        // Arrow points DOWN AT the target layout.
        // Arrow sits just above target
        arrowTop = targetLayout.y - 100 + yOffset;
        popoverTop = targetLayout.y - 300 + yOffset;
    } else {
        // Arrow points UP AT the target layout.
        arrowTop = targetLayout.y + targetLayout.height + 10 + yOffset;
        popoverTop = arrowTop + 90;
    }

    // SVG for arrow pointing UP (target is above)
    const SVGArrowUp = () => (
        <Svg width="140" height="110" viewBox="0 0 140 110" fill="none" style={styles.shadow}>
            <AnimatedPath
                d="M 20 80 C 10 60, 60 50, 100 20 C 110 10, 115 5, 120 10"
                stroke="#A78BFA" strokeWidth="3.5" strokeLinecap="round" fill="none"
                strokeDasharray="200" strokeDashoffset={drawAnim}
            />
            <AnimatedPath
                d="M 120 10 L 105 5 M 120 10 L 115 25"
                stroke="#A78BFA" strokeWidth="3.5" strokeLinecap="round" fill="none"
                strokeDasharray="40" strokeDashoffset={drawArrowHead}
            />
        </Svg>
    );

    // SVG for arrow pointing DOWN (target is below)
    const SVGArrowDown = () => (
        <Svg width="140" height="110" viewBox="0 0 140 110" fill="none" style={styles.shadow}>
            <AnimatedPath
                d="M 120 10 C 100 8, 60 5, 30 30 C 10 48, 8 72, 20 88"
                stroke="#A78BFA" strokeWidth="3.5" strokeLinecap="round" fill="none"
                strokeDasharray="200" strokeDashoffset={drawAnim}
            />
            <AnimatedPath
                d="M 20 88 L 8 76 M 20 88 L 34 80"
                stroke="#A78BFA" strokeWidth="3.5" strokeLinecap="round" fill="none"
                strokeDasharray="40" strokeDashoffset={drawArrowHead}
            />
        </Svg>
    );

    return (
        <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.dark ? "rgba(8,6,18,0.85)" : "rgba(255,255,255,0.85)", zIndex: 1000, opacity: overlayOpacity }]} pointerEvents="auto">
            
            {/* The Arrow */}
            {!isCentered && (
                <View style={{ position: 'absolute', top: arrowTop, left: Math.min(width - 140, arrowLeft) }}>
                    {arrowDirection === 'down' ? <SVGArrowDown /> : <SVGArrowUp />}
                </View>
            )}

            {/* The Highlighted Fake Cutout (Optional, adds context) - simple border around target */}
            {!isCentered && (
                <View style={{ position: 'absolute', top: targetLayout.y + yOffset, left: targetLayout.x, width: targetLayout.width, height: targetLayout.height, borderRadius: 8, borderWidth: 2, borderColor: '#A78BFA', borderStyle: 'dashed' }} pointerEvents="none" />
            )}

            {/* The Popover Box */}
            <View style={{ position: 'absolute', top: isCentered ? Math.max(50, (height / 2) - 150) : Math.max(50, popoverTop), left: 20, right: 20, backgroundColor: theme.dark ? '#1E1830' : '#fff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: "rgba(124,58,237,0.5)", shadowColor: "#7C3AED", shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: "rgba(124,58,237,0.2)", borderRadius: 50, paddingHorizontal: 12, paddingVertical: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#A78BFA", marginRight: 8 }} />
                        <Text style={{ color: "#A78BFA", fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>{stepIndex + 1} OF {totalSteps}</Text>
                    </View>
                    <TouchableOpacity onPress={onSkip}>
                        <Text style={{ color: theme.dark ? "#9CA3AF" : "#6B7280", fontSize: 13, fontWeight: '600' }}>Skip Training</Text>
                    </TouchableOpacity>
                </View>

                <Text style={{ color: theme.dark ? "#F5F3FF" : "#111", fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{title}</Text>
                <Text style={{ color: theme.dark ? "#9CA3AF" : "#555", fontSize: 14, lineHeight: 20, marginBottom: 20 }}>{description}</Text>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                    {stepIndex > 0 && onBack && (
                        <TouchableOpacity style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 50, marginRight: 12, borderWidth: 1, borderColor: '#7C3AED' }} onPress={onBack}>
                            <Text style={{ color: theme.dark ? "#F5F3FF" : "#111", fontSize: 14, fontWeight: '600' }}>👈 Back</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={{ backgroundColor: "#7C3AED", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 50, alignSelf: 'flex-start' }} onPress={onNext}>
                        <Text style={{ color: "white", fontSize: 14, fontWeight: '600' }}>{stepIndex === totalSteps - 1 ? 'Finish →' : 'Next 👉'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

        </RNAnimated.View>
    );
};

const styles = StyleSheet.create({
    shadow: {
        shadowColor: "#7C3AED",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
        elevation: 3
    }
});
