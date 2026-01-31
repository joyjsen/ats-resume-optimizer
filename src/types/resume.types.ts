export interface Resume {
    id: string;
    userId: string;
    originalFile: {
        name: string;
        url: string;
        type: 'pdf' | 'docx';
        uploadedAt: Date;
    };
    parsedData: ParsedResume;
    optimizedVersions: OptimizedVersion[];
    createdAt: Date;
    updatedAt: Date;
}

export interface ParsedResume {
    contactInfo: {
        name: string;
        email: string;
        phone?: string;
        location?: string;
        linkedin?: string;
        portfolio?: string;
        github?: string;
    };
    summary?: string;
    experience: Experience[];
    education: Education[];
    skills: Skill[];
    certifications?: Certification[];
    projects?: Project[];
}

export interface Experience {
    id: string;
    company: string;
    title: string;
    location?: string;
    startDate: string;
    endDate?: string;
    current: boolean;
    bullets: string[];
}

export interface Education {
    id: string;
    institution: string;
    degree: string;
    field: string;
    startDate?: string;
    endDate?: string;
    gpa?: string;
}

export interface Skill {
    name: string;
    category: 'technical' | 'soft' | 'language' | 'tool' | 'framework';
    proficiency?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface Certification {
    name: string;
    issuer: string;
    date: string;
}

export interface Project {
    name: string;
    description: string;
    technologies: string[];
    url?: string;
}

export interface OptimizedVersion {
    id: string;
    jobUrl: string;
    jobTitle: string;
    company: string;
    atsScore: number;
    optimizedData: ParsedResume;
    changesApplied: OptimizationChange[];
    createdAt: Date;
    exported: boolean;
    exportedFormats?: ('pdf' | 'docx')[];
}

export interface OptimizationChange {
    type: 'keyword_added' | 'bullet_rewritten' | 'skill_added' | 'summary_updated' | 'skill_addition' | 'experience_improvement' | 'summary_rewrite';
    section: string;
    original?: string;
    modified: string;
    skill?: string;
    reason: string;
}
