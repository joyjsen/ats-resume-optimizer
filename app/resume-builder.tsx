import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Appbar, TextInput, Button, Card, Text, useTheme, IconButton, Divider, Portal, Dialog } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getFirebaseAuth } from '../src/services/firebase/config';
import { generatedResumeService } from '../src/services/firebase/generatedResumeService';
import { ParsedResume, Experience, Education, Skill, Certification, Project } from '../src/types/resume.types';
import { horizontalScale, verticalScale, moderateScale, scaleFont } from '../src/utils/responsive';
import { useProfileStore } from '../src/store/profileStore';

export default function ResumeBuilderScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { userProfile } = useProfileStore();
    
    const [resumeName, setResumeName] = useState('My Custom Resume');
    const [isSaving, setIsSaving] = useState(false);
    const [saveDialogVisible, setSaveDialogVisible] = useState(false);

    const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

    const [contactInfo, setContactInfo] = useState<ParsedResume['contactInfo']>({
        name: '',
        email: '',
        phone: '',
        location: '',
        linkedin: ''
    });

    const [education, setEducation] = useState<Education[]>([{
        id: generateId(),
        institution: '',
        degree: '',
        field: '',
        startDate: '',
        endDate: ''
    }]);

    useEffect(() => {
        getFirebaseAuth().then(auth => {
            if (auth.currentUser) {
                setContactInfo(prev => ({
                    ...prev,
                    name: prev.name || auth.currentUser?.displayName || userProfile?.displayName || userProfile?.firstName || '',
                    email: prev.email || auth.currentUser?.email || userProfile?.email || '',
                    phone: prev.phone || userProfile?.phoneNumber || ''
                }));
            }
            
            if (userProfile?.jobTitle || userProfile?.currentOrganization) {
                setExperiences(prev => {
                    const firstExp = prev[0];
                    if (!firstExp.title && !firstExp.company && !firstExp.bullets[0]) {
                        return [{
                            ...firstExp,
                            title: userProfile?.jobTitle || '',
                            company: userProfile?.currentOrganization || '',
                            current: true
                        }, ...prev.slice(1)];
                    }
                    return prev;
                });
            }
        });
    }, [userProfile]);

    const [summary, setSummary] = useState('');

    const [experiences, setExperiences] = useState<Experience[]>([{
        id: generateId(),
        company: '',
        title: '',
        startDate: '',
        endDate: '',
        current: false,
        bullets: ['']
    }]);

    const [skills, setSkills] = useState<Skill[]>([{
        name: '',
        category: 'technical',
        proficiency: 'intermediate'
    }]);

    const [certifications, setCertifications] = useState<Certification[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    
    const addExperience = () => {
        setExperiences([...experiences, {
            id: generateId(),
            company: '',
            title: '',
            startDate: '',
            endDate: '',
            current: false,
            bullets: ['']
        }]);
    };

    const updateExperience = (id: string, field: keyof Experience, value: any) => {
        setExperiences(experiences.map(exp => exp.id === id ? { ...exp, [field]: value } : exp));
    };

    const removeExperience = (id: string) => {
        setExperiences(experiences.filter(exp => exp.id !== id));
    };

    const addBullet = (expId: string) => {
        setExperiences(experiences.map(exp => exp.id === expId ? { ...exp, bullets: [...exp.bullets, ''] } : exp));
    };

    const updateBullet = (expId: string, index: number, value: string) => {
        setExperiences(experiences.map(exp => {
            if (exp.id === expId) {
                const newBullets = [...exp.bullets];
                newBullets[index] = value;
                return { ...exp, bullets: newBullets };
            }
            return exp;
        }));
    };

    const removeBullet = (expId: string, index: number) => {
        setExperiences(experiences.map(exp => {
            if (exp.id === expId) {
                const newBullets = [...exp.bullets];
                newBullets.splice(index, 1);
                return { ...exp, bullets: newBullets };
            }
            return exp;
        }));
    };

    const addEducation = () => {
        setEducation([...education, {
            id: generateId(),
            institution: '',
            degree: '',
            field: '',
            startDate: '',
            endDate: ''
        }]);
    };

    const updateEducation = (id: string, field: keyof Education, value: any) => {
        setEducation(education.map(edu => edu.id === id ? { ...edu, [field]: value } : edu));
    };

    const removeEducation = (id: string) => {
        setEducation(education.filter(edu => edu.id !== id));
    };

    const addSkill = () => {
        setSkills([...skills, { name: '', category: 'technical', proficiency: 'intermediate' }]);
    };

    const updateSkill = (index: number, name: string) => {
        const newSkills = [...skills];
        newSkills[index].name = name;
        setSkills(newSkills);
    };

    const removeSkill = (index: number) => {
        const newSkills = [...skills];
        newSkills.splice(index, 1);
        setSkills(newSkills);
    };

    const addCertification = () => setCertifications([...certifications, { name: '', issuer: '', date: '' }]);
    const updateCertification = (index: number, field: keyof Certification, value: string) => {
        const newCerts = [...certifications];
        newCerts[index] = { ...newCerts[index], [field]: value };
        setCertifications(newCerts);
    };
    const removeCertification = (index: number) => {
        const newCerts = [...certifications];
        newCerts.splice(index, 1);
        setCertifications(newCerts);
    };

    const addProject = () => setProjects([...projects, { name: '', description: '', technologies: [] }]);
    const updateProject = (index: number, field: keyof Project, value: string) => {
        const newProj = [...projects];
        newProj[index] = { ...newProj[index], [field]: value };
        setProjects(newProj);
    };
    const updateProjectTechnologies = (index: number, techString: string) => {
        const newProj = [...projects];
        newProj[index].technologies = techString.split(',').map(t => t.trim()).filter(t => t.length > 0);
        setProjects(newProj);
    };
    const removeProject = (index: number) => {
        const newProj = [...projects];
        newProj.splice(index, 1);
        setProjects(newProj);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const auth = await getFirebaseAuth();
            const currentUser = auth.currentUser;
            
            if (!currentUser) {
                setSaveDialogVisible(false);
                setTimeout(() => {
                    Alert.alert("Auth Error", "No active user session found. Please log in again.");
                }, 300);
                return;
            }

            // Duplicate Name Check
            const existingResumes = await generatedResumeService.fetchGeneratedResumes(currentUser.uid);
            const isNameTaken = existingResumes.some(r => r.name.trim().toLowerCase() === resumeName.trim().toLowerCase());
            
            if (isNameTaken) {
                Alert.alert("Name Unavailable", "A saved resume with this name already exists. Please choose a different name.");
                setIsSaving(false);
                return;
            }
            
            const parsedData: ParsedResume = {
                contactInfo,
                summary,
                experience: experiences.filter(exp => exp.company.trim() !== '' && exp.title.trim() !== ''),
                education: education.filter(edu => edu.institution.trim() !== '' && edu.degree.trim() !== ''),
                skills: skills.filter(skill => skill.name.trim() !== ''),
                certifications: certifications.filter(cert => cert.name.trim() !== ''),
                projects: projects.filter(proj => proj.name.trim() !== ''),
            };

            await generatedResumeService.saveGeneratedResume(currentUser.uid, resumeName, parsedData);
            setSaveDialogVisible(false);
            
            // Artificial delay to allow modal close animation to cleanly pass before routing
            setTimeout(() => {
                router.back();
            }, 300);
            
        } catch (error: any) {
            console.error(error);
            setSaveDialogVisible(false);
            setTimeout(() => {
                Alert.alert("Save Failed", "Encountered a problem saving to the cloud: " + (error.message || String(error)));
            }, 300);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Portal.Host>
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <Appbar.Header elevated>
                    <Appbar.BackAction onPress={() => router.back()} />
                    <Appbar.Content title="Resume Builder" />
                    <Button mode="contained" onPress={() => setSaveDialogVisible(true)} compact>Save</Button>
                </Appbar.Header>

                <KeyboardAvoidingView 
                    style={{ flex: 1 }} 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Text variant="bodySmall" style={{ textAlign: 'center', opacity: 0.6, marginTop: 4, marginBottom: 8 }}>
                        👇 Scroll down to complete your resume structure
                    </Text>

                    {/* Basic Info */}
                    <Card style={styles.card}>
                        <Card.Content>
                            <Text variant="titleMedium" style={styles.sectionTitle}>Contact Information</Text>
                            <TextInput
                                label="Full Name"
                                value={contactInfo.name}
                                onChangeText={(val) => setContactInfo({ ...contactInfo, name: val })}
                                mode={Platform.OS === 'web' ? 'flat' : 'outlined'}
                                style={styles.input}
                            />
                            <TextInput
                                label="Email Address"
                                value={contactInfo.email}
                                onChangeText={(val) => setContactInfo({ ...contactInfo, email: val })}
                                mode={Platform.OS === 'web' ? 'flat' : 'outlined'}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                style={styles.input}
                            />
                            <TextInput
                                label="Phone Number"
                                value={contactInfo.phone || ''}
                                onChangeText={(val) => setContactInfo({ ...contactInfo, phone: val })}
                                mode={Platform.OS === 'web' ? 'flat' : 'outlined'}
                                keyboardType="phone-pad"
                                style={styles.input}
                            />
                            <TextInput
                                label="Location (City, State)"
                                value={contactInfo.location || ''}
                                onChangeText={(val) => setContactInfo({ ...contactInfo, location: val })}
                                mode={Platform.OS === 'web' ? 'flat' : 'outlined'}
                                style={styles.input}
                            />
                        </Card.Content>
                    </Card>

                    <Card style={styles.card}>
                        <Card.Content>
                            <Text variant="titleMedium" style={styles.sectionTitle}>Summary (Optional)</Text>
                            <TextInput
                                label="Professional Summary"
                                value={summary}
                                onChangeText={setSummary}
                                mode={Platform.OS === 'web' ? 'flat' : 'outlined'}
                                multiline
                                numberOfLines={4}
                                style={styles.input}
                            />
                        </Card.Content>
                    </Card>

                    {/* Experiences */}
                    <Card style={styles.card}>
                        <Card.Content>
                            <View style={styles.sectionHeader}>
                                <Text variant="titleMedium">Experience</Text>
                                <Button mode="text" onPress={addExperience} icon="plus">Add</Button>
                            </View>
                            
                            {experiences.map((exp, expIdx) => (
                                <View key={exp.id} style={styles.itemContainer}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text variant="labelLarge" style={{ color: theme.colors.primary }}>Role {expIdx + 1}</Text>
                                        <IconButton icon="trash-can-outline" iconColor={theme.colors.error} size={20} onPress={() => removeExperience(exp.id)} />
                                    </View>
                                    <TextInput label="Job Title" value={exp.title} onChangeText={(val) => updateExperience(exp.id, 'title', val)} mode={Platform.OS === 'web' ? 'flat' : 'outlined'} style={styles.input} />
                                    <TextInput label="Company" value={exp.company} onChangeText={(val) => updateExperience(exp.id, 'company', val)} mode={Platform.OS === 'web' ? 'flat' : 'outlined'} style={styles.input} />
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TextInput label="Start Date" value={exp.startDate} onChangeText={(val) => updateExperience(exp.id, 'startDate', val)} mode={Platform.OS === 'web' ? 'flat' : 'outlined'} style={[styles.input, { flex: 1 }]} placeholder="MM/YYYY" />
                                        <TextInput label="End Date" value={exp.endDate} onChangeText={(val) => updateExperience(exp.id, 'endDate', val)} mode={Platform.OS === 'web' ? 'flat' : 'outlined'} style={[styles.input, { flex: 1 }]} placeholder="MM/YYYY or Present" />
                                    </View>
                                    
                                    <Text variant="bodySmall" style={{ marginTop: 8, marginBottom: 4, fontWeight: 'bold' }}>Bullet Points</Text>
                                    {exp.bullets.map((bullet, bIdx) => (
                                        <View key={bIdx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                            <TextInput 
                                                value={bullet} 
                                                onChangeText={(val) => updateBullet(exp.id, bIdx, val)} 
                                                mode={Platform.OS === 'web' ? 'flat' : 'outlined'} 
                                                style={{ flex: 1, backgroundColor: theme.colors.surfaceVariant }} 
                                                multiline
                                                placeholder="Describe your achievement..."
                                            />
                                            <IconButton icon="close" size={20} onPress={() => removeBullet(exp.id, bIdx)} />
                                        </View>
                                    ))}
                                    <Button mode={Platform.OS === 'web' ? 'flat' : 'outlined'} onPress={() => addBullet(exp.id)} style={{ alignSelf: 'flex-start', marginTop: 4 }}>+ Add Bullet</Button>
                                    {expIdx < experiences.length - 1 && <Divider style={{ marginVertical: 16 }} />}
                                </View>
                            ))}
                        </Card.Content>
                    </Card>

                    {/* Education */}
                    <Card style={styles.card}>
                        <Card.Content>
                            <View style={styles.sectionHeader}>
                                <Text variant="titleMedium">Education</Text>
                                <Button mode="text" onPress={addEducation} icon="plus">Add</Button>
                            </View>
                            
                            {education.map((edu, eduIdx) => (
                                <View key={edu.id} style={styles.itemContainer}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text variant="labelLarge" style={{ color: theme.colors.primary }}>Education {eduIdx + 1}</Text>
                                        <IconButton icon="trash-can-outline" iconColor={theme.colors.error} size={20} onPress={() => removeEducation(edu.id)} />
                                    </View>
                                    <TextInput label="Institution" value={edu.institution} onChangeText={(val) => updateEducation(edu.id, 'institution', val)} mode={Platform.OS === 'web' ? 'flat' : 'outlined'} style={styles.input} />
                                    <TextInput label="Degree (e.g. Bachelor of Science)" value={edu.degree} onChangeText={(val) => updateEducation(edu.id, 'degree', val)} mode={Platform.OS === 'web' ? 'flat' : 'outlined'} style={styles.input} />
                                    <TextInput label="Field of Study" value={edu.field} onChangeText={(val) => updateEducation(edu.id, 'field', val)} mode={Platform.OS === 'web' ? 'flat' : 'outlined'} style={styles.input} />
                                </View>
                            ))}
                        </Card.Content>
                    </Card>

                    {/* Skills */}
                    <Card style={styles.card}>
                        <Card.Content>
                            <View style={styles.sectionHeader}>
                                <Text variant="titleMedium">Skills</Text>
                                <Button mode="text" onPress={addSkill} icon="plus">Add</Button>
                            </View>
                            
                            {skills.map((skill, sIdx) => (
                                <View key={sIdx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <TextInput 
                                        label={`Skill ${sIdx + 1}`} 
                                        value={skill.name} 
                                        onChangeText={(val) => updateSkill(sIdx, val)} 
                                        mode={Platform.OS === 'web' ? 'flat' : 'outlined'} 
                                        style={{ flex: 1 }} 
                                    />
                                    <IconButton icon="close" size={20} onPress={() => removeSkill(sIdx)} />
                                </View>
                            ))}
                        </Card.Content>
                    </Card>

                    {/* Certifications */}
                    <Card style={styles.card}>
                        <Card.Content>
                            <View style={styles.sectionHeader}>
                                <Text variant="titleMedium">Certifications</Text>
                                <Button mode="text" onPress={addCertification} icon="plus">Add</Button>
                            </View>
                            
                            {certifications.map((cert, cIdx) => (
                                <View key={cIdx} style={styles.itemContainer}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text variant="labelLarge" style={{ color: theme.colors.primary }}>Certification {cIdx + 1}</Text>
                                        <IconButton icon="trash-can-outline" iconColor={theme.colors.error} size={20} onPress={() => removeCertification(cIdx)} />
                                    </View>
                                    <TextInput label="Certification Name" value={cert.name} onChangeText={(val) => updateCertification(cIdx, 'name', val)} mode={Platform.OS === 'web' ? 'flat' : 'outlined'} style={styles.input} />
                                    <TextInput label="Issuer (e.g. AWS, Microsoft)" value={cert.issuer} onChangeText={(val) => updateCertification(cIdx, 'issuer', val)} mode={Platform.OS === 'web' ? 'flat' : 'outlined'} style={styles.input} />
                                    <TextInput label="Date (e.g. 2023)" value={cert.date} onChangeText={(val) => updateCertification(cIdx, 'date', val)} mode={Platform.OS === 'web' ? 'flat' : 'outlined'} style={styles.input} />
                                </View>
                            ))}
                        </Card.Content>
                    </Card>

                    {/* Projects */}
                    <Card style={styles.card}>
                        <Card.Content>
                            <View style={styles.sectionHeader}>
                                <Text variant="titleMedium">Projects</Text>
                                <Button mode="text" onPress={addProject} icon="plus">Add</Button>
                            </View>
                            
                            {projects.map((proj, pIdx) => (
                                <View key={pIdx} style={styles.itemContainer}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text variant="labelLarge" style={{ color: theme.colors.primary }}>Project {pIdx + 1}</Text>
                                        <IconButton icon="trash-can-outline" iconColor={theme.colors.error} size={20} onPress={() => removeProject(pIdx)} />
                                    </View>
                                    <TextInput label="Project Name" value={proj.name} onChangeText={(val) => updateProject(pIdx, 'name', val)} mode={Platform.OS === 'web' ? 'flat' : 'outlined'} style={styles.input} />
                                    <TextInput label="Description" value={proj.description} onChangeText={(val) => updateProject(pIdx, 'description', val)} mode={Platform.OS === 'web' ? 'flat' : 'outlined'} style={styles.input} multiline numberOfLines={3} />
                                    <TextInput label="Technologies (comma separated)" value={proj.technologies ? proj.technologies.join(', ') : ''} onChangeText={(val) => updateProjectTechnologies(pIdx, val)} mode={Platform.OS === 'web' ? 'flat' : 'outlined'} style={styles.input} />
                                    <TextInput label="URL (Optional)" value={proj.url || ''} onChangeText={(val) => updateProject(pIdx, 'url', val)} mode={Platform.OS === 'web' ? 'flat' : 'outlined'} style={styles.input} autoCapitalize="none" keyboardType="url" />
                                </View>
                            ))}
                        </Card.Content>
                    </Card>
                    
                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            <Portal>
                <Dialog visible={saveDialogVisible} onDismiss={() => !isSaving && setSaveDialogVisible(false)}>
                    <Dialog.Title>Save Generated Resume</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Resume Name"
                            value={resumeName}
                            onChangeText={setResumeName}
                            mode={Platform.OS === 'web' ? 'flat' : 'outlined'}
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setSaveDialogVisible(false)} disabled={isSaving}>Cancel</Button>
                        <Button mode="contained" onPress={handleSave} loading={isSaving} disabled={!resumeName.trim() || isSaving}>Save</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
        </Portal.Host>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: horizontalScale(16),
        paddingBottom: verticalScale(40),
        gap: verticalScale(16)
    },
    card: {
        borderRadius: moderateScale(12),
        elevation: 2,
    },
    sectionTitle: {
        marginBottom: 12,
        fontWeight: 'bold'
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    input: {
        marginBottom: 12,
    },
    itemContainer: {
        marginBottom: 16
    }
});
