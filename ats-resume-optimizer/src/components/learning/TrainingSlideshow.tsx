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

                <Text variant="labelSmall" style={styles.pagination}>
                    Slide {currentIndex + 1} of {slides.length}
                </Text>

                <ScrollView style={styles.content}>
                    <Text variant="headlineSmall" style={styles.slideTitle}>{currentSlide.title}</Text>

                    {currentSlide.points.map((item, idx) => (
                        <View key={idx} style={styles.pointContainer}>
                            <View style={styles.bulletRow}>
                                <Text style={styles.bullet}>•</Text>
                                <Text variant="titleSmall" style={styles.pointTitle}>{item.title}</Text>
                            </View>
                            <Text variant="bodyMedium" style={styles.descriptionText}>
                                {item.description}
                            </Text>
                        </View>
                    ))}
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
        color: '#666',
        marginBottom: 16,
    },
    slideTitle: {
        fontWeight: 'bold',
        marginBottom: 24,
        color: '#000',
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
        color: '#6200ee',
        lineHeight: 24,
    },
    pointTitle: {
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
    },
    descriptionText: {
        marginLeft: 20,
        color: '#666',
        lineHeight: 20,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    }
});
