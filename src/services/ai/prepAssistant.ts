import { openai, safeOpenAICall } from '../../config/ai';
import { perplexityService } from './perplexityService';
import { applicationService } from '../firebase/applicationService';
import { activityService } from '../firebase/activityService';
import { Application } from '../../types/application.types';

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
        const { applicationId, companyName, jobTitle } = input;

        try {


            const sections: any = {};

            // STEP 1: Start
            console.log(`Starting Prep Guide generation for ${applicationId}`);
            if (signal?.aborted) return;

            // DBS: Deduct Tokens & Log Activity
            await activityService.logActivity({
                type: 'interview_prep_generation',
                description: `Interview Prep Guide for ${companyName} - ${jobTitle}`,
                resourceId: applicationId,
                resourceName: companyName,
                aiProvider: 'openai-gpt4o-mini', // Default, fallback might change used provider strictly speaking but logging intent is key
                platform: 'ios'
            });

            await applicationService.updatePrepStatus(applicationId, {
                status: 'generating',
                startedAt: new Date(),
                progress: 0,
                currentStep: `Starting generation...`
            }, true); // true = force new history entry

            sections.companyIntelligence = await perplexityService.generateCompanyResearch(companyName, jobTitle);

            await applicationService.updatePrepStatus(applicationId, {
                progress: 15,
                currentStep: `Analyzing role requirements...`,
                sections: { companyIntelligence: sections.companyIntelligence }
            });

            // STEP 3: Role Analysis (GPT-4o-mini) - 30%
            sections.roleAnalysis = await this.generateRoleAnalysis(input);

            await applicationService.updatePrepStatus(applicationId, {
                progress: 30,
                currentStep: `Creating technical prep plan...`,
                sections: { roleAnalysis: sections.roleAnalysis }
            });

            // STEP 4: Technical Preparation (GPT-4o-mini) - 50%
            sections.technicalPrep = await this.generateTechnicalPrep(input);

            await applicationService.updatePrepStatus(applicationId, {
                progress: 50,
                currentStep: `Generating behavioral framework...`,
                sections: { technicalPrep: sections.technicalPrep }
            });

            // STEP 5: Behavioral Framework (GPT-4o-mini) - 70%
            sections.behavioralFramework = await this.generateBehavioralFramework(input);

            await applicationService.updatePrepStatus(applicationId, {
                progress: 70,
                currentStep: `Mapping your experience to questions...`,
                sections: { behavioralFramework: sections.behavioralFramework }
            });

            // STEP 6: Story Mapping (GPT-4o-mini) - 85%
            sections.storyMapping = await this.generateStoryMapping(input);

            await applicationService.updatePrepStatus(applicationId, {
                progress: 85,
                currentStep: `Finalizing questions & strategy...`,
                sections: { storyMapping: sections.storyMapping }
            });

            // STEP 7: Questions & Strategy (Parallel) - 98%
            const [questionsToAsk, interviewStrategy] = await Promise.all([
                this.generateQuestionsToAsk(input),
                this.generateInterviewStrategy(input)
            ]);

            sections.questionsToAsk = questionsToAsk;
            sections.interviewStrategy = interviewStrategy;

            // Final Update - Generation Complete (PDF generation will happen in UI/Worker or subsequent step)
            // But user requirement says "STEP 4: PDF Document Generation... update progress to 100%"
            // If I generate PDF here, I need expo-print. expo-print works in managed workflow but might need to run on UI thread or have specific polyfills if run in a worker. 
            // Since this service is called from UI (likely), it can handle PDF generation or return the content.
            // Requirement says "Compile into a professional PDF".
            // It's safer to separate data generation from PDF generation.
            // I will mark status as 'completed' (data-wise) or 'generating_pdf'. 
            // Let's assume PDF generation is separate call or managed by caller to handle FileSystem.

            await applicationService.updatePrepStatus(applicationId, {
                progress: 95,
                currentStep: `Compiling final document...`,
                sections: {
                    questionsToAsk,
                    interviewStrategy
                }
            });

            return sections;

            // Note: The UI will detect this state and trigger PDF generation or I can return sections to caller.
            // But the contract says "Background Process".
            // Since we are not running a real background job (no background worker set up for this yet), 
            // this function will likely be called by the client and await.

        } catch (error: any) {
            if (error.name === 'AbortError' || signal?.aborted) {
                console.log('Prep Guide Generation aborted.');
                return;
            }
            console.error('Prep Guide Generation Error:', error);
            await applicationService.updatePrepStatus(applicationId, {
                status: 'failed',
                progress: 0,
                currentStep: `Failed: ${error.message}`
            });
            throw error;
        }
    }

    // --- HELPER METHODS For GPT-4o-mini ---

    private async generateRoleAnalysis(input: PrepGuideInput): Promise<string> {
        const prompt = `You are an expert technical recruiter and career coach. Analyze this job description for interview preparation.

JOB TITLE: ${input.jobTitle}
COMPANY: ${input.companyName}

JOB DESCRIPTION:
${input.jobDescription}

Provide a comprehensive analysis:

## 1. DETAILED ROLE BREAKDOWN
For each major responsibility in the job description, explain:
- What the responsibility really means in practice
- What skills/traits they're looking for
- What success looks like

## 2. SUCCESS METRICS FOR THIS ROLE
What does success look like at:
- First 30 days (onboarding, initial contributions)
- First 90 days (ramp-up, ownership)
- First year (impact, leadership, measurable outcomes)

## 3. CAREER PROGRESSION
- Current level estimation (Junior/Mid/Senior/Staff) based on title and requirements
- Typical next steps from this role
- Timeline for advancement
- Alternative career paths (IC vs management)

## 4. KEY COMPETENCIES BEING EVALUATED
What will interviewers assess:
- Technical skills (specific technologies, systems knowledge)
- Soft skills (leadership, communication, collaboration)
- Domain knowledge (industry-specific expertise)
- Cultural fit factors

## 5. INTERVIEW QUESTION PREDICTIONS
Based on this job description, predict the 10 most likely interview questions:
- Technical questions (coding, system design, architecture)
- Behavioral questions (leadership, teamwork, conflict)
- Role-specific questions (domain expertise)

Be specific, actionable, and realistic. This is for interview preparation.`;

        return this.callGptMini(prompt, 'Role Analysis');
    }

    private async generateTechnicalPrep(input: PrepGuideInput): Promise<string> {
        const prompt = `You are a senior technical interview coach preparing a candidate for a technical interview.

ROLE: ${input.jobTitle}
COMPANY: ${input.companyName}

JOB DESCRIPTION:
${input.jobDescription}

CANDIDATE'S SKILLS:
- Matched skills: ${input.matchedSkills.join(', ')}
- Transferable skills: ${input.partialMatches.join(', ')}
- Skills to develop: ${input.missingSkills.join(', ')}

Create a comprehensive technical preparation guide:

## 1. CORE TECHNICAL TOPICS TO REVIEW
Prioritize topics by likelihood of being tested:

### HIGH PRIORITY (Very likely to be tested)
For each topic:
- What to review
- Why it's important for this role
- Specific concepts/algorithms
- Practice problems (with names if possible)
- Study resources (books, courses, documentation)

### MEDIUM PRIORITY (Possibly tested)
[Same structure as above]

### LOWER PRIORITY (Nice to have)
[Same structure as above]

## 2. TECHNOLOGY STACK DEEP DIVE
Based on the job description, what technologies should the candidate know:
- Programming languages (with expected proficiency level)
- Frameworks and libraries
- Infrastructure/DevOps tools
- Databases and data stores
- Cloud platforms
- Development tools

For each, provide:
- Why it's relevant to this role
- Expected knowledge level (basic/intermediate/advanced)
- Quick refresher resources
- Common interview questions about this technology

## 3. SYSTEM DESIGN INTERVIEW PREP
For a ${input.jobTitle} level role at ${input.companyName}:
- Expected complexity of system design questions
- Common design patterns for this domain
- 5-7 specific practice problems to work through:
  * Problem statement
  * Key concepts to cover
  * Tricky aspects to address
  * Scalability considerations

- System design framework/approach

## 4. CODING INTERVIEW PREP
- Expected difficulty level (LeetCode Easy/Medium/Hard distribution)
- Algorithm categories most relevant to this role
- 10-15 specific practice problems:
  * Problem name/description
  * Why this problem is relevant
  * Key concepts it tests

- Problem-solving approach and communication tips

## 5. STUDY PLAN
Based on the candidate's current skill level, create a study schedule:
- 1-week prep plan (if interview is soon)
- 2-week prep plan (balanced approach)
- 1-month comprehensive plan (thorough preparation)

Include realistic time estimates for each activity.

Be extremely specific. Tailor everything to THIS candidate for THIS specific role at THIS company. Avoid generic advice.`;

        return this.callGptMini(prompt, 'Technical Prep');
    }

    private async generateBehavioralFramework(input: PrepGuideInput): Promise<string> {
        const prompt = `You are an executive interview coach specializing in behavioral interviews using the STAR method.

CANDIDATE RESUME:
${input.optimizedResume}

COMPANY: ${input.companyName}
ROLE: ${input.jobTitle}
JOB DESCRIPTION: ${input.jobDescription}

Create a comprehensive behavioral interview guide:

## 1. STAR METHOD EXPLAINED
- What STAR stands for (Situation, Task, Action, Result)
- How to structure answers (timing: 1.5-2 minutes per story)
- Detailed example of a strong STAR answer
- Common mistakes to avoid
- Tips for making answers concise but impactful

## 2. COMPANY-SPECIFIC COMPETENCIES
Research what ${input.companyName} values in candidates:
- Key competencies (e.g., Google's "Googleyness", Amazon's Leadership Principles, etc.)
- How these competencies are evaluated in behavioral interviews
- What each competency means in practice
- Examples of strong vs weak demonstrations

## 3. TOP 20 BEHAVIORAL QUESTIONS
Specific to ${input.companyName} and ${input.jobTitle}:

For each question provide:
- The question (exact phrasing likely to be used)
- What competency/competencies it evaluates
- What a strong answer includes
- What to avoid in your response
- Tips for structuring your answer

Categories (distribute 20 questions across these):
- Leadership & Initiative (5 questions)
- Problem-Solving & Decision Making (4 questions)
- Collaboration & Conflict Resolution (4 questions)
- Failure & Learning from Mistakes (3 questions)
- Adaptation & Handling Ambiguity (4 questions)

## 4. BEHAVIORAL INTERVIEW TIPS
Specific to ${input.companyName}:
- Interview format and structure
- How many behavioral questions to expect per round
- How much detail to provide in answers
- Body language and delivery tips
- How to transition between questions
- Handling follow-up questions

Be specific and company-focused where possible. These questions should feel tailored to ${input.companyName}'s known interview style.`;

        return this.callGptMini(prompt, 'Behavioral Framework');
    }

    private async generateStoryMapping(input: PrepGuideInput): Promise<string> {
        const prompt = `You are an executive interview coach specializing in preparing candidates by mapping their actual experiences to interview questions.

CANDIDATE'S FULL RESUME:
${input.optimizedResume}

COMPANY: ${input.companyName}
ROLE: ${input.jobTitle}
JOB DESCRIPTION: ${input.jobDescription}

CANDIDATE'S SKILL ANALYSIS:
- Matched Skills: ${input.matchedSkills.join(', ')}
- Transferable Skills: ${input.partialMatches.join(', ')}
- Skills to Develop: ${input.missingSkills.join(', ')}
- Recently Acquired: ${input.newSkillsAcquired.join(', ')}

This is the MOST VALUABLE section of the prep guide. Your task is to analyze their resume and create SPECIFIC, PERSONALIZED story frameworks.

## YOUR STORY MAPPING

For EACH major achievement/experience on their resume (aim for 5-7 strongest experiences):

1. Quote the exact resume bullet point or experience
2. List 2-3 specific behavioral questions this experience could answer
3. Provide a detailed STAR framework outline using their ACTUAL experience:

**Format for each mapping:**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESUME EXPERIENCE: "[Quote exact text from their resume]"

This experience answers these questions:
- "Question 1 text"
- "Question 2 text"  
- "Question 3 text"

STAR Framework for "Question 1":

**Situation:** [Draft 1-2 sentences based on their resume context - be specific]

**Task:** [Draft 1 sentence about their specific responsibility/challenge]

**Action:** [Draft 3-5 bullet points about what THEY specifically did]
- Action point 1 with details
- Action point 2 with details
- Action point 3 with details
- Action point 4 if applicable
- Action point 5 if applicable

**Result:** [Draft 1-2 sentences with quantified outcomes from resume + learning/growth]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**CRITICAL:** Map at least 5-7 of their strongest resume experiences this way.

## STORY GAP ANALYSIS

Based on common interview questions for ${input.companyName} and ${input.jobTitle}, identify missing story types the candidate needs to prepare:

Missing Stories:
- [ ] Story type 1: [What's missing]
      Suggestion: [How to think about experiences to fill this gap]

- [ ] Story type 2: [What's missing]
      Suggestion: [How to think about experiences to fill this gap]

[Continue for 3-5 missing story types]

## SKILL DEVELOPMENT STORIES

For skills they're currently developing (from "Skills to Develop" or "Recently Acquired"):
- How to frame "learning this skill" as a growth story
- Example approach for turning a weakness into a learning narrative
- Specific question this could answer (e.g., "How do you approach learning new technologies?")

## QUICK REFERENCE

Create a simple bullet list summary:
- Experience 1 → Answers: [Questions]
- Experience 2 → Answers: [Questions]
- Experience 3 → Answers: [Questions]
[etc.]

Be EXTREMELY specific and personalized. Use actual content from their resume. Draft actual STAR answers, not just templates. This is worth the candidate paying for - make it invaluable.`;

        return this.callGptMini(prompt, 'Story Mapping');
    }

    private async generateQuestionsToAsk(input: PrepGuideInput): Promise<string> {
        const prompt = `You are an interview coach helping a candidate prepare smart, thoughtful questions to ask interviewers.

COMPANY: ${input.companyName}
ROLE: ${input.jobTitle}
JOB DESCRIPTION: ${input.jobDescription}
CANDIDATE BACKGROUND: ${input.optimizedResume}

Create a comprehensive list of questions the candidate should ask:

## 1. QUESTIONS FOR ENGINEERING MANAGER / HIRING MANAGER

### Technical & Team (3-4 questions):
- Questions about team dynamics, tech stack, processes
- Current technical challenges
- Team structure and collaboration

### Growth & Development (3-4 questions):
- Career growth opportunities
- Learning and development support
- Success metrics for the role

### Culture & Process (3-4 questions):
- How decisions are made
- Work-life balance
- Team culture and values

### Company-Specific (2-3 questions):
- Questions that reference recent ${input.companyName} news or initiatives
- Questions about company direction and strategy

## 2. QUESTIONS FOR TECHNICAL INTERVIEWER (PEER/SENIOR ENGINEER)

### Day-to-Day Work (3 questions):
- Typical day or week
- Favorite aspects of the role
- Tools and technologies used daily

### Technical Environment (3 questions):
- Interesting problems recently worked on
- How team stays current with technology
- Development processes and practices

### Honest Insights (2-3 questions):
- What they wish they knew before joining
- Biggest surprises since joining
- Challenges faced

## 3. QUESTIONS FOR RECRUITER / HR

### Process & Logistics (2-3 questions):
- Next steps in interview process
- Timeline for decision
- Team structure

### Role Clarity (2 questions):
- Performance evaluation process
- Team composition

## 4. QUESTIONS TO AVOID

List 5-7 questions NOT to ask and explain why:
- Question 1: [Why it's problematic]
- Question 2: [Why it's problematic]
[etc.]

Include better alternatives for each.

## 5. QUESTION STRATEGY TIPS

- How many questions to ask in each interview round
- When to ask questions (during vs. at end)
- How to adapt questions based on interviewer responses
- Red flags to listen for in answers

Make questions specific, thoughtful, and tailored to ${input.companyName} and ${input.jobTitle}. Show genuine interest and research.`;

        return this.callGptMini(prompt, 'Questions To Ask');
    }

    private async generateInterviewStrategy(input: PrepGuideInput): Promise<string> {
        const prompt = `You are an interview coach providing practical, actionable advice for interview day preparation and execution.

COMPANY: ${input.companyName}
ROLE: ${input.jobTitle}

Create a comprehensive interview day strategy guide:

## 1. PRE-INTERVIEW CHECKLIST (24 Hours Before)

### Technical Preparation:
- What to review (be specific)
- What NOT to cram
- Warm-up activities
- Practice recommendations

### Logistics:
- Confirm interview details
- Technical setup (if virtual)
- What to bring (if onsite)
- Timing and arrival

### Mental Preparation:
- Mindset techniques
- Stress management
- Confidence building
- Realistic expectations

## 2. THE DAY OF

### Morning Routine:
- Breakfast recommendations
- Final review activities
- Arrival timing
- Pre-interview rituals

### During Interviews:
- How to start strong
- Communication best practices
- Thinking out loud techniques
- Asking for clarification
- Handling questions you don't know
- Time management per round
- Note-taking strategies

### Between Rounds (if onsite):
- Reset techniques
- Managing energy and nerves
- Hydration and breaks
- Avoiding round fixation

### After Interviews:
- Follow-up protocol
- Thank you notes (if appropriate for ${input.companyName})
- Self-reflection
- Timeline expectations

## 3. VIRTUAL INTERVIEW SPECIFIC TIPS

### Technical Setup:
- Internet connection
- Audio/video testing
- Backup plans
- Screen sharing preparation
- Environment setup

### Environment:
- Background
- Lighting
- Noise control
- Professional appearance

### Engagement:
- Camera eye contact
- Body language through video
- Handling technical issues
- Building rapport virtually

## 4. ONSITE INTERVIEW SPECIFIC TIPS

### Arrival:
- When to arrive
- Where to go
- First impressions
- Meeting the team

### Throughout the Day:
- Energy management
- Lunch interviews
- Facility tours
- Casual conversations

## 5. FINAL MINDSET & TIPS

### Managing Nerves:
- Breathing techniques
- Reframing anxiety
- Positive self-talk

### What ${input.companyName} Is Really Looking For:
- Cultural fit indicators
- Key traits they value
- How to demonstrate alignment

### How to Stand Out:
- Memorable techniques
- Authentic engagement
- Showing genuine interest

### If Things Go Poorly:
- Recovering from mistakes
- Handling rejection
- Learning from experience
- Next steps

### Remember:
- Interview is two-way evaluation
- One interview doesn't define you
- Preparation matters but so does authenticity

Be practical, specific, and encouraging. Help the candidate feel prepared and confident.`;

        return this.callGptMini(prompt, 'Interview Strategy');
    }

    private async callGptMini(prompt: string, taskName: string): Promise<string> {
        try {
            const options = {
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are an expert technical interview coach.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 5000,
                temperature: 0.5,
            };

            // safeOpenAICall now has built-in Perplexity fallback for timeouts
            const response = await safeOpenAICall(
                () => openai.chat.completions.create(options as any),
                taskName,
                options
            );

            const content = response.choices[0]?.message?.content;
            if (!content) throw new Error(`No content from OpenAI for ${taskName}`);
            return content.trim();

        } catch (error: any) {
            console.warn(`GPT-4o-mini Error (${taskName}): ${error.message}. Attempting secondary Perplexity fallback.`);

            try {
                // Secondary fallback to Perplexity (in case safeOpenAICall's fallback also failed)
                return await perplexityService.chatCompletion(
                    'You are an expert technical interview coach.',
                    prompt,
                    taskName
                );
            } catch (fallbackError: any) {
                console.error(`Secondary Perplexity fallback also failed (${taskName}):`, fallbackError);
                throw error;
            }
        }
    }
}

export const prepAssistantService = new PrepAssistantService();
