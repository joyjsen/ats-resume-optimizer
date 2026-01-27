
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import * as FS from 'expo-file-system/legacy';
const FileSystem = FS as any;
import * as Sharing from 'expo-sharing';
import { ParsedResume } from '../../types/resume.types';
import { Buffer } from 'buffer';

export class DocxGenerator {
    static async generateAndShare(resume: ParsedResume) {
        // ... (code omitted for brevity, logic unchanged) ...
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    // Header
                    new Paragraph({
                        text: resume.contactInfo.name,
                        heading: HeadingLevel.HEADING_1,
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: `${resume.contactInfo.email} | ${resume.contactInfo.phone}`, size: 24 }),
                            ...(resume.contactInfo.linkedin ? [new TextRun({ text: ` | ${resume.contactInfo.linkedin}`, size: 24 })] : []),
                        ],
                    }),
                    new Paragraph({ text: "" }), // Spacer

                    // Professional Summary
                    new Paragraph({
                        text: "PROFESSIONAL SUMMARY",
                        heading: HeadingLevel.HEADING_2,
                        border: { bottom: { color: "auto", space: 1, style: "single", size: 6 } }
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: resume.summary, size: 24 })],
                        spacing: { after: 200 },
                    }),

                    // Experience
                    new Paragraph({
                        text: "EXPERIENCE",
                        heading: HeadingLevel.HEADING_2,
                        border: { bottom: { color: "auto", space: 1, style: "single", size: 6 } }
                    }),
                    ...resume.experience.flatMap(exp => [
                        new Paragraph({
                            children: [
                                new TextRun({ text: exp.title, bold: true, size: 24 }),
                                new TextRun({ text: ` at ${exp.company}`, size: 24, italics: true }),
                            ],
                            spacing: { before: 200 }
                        }),
                        new Paragraph({
                            text: `${exp.startDate} - ${exp.current ? 'Present' : exp.endDate || ''}`,
                            alignment: AlignmentType.RIGHT,
                        }),
                        ...exp.bullets.map(bullet =>
                            new Paragraph({
                                text: bullet,
                                bullet: { level: 0 },
                            })
                        )
                    ]),

                    new Paragraph({ text: "" }),

                    // Skills
                    new Paragraph({
                        text: "SKILLS",
                        heading: HeadingLevel.HEADING_2,
                        border: { bottom: { color: "auto", space: 1, style: "single", size: 6 } }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: resume.skills.map(s => s.name).join(" • "),
                                size: 24
                            })
                        ]
                    }),

                    // Education
                    ...(resume.education.length > 0 ? [
                        new Paragraph({ text: "" }),
                        new Paragraph({
                            text: "EDUCATION",
                            heading: HeadingLevel.HEADING_2,
                            border: { bottom: { color: "auto", space: 1, style: "single", size: 6 } }
                        }),
                        ...resume.education.flatMap(edu => [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: edu.institution, bold: true, size: 24 }),
                                    new TextRun({ text: ` - ${edu.degree}`, size: 24 }),
                                    ...(edu.endDate ? [new TextRun({ text: ` (${edu.endDate})`, size: 24 })] : [])
                                ]
                            })
                        ])
                    ] : [])
                ],
            }],
        });

        const packer = Packer.toBase64String(doc);
        const b64 = await packer;

        console.log("FileSystem Keys:", Object.keys(FileSystem));

        if (!FileSystem.documentDirectory) {
            console.log("Legacy documentDirectory is null/undefined. Attempting standard import fallback or cache.");
            // Fallback isn't easy if we can't import main. 
            // But logging keys will tell us where it is.
            // If legacy is missing it, we are in trouble.
        }

        const filename = (FileSystem.documentDirectory || FileSystem.cacheDirectory) + "optimized_resume.docx";

        await FileSystem.writeAsStringAsync(filename, b64, {
            encoding: 'base64',
        });

        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(filename);
        } else {
            console.warn("Sharing is not available on this platform");
        }
    }

    static async generateCoverLetter(content: string) {
        const paragraphs = content.split('\n').map(line => {
            // Check if line looks like a header/salutation
            // Simple heuristic: short lines usually header/footer
            return new Paragraph({
                children: [
                    new TextRun({
                        text: line.trim(),
                        size: 24, // 12pt
                        font: "Calibri"
                    })
                ],
                spacing: { after: 120 } // slight spacing
            });
        });

        const doc = new Document({
            sections: [{
                properties: {},
                children: paragraphs
            }]
        });

        const packer = Packer.toBase64String(doc);
        const b64 = await packer;

        const filename = (FileSystem.documentDirectory || FileSystem.cacheDirectory) + "cover_letter.docx";

        await FileSystem.writeAsStringAsync(filename, b64, {
            encoding: 'base64',
        });

        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(filename);
        } else {
            console.warn("Sharing is not available on this platform");
        }
    }
}
