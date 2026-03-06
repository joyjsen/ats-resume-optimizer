import { Dimensions, PixelRatio } from 'react-native';

const { width, height } = Dimensions.get('window');

// Guideline sizes are based on standard ~5" screen mobile device
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

// Cap scaling for tablets to prevent giant UI elements
const MAX_SCALE = 1.3;

/**
 * Scales size based on screen width with a cap
 */
export const horizontalScale = (size: number) => {
    const scale = width / guidelineBaseWidth;
    const cappedScale = Math.min(scale, MAX_SCALE);
    return cappedScale * size;
};

/**
 * Scales size based on screen height with a cap
 */
export const verticalScale = (size: number) => {
    const scale = height / guidelineBaseHeight;
    const cappedScale = Math.min(scale, MAX_SCALE);
    return cappedScale * size;
};

/**
 * Scales size based on screen width with a moderation factor and cap
 */
export const moderateScale = (size: number, factor = 0.5) => {
    const scale = width / guidelineBaseWidth;
    const cappedScale = Math.min(scale, MAX_SCALE);
    return size + (cappedScale * size - size) * factor;
};

/**
 * Scales font size based on pixel ratio and screen width with a moderation factor
 * Prevents text from being too large on high-density displays and tablets
 */
export const scaleFont = (size: number, factor = 0.5) => {
    // Use the shorter dimension (width in portrait, height in landscape) 
    // to prevent fonts from doubling in size when rotating to landscape
    const shortDimension = width < height ? width : height;
    const baseScale = shortDimension / guidelineBaseWidth;

    // Applying a moderation factor and explicit cap for tablets
    const cappedBaseScale = Math.min(baseScale, MAX_SCALE);
    const newSize = size + (cappedBaseScale * size - size) * factor;

    return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

export { width, height };
