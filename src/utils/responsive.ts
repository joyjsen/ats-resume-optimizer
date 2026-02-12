import { Dimensions, PixelRatio } from 'react-native';

const { width, height } = Dimensions.get('window');

// Guideline sizes are based on standard ~5" screen mobile device
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

/**
 * Scales size based on screen width
 */
export const horizontalScale = (size: number) => (width / guidelineBaseWidth) * size;

/**
 * Scales size based on screen height
 */
export const verticalScale = (size: number) => (height / guidelineBaseHeight) * size;

/**
 * Scales size based on screen width with a moderation factor
 * Useful for icons, font sizes, and secondary spacing
 */
export const moderateScale = (size: number, factor = 0.5) => size + (horizontalScale(size) - size) * factor;

/**
 * Scales font size based on pixel ratio and screen width
 * Prevents text from being too large on high-density displays
 */
export const scaleFont = (size: number) => {
    const newSize = (width / guidelineBaseWidth) * size;
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

export { width, height };
