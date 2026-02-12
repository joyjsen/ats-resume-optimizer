import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, Dimensions, Animated, Platform } from 'react-native';
import { Text, Card, useTheme, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { horizontalScale, verticalScale, moderateScale, scaleFont } from '../../utils/responsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - horizontalScale(64);
const AUTO_PLAY_INTERVAL = 6000; // 6 seconds

interface ResumeTip {
    id: string;
    title: string;
    content: string;
    icon: string;
    color: string;
}

const RESUME_TIPS: ResumeTip[] = [
    {
        id: '1',
        title: 'Add Measurable Results',
        content: 'Recruiters notice numbers first. Instead of "Improved sales", write "Increased sales by 27% in 6 months". Quantified results get more callbacks.',
        icon: 'chart-line',
        color: '#4CAF50'
    },
    {
        id: '2',
        title: 'Match the JD',
        content: "ATS scan for exact keyword matches. If it says 'Project Management', don't write 'Managed projects'. Small wording differences matter.",
        icon: 'target',
        color: '#2196F3'
    },
    {
        id: '3',
        title: 'Keep It ATS-Friendly',
        content: 'Avoid tables, text boxes, and complex layouts. Simple formatting ensures your resume is parsed correctly by automated systems.',
        icon: 'format-clear',
        color: '#FF9800'
    },
    {
        id: '4',
        title: 'Start With Action Verbs',
        content: 'Replace "Worked on" with "Led", "Designed", or "Optimized". Strong verbs increase your impact instantly.',
        icon: 'lightning-bolt',
        color: '#9C27B0'
    },
    {
        id: '5',
        title: 'Tailored > Generic',
        content: 'A generic resume gets filtered. Tailor your skills and summary for every application to dramatically improve your match score.',
        icon: 'tune',
        color: '#F44336'
    },
    {
        id: '6',
        title: 'Keep It Skimmable',
        content: 'Recruiters scan in 6–8 seconds. Use bullet points and keep lines short to improve readability and highlight key wins.',
        icon: 'eye-outline',
        color: '#00BCD4'
    },
    {
        id: '7',
        title: 'Include Hard Skills',
        content: 'Be specific with tools. Instead of "Good with data", list "SQL, Python, Power BI". Specificity boosts ATS ranking.',
        icon: 'wrench',
        color: '#795548'
    },
    {
        id: '8',
        title: 'Your First Impression',
        content: 'Your summary should highlight expertise and target keywords. Avoid vague statements like "Looking for growth".',
        icon: 'account-tie',
        color: '#3F51B5'
    },
    {
        id: '9',
        title: 'Consistency Matters',
        content: 'Ensure consistency in date formats, bullet styles, and font sizes. Professional formatting signals attention to detail.',
        icon: 'check-all',
        color: '#E91E63'
    },
    {
        id: '10',
        title: 'Show Career Progression',
        content: 'Demonstrate growth over time. Clear upward movement (Junior → Senior) significantly increases your credibility.',
        icon: 'trending-up',
        color: '#673AB7'
    }
];

export const ResumeTipsCarousel: React.FC = () => {
    const theme = useTheme();
    const [activeIndex, setActiveIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const interval = setInterval(() => {
            const nextIndex = (activeIndex + 1) % RESUME_TIPS.length;
            flatListRef.current?.scrollToIndex({
                index: nextIndex,
                animated: true
            });
            setActiveIndex(nextIndex);
        }, AUTO_PLAY_INTERVAL);

        return () => clearInterval(interval);
    }, [activeIndex]);

    const renderItem = ({ item }: { item: ResumeTip }) => (
        <View style={styles.cardContainer}>
            <Surface style={[styles.card, { backgroundColor: theme.colors.elevation.level2 }]} elevation={2}>
                <View style={styles.iconContainer}>
                    <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
                        <MaterialCommunityIcons name={item.icon as any} size={moderateScale(32)} color={item.color} />
                    </View>
                </View>
                <Text variant="titleMedium" style={styles.cardTitle}>{item.title}</Text>
                <Text variant="bodyMedium" style={styles.cardContent}>{item.content}</Text>
            </Surface>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text variant="labelLarge" style={[styles.headerText, { color: theme.colors.primary }]}>
                Pro Tip while you wait:
            </Text>

            <FlatList
                ref={flatListRef}
                data={RESUME_TIPS}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                onMomentumScrollEnd={(event) => {
                    const newIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                    setActiveIndex(newIndex);
                }}
                snapToAlignment="center"
                decelerationRate="fast"
            />

            <View style={styles.footer}>
                <View style={styles.pagination}>
                    {RESUME_TIPS.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: index === activeIndex ? theme.colors.primary : theme.colors.outlineVariant,
                                    width: index === activeIndex ? 16 : 6,
                                }
                            ]}
                        />
                    ))}
                </View>
                <Text variant="labelSmall" style={styles.counter}>
                    {activeIndex + 1} / {RESUME_TIPS.length}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: verticalScale(20),
        width: SCREEN_WIDTH,
        alignItems: 'center',
    },
    headerText: {
        marginBottom: verticalScale(12),
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    cardContainer: {
        width: SCREEN_WIDTH,
        alignItems: 'center',
        paddingHorizontal: horizontalScale(16),
    },
    card: {
        width: '100%',
        padding: moderateScale(20),
        borderRadius: moderateScale(16),
        minHeight: verticalScale(160),
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: verticalScale(12),
    },
    iconCircle: {
        width: moderateScale(60),
        height: moderateScale(60),
        borderRadius: moderateScale(30),
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: verticalScale(8),
    },
    cardContent: {
        textAlign: 'center',
        lineHeight: 20,
        opacity: 0.8,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: verticalScale(16),
        gap: 12,
    },
    pagination: {
        flexDirection: 'row',
        gap: 4,
    },
    dot: {
        height: 6,
        borderRadius: 3,
    },
    counter: {
        opacity: 0.5,
        fontWeight: 'bold',
    }
});
