import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Portal, Modal, Text, Button, IconButton, ProgressBar, useTheme } from 'react-native-paper';

interface Slide {
    title: string;
    points: {
        title: string;
        description: string;
    }[];
}

interface Props {
    visible: boolean;
    slides: Slide[];
    initialSlide: number;
    onDismiss: () => void;
    onSlideChange: (index: number) => void;
    onComplete: () => void;
}

export const TrainingSlideshow = ({ visible, slides, initialSlide, onDismiss, onSlideChange, onComplete }: Props) => {
    const theme = useTheme();
    const [currentIndex, setCurrentIndex] = useState(initialSlide || 0);

    const progress = slides.length > 0 ? (currentIndex + 1) / slides.length : 0;

    const nextSlide = () => {
        if (currentIndex < slides.length - 1) {
            const next = currentIndex + 1;
            setCurrentIndex(next);
            onSlideChange(next);
        }
    };

    const prevSlide = () => {
        if (currentIndex > 0) {
            const prev = currentIndex - 1;
            setCurrentIndex(prev);
            onSlideChange(prev);
        }
    };

    if (!slides || slides.length === 0) return null;

    const currentSlide = slides[currentIndex];
    if (!currentSlide) return null;

    // Robust normalizer: extract title+description from any point shape
    const normalizePoint = (p: any): { title: string; description: string } => {
        if (typeof p === 'string') return { title: p, description: '' };
        if (!p || typeof p !== 'object') return { title: '', description: '' };

        // Try common title field names
        const titleVal = p.title || p.heading || p.name || p.text || p.topic || p.point || p.key || p.concept || '';
        // Try common description field names
        const descVal = p.description || p.details || p.detail || p.explanation || p.content || p.body || p.summary || p.info || p.notes || '';

        // If we got nothing from known keys, grab the first two string values from the object
        if (!titleVal && !descVal) {
            const stringVals = Object.values(p).filter((v): v is string => typeof v === 'string');
            return { title: stringVals[0] || '', description: stringVals[1] || '' };
        }

        return { title: String(titleVal), description: String(descVal) };
    };

    // Get the raw points-like array from various possible field names
    const rawItems: any[] = (currentSlide as any).points
        || (currentSlide as any).bullets
        || (currentSlide as any).key_points
        || (currentSlide as any).content
        || (currentSlide as any).items
        || (currentSlide as any).topics
        || [];

    const points = (Array.isArray(rawItems) ? rawItems : []).map(normalizePoint);

    // Debug: log first slide structure to help diagnose issues
    if (currentIndex === 0) {
        console.log('[Slideshow] Slide 0 raw keys:', Object.keys(currentSlide));
        const firstRawItem = Array.isArray(rawItems) && rawItems[0];
        if (firstRawItem && typeof firstRawItem === 'object') {
            console.log('[Slideshow] Point 0 keys:', Object.keys(firstRawItem));
        }
    }

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onDismiss}
                contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.elevation.level3 }]}
            >
                <View style={styles.header}>
                    <Text variant="titleMedium">Training Progress</Text>
                    <IconButton icon="close" onPress={onDismiss} />
                </View>

                <ProgressBar progress={progress} color={theme.colors.primary} style={styles.progressBar} />

                <Text variant="labelSmall" style={[styles.pagination, { color: theme.colors.onSurfaceVariant }]}>
                    Slide {currentIndex + 1} of {slides.length}
                </Text>

                <ScrollView style={styles.content}>
                    <Text variant="headlineSmall" style={[styles.slideTitle, { color: theme.colors.onSurface }]}>{currentSlide.title || `Slide ${currentIndex + 1}`}</Text>

                    {points.length > 0 ? points.map((item, idx) => (
                        <View key={idx} style={styles.pointContainer}>
                            <View style={styles.bulletRow}>
                                <Text style={[styles.bullet, { color: theme.colors.primary }]}>•</Text>
                                <Text variant="titleSmall" style={[styles.pointTitle, { color: theme.colors.onSurface }]}>{item.title}</Text>
                            </View>
                            {item.description ? (
                                <Text variant="bodyMedium" style={[styles.descriptionText, { color: theme.colors.onSurfaceVariant }]}>
                                    {item.description}
                                </Text>
                            ) : null}
                        </View>
                    )) : (
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                            No content available for this slide.
                        </Text>
                    )}
                </ScrollView>

                <View style={styles.footer}>
                    <Button
                        mode="outlined"
                        onPress={prevSlide}
                        disabled={currentIndex === 0}
                        icon="arrow-left"
                    >
                        Prev
                    </Button>

                    {currentIndex === slides.length - 1 ? (
                        <Button
                            mode="contained"
                            onPress={onComplete}
                            icon="check-decagram"
                        >
                            Complete Training
                        </Button>
                    ) : (
                        <Button
                            mode="contained"
                            onPress={nextSlide}
                            contentStyle={{ flexDirection: 'row-reverse' }}
                            icon="arrow-right"
                        >
                            Next
                        </Button>
                    )}
                </View>
            </Modal>
        </Portal>
    );
};

const styles = StyleSheet.create({
    modal: {
        margin: 16,
        padding: 20,
        borderRadius: 12,
        height: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    progressBar: {
        height: 6,
        borderRadius: 3,
        marginBottom: 8,
    },
    pagination: {
        textAlign: 'center',
        // color: '#666', -- Handled by theme inline
        marginBottom: 16,
    },
    slideTitle: {
        fontWeight: 'bold',
        marginBottom: 24,
        // color: '#000', -- Handled by theme inline
    },
    content: {
        flex: 1,
        marginBottom: 20,
    },
    pointContainer: {
        marginBottom: 20,
        paddingLeft: 4,
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    bullet: {
        fontSize: 20,
        marginRight: 8,
        // color: '#6200ee', -- Handled by theme inline
        lineHeight: 24,
    },
    pointTitle: {
        fontWeight: 'bold',
        // color: '#333', -- Handled by theme inline
        flex: 1,
    },
    descriptionText: {
        marginLeft: 20,
        // color: '#666', -- Handled by theme inline
        lineHeight: 20,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    }
});
