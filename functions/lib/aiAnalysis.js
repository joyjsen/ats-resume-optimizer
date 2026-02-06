"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTrainingSlideshow = exports.onBackgroundTaskCreated = exports.generateCoverLetter = exports.generatePrepGuide = exports.addSkillToResume = exports.optimizeResume = exports.generateRecommendation = exports.performGapAnalysis = exports.perplexityApiKey = exports.openaiApiKey = void 0;
const params_1 = require("firebase-functions/params");
// Define secrets once here
exports.openaiApiKey = (0, params_1.defineSecret)("OPENAI_API_KEY");
exports.perplexityApiKey = (0, params_1.defineSecret)("PERPLEXITY_API_KEY");
// Export features
const gapAnalysis_1 = require("./features/gapAnalysis");
const generateRecommendation_1 = require("./features/generateRecommendation");
const resumeOptimization_1 = require("./features/resumeOptimization");
const prepGuide_1 = require("./features/prepGuide");
const backgroundTasks_1 = require("./features/backgroundTasks");
const trainingSlideshow_1 = require("./features/trainingSlideshow");
exports.performGapAnalysis = (0, gapAnalysis_1.performGapAnalysis)(exports.openaiApiKey, exports.perplexityApiKey);
exports.generateRecommendation = (0, generateRecommendation_1.generateRecommendation)(exports.openaiApiKey, exports.perplexityApiKey);
exports.optimizeResume = (0, resumeOptimization_1.optimizeResume)(exports.openaiApiKey, exports.perplexityApiKey);
exports.addSkillToResume = (0, resumeOptimization_1.addSkillToResume)(exports.openaiApiKey, exports.perplexityApiKey);
exports.generatePrepGuide = (0, prepGuide_1.generatePrepGuide)(exports.openaiApiKey, exports.perplexityApiKey);
exports.generateCoverLetter = (0, prepGuide_1.generateCoverLetter)(exports.openaiApiKey, exports.perplexityApiKey);
exports.onBackgroundTaskCreated = (0, backgroundTasks_1.onBackgroundTaskCreated)(exports.openaiApiKey, exports.perplexityApiKey);
exports.generateTrainingSlideshow = (0, trainingSlideshow_1.generateTrainingSlideshow)(exports.openaiApiKey);
//# sourceMappingURL=aiAnalysis.js.map