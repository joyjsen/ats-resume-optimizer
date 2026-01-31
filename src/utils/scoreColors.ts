/**
 * Utility for consistent ATS score color coding across the application.
 * Criteria:
 * - < 50%: Red (#F44336)
 * - 50-74%: Orange (#FF9800)
 * - >= 75%: Green (#4CAF50)
 */
export const getATSScoreColor = (score: number): string => {
    if (score >= 75) return '#4CAF50';
    if (score >= 50) return '#FF9800';
    return '#F44336';
};

/**
 * Recommendation metadata based on ATS score.
 */
export const getATSScoreRecommendation = (score: number) => {
    const color = getATSScoreColor(score);

    if (score >= 75) {
        return {
            color,
            icon: 'check-circle',
            message: "Strongly encouraged to apply",
            description: "You have a strong match with the job requirements and should proceed with confidence.",
            bg: '#E8F5E9'
        };
    }
    if (score >= 50) {
        return {
            color,
            icon: 'alert',
            message: "Encouraged to apply, better chances with skill upgrades",
            description: "You have a decent foundation but could improve your chances by adding missing skills.",
            bg: '#FFF3E0'
        };
    }
    return {
        color,
        icon: 'book-open-variant',
        message: "Brush up on skills before applying",
        description: "Significant skill gaps exist; focus on skill development before applying.",
        bg: '#FFEBEE'
    };
};
