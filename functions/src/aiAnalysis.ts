import { defineSecret } from "firebase-functions/params";

// Define secrets once here
export const openaiApiKey = defineSecret("OPENAI_API_KEY");
export const perplexityApiKey = defineSecret("PERPLEXITY_API_KEY");

// Export features
import { performGapAnalysis as gap } from "./features/gapAnalysis";
import { generateRecommendation as recommend } from "./features/generateRecommendation";
import { optimizeResume as optimize, addSkillToResume as addSkill } from "./features/resumeOptimization";
import { generatePrepGuide as prep, generateCoverLetter as cover } from "./features/prepGuide";
import { onBackgroundTaskCreated as background } from "./features/backgroundTasks";
import { generateTrainingSlideshow as training } from "./features/trainingSlideshow";

export const performGapAnalysis = gap(openaiApiKey, perplexityApiKey);
export const generateRecommendation = recommend(openaiApiKey, perplexityApiKey);
export const optimizeResume = optimize(openaiApiKey, perplexityApiKey);
export const addSkillToResume = addSkill(openaiApiKey, perplexityApiKey);
export const generatePrepGuide = prep(openaiApiKey, perplexityApiKey);
export const generateCoverLetter = cover(openaiApiKey, perplexityApiKey);
export const onBackgroundTaskCreated = background(openaiApiKey, perplexityApiKey);
export const generateTrainingSlideshow = training(openaiApiKey);
