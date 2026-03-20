import { applicationService } from '../firebase/applicationService';
import { getFirebaseFunctions } from '../firebase/config';
import { httpsCallable } from 'firebase/functions';

interface PrepGuideInput {
    companyName: string;
    jobTitle: string;
    jobDescription: string;
    optimizedResume: string;
    atsScore: number;
    matchedSkills: string[];
    partialMatches: string[];
    missingSkills: string[];
    newSkillsAcquired: string[];
    userId: string;
    applicationId: string;
}

class PrepAssistantService {
    async generatePrepGuide(input: PrepGuideInput, signal?: AbortSignal): Promise<any> {
        try {
            if (signal?.aborted) return;
            const functions = await getFirebaseFunctions();
            const generatePrepGuide = httpsCallable(functions, 'generatePrepGuide');
            
            // The backend generatePrepGuide handles the Firestore updates (progress 0-100) automatically!
            const response = await generatePrepGuide({
                applicationId: input.applicationId,
                companyName: input.companyName,
                jobTitle: input.jobTitle,
                jobDescription: input.jobDescription,
                optimizedResume: input.optimizedResume,
                matchedSkills: input.matchedSkills,
                partialMatches: input.partialMatches,
                missingSkills: input.missingSkills,
                newSkillsAcquired: input.newSkillsAcquired
            });

            const data = response.data as any;
            if (!data.success) throw new Error(data.error || "Generation failed");

            return data.sections;

        } catch (error: any) {
            if (error.name === 'AbortError' || signal?.aborted) {
                console.log('Prep Guide Generation aborted.');
                return;
            }
            console.error('Prep Guide Generation Error:', error);
            // Fallback status update in case backend crashed before updating
            await applicationService.updatePrepStatus(input.applicationId, {
                status: 'failed',
                progress: 0,
                currentStep: `Failed: ${error.message}`
            });
            throw error;
        }
    }
}
export const prepAssistantService = new PrepAssistantService();
