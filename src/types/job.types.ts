export interface JobPosting {
    id: string;
    url: string;
    title: string;
    company: string;
    location?: string;
    salary?: string;
    type?: 'full-time' | 'part-time' | 'contract' | 'internship';
    remote?: boolean;
    description: string;
    requirements: JobRequirements;
    parsedAt: Date;
}

export interface JobRequirements {
    mustHaveSkills: RequiredSkill[];
    niceToHaveSkills: RequiredSkill[];
    experienceLevel: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
    yearsExperience?: string;
    education?: string[];
    certifications?: string[];
    keywords: string[];
}

export interface RequiredSkill {
    name: string;
    importance: 'critical' | 'high' | 'medium' | 'low';
    category: string;
}
