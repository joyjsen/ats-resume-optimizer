import React from 'react';
import { View, ScrollView, StyleSheet, Modal, Dimensions } from 'react-native';
import { Text, Button, Card, Divider, IconButton, useTheme, Portal, Dialog } from 'react-native-paper';

interface Props {
    visible: boolean;
    onClose: () => void;
    parsedData: any; // The full JSON object (contactInfo, experience, etc.)
    rawText: string;
}

const { height } = Dimensions.get('window');

export const ParsedResumeViewer = ({ visible, onClose, parsedData, rawText }: Props) => {
    const theme = useTheme();
    const [activeTab, setActiveTab] = React.useState<'json' | 'text'>('json');

    const renderJsonContent = () => {
        if (!parsedData) return <Text>No structured data available.</Text>;

        return (
            <View style={{ gap: 16 }}>
                {/* Contact Info */}
                <Card mode="outlined" style={styles.card}>
                    <Card.Title title="Contact Information" left={(props) => <IconButton {...props} icon="account" />} />
                    <Card.Content>
                        {parsedData.contactInfo ? (
                            Object.entries(parsedData.contactInfo).map(([key, value]) => (
                                <View key={key} style={styles.row}>
                                    <Text style={styles.label}>{key}: </Text>
                                    <Text style={styles.value}>{String(value)}</Text>
                                </View>
                            ))
                        ) : (
                            <Text style={{ color: theme.colors.error }}>❌ Missing Contact Info</Text>
                        )}
                    </Card.Content>
                </Card>

                {/* Summary */}
                <Card mode="outlined" style={styles.card}>
                    <Card.Title title="Professional Summary" left={(props) => <IconButton {...props} icon="text-box" />} />
                    <Card.Content>
                        {parsedData.summary ? (
                            <Text>{parsedData.summary}</Text>
                        ) : (
                            <Text style={{ color: theme.colors.error }}>❌ Missing Summary</Text>
                        )}
                    </Card.Content>
                </Card>

                {/* Skills */}
                <Card mode="outlined" style={styles.card}>
                    <Card.Title title={`Skills (${parsedData.skills?.length || 0})`} left={(props) => <IconButton {...props} icon="flash" />} />
                    <Card.Content>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {parsedData.skills?.map((skill: any, idx: number) => (
                                <View key={idx} style={[styles.chip, { backgroundColor: theme.colors.secondaryContainer }]}>
                                    <Text style={{ color: theme.colors.onSecondaryContainer }}>{skill.name || skill}</Text>
                                </View>
                            ))}
                        </View>
                    </Card.Content>
                </Card>

                {/* Experience */}
                <Card mode="outlined" style={styles.card}>
                    <Card.Title title={`Experience (${parsedData.experience?.length || 0})`} left={(props) => <IconButton {...props} icon="briefcase" />} />
                    <Card.Content>
                        {parsedData.experience?.map((exp: any, idx: number) => (
                            <View key={idx} style={{ marginBottom: 16 }}>
                                <Text style={{ fontWeight: 'bold' }}>{exp.title} at {exp.company}</Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>{exp.startDate} - {exp.endDate || 'Present'}</Text>
                                {exp.bullets && (
                                    <View style={{ marginTop: 4, paddingLeft: 8 }}>
                                        {exp.bullets.map((b: string, i: number) => (
                                            <Text key={i} variant="bodySmall">• {b}</Text>
                                        ))}
                                    </View>
                                )}
                                <Divider style={{ marginTop: 8 }} />
                            </View>
                        ))}
                    </Card.Content>
                </Card>

                {/* Education */}
                <Card mode="outlined" style={styles.card}>
                    <Card.Title title={`Education (${parsedData.education?.length || 0})`} left={(props) => <IconButton {...props} icon="school" />} />
                    <Card.Content>
                        {parsedData.education?.map((edu: any, idx: number) => (
                            <View key={idx} style={{ marginBottom: 16 }}>
                                <Text style={{ fontWeight: 'bold' }}>{edu.degree} in {edu.field}</Text>
                                <Text variant="bodySmall">{edu.institution}</Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>{edu.startDate} - {edu.endDate}</Text>
                                {edu.relevantCoursework?.length > 0 && (
                                    <Text variant="bodySmall" style={{ marginTop: 4 }}>
                                        <Text style={{ fontWeight: 'bold' }}>Coursework: </Text>
                                        {edu.relevantCoursework.join(', ')}
                                    </Text>
                                )}
                                <Divider style={{ marginTop: 8 }} />
                            </View>
                        ))}
                    </Card.Content>
                </Card>

                {/* Certifications */}
                <Card mode="outlined" style={styles.card}>
                    <Card.Title title={`Certifications (${parsedData.certifications?.length || 0})`} left={(props) => <IconButton {...props} icon="certificate" />} />
                    <Card.Content>
                        <View style={{ gap: 8 }}>
                            {parsedData.certifications?.map((cert: any, idx: number) => (
                                <View key={idx}>
                                    <Text style={{ fontWeight: 'bold' }}>{cert.name}</Text>
                                    <Text variant="bodySmall">{cert.issuer} • {cert.date}</Text>
                                </View>
                            ))}
                        </View>
                    </Card.Content>
                </Card>

                {/* Projects */}
                <Card mode="outlined" style={styles.card}>
                    <Card.Title title={`Projects (${parsedData.projects?.length || 0})`} left={(props) => <IconButton {...props} icon="folder-account" />} />
                    <Card.Content>
                        {parsedData.projects?.map((proj: any, idx: number) => (
                            <View key={idx} style={{ marginBottom: 12 }}>
                                <Text style={{ fontWeight: 'bold' }}>{proj.name}</Text>
                                <Text variant="bodySmall">{proj.description}</Text>
                                {proj.technologies && (
                                    <Text variant="bodySmall" style={{ color: theme.colors.primary, marginTop: 2 }}>
                                        {proj.technologies.join(' • ')}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </Card.Content>
                </Card>

                {/* Debug: Raw JSON */}
                <Card mode="outlined" style={[styles.card, { borderColor: theme.colors.outlineVariant }]}>
                    <Card.Title title="Raw JSON Structure" />
                    <Card.Content>
                        <Text style={{ fontFamily: 'monospace', fontSize: 10 }}>
                            {JSON.stringify(parsedData, null, 2)}
                        </Text>
                    </Card.Content>
                </Card>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outlineVariant }]}>
                    <Text variant="titleMedium">Parsed Resume Data</Text>
                    <IconButton icon="close" onPress={onClose} />
                </View>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <Button
                        mode={activeTab === 'json' ? 'contained' : 'text'}
                        onPress={() => setActiveTab('json')}
                        style={{ flex: 1 }}
                    >
                        Structured Data
                    </Button>
                    <Button
                        mode={activeTab === 'text' ? 'contained' : 'text'}
                        onPress={() => setActiveTab('text')}
                        style={{ flex: 1 }}
                    >
                        Raw Text
                    </Button>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {activeTab === 'json' ? renderJsonContent() : (
                        <Card mode="outlined" style={styles.card}>
                            <Card.Content>
                                <Text style={{ fontFamily: 'monospace' }}>{rawText || "No raw text extracted."}</Text>
                            </Card.Content>
                        </Card>
                    )}
                </ScrollView>

                <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant }}>
                    <Button mode="contained" onPress={onClose}>
                        Close & Continue
                    </Button>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingTop: 20,
        borderBottomWidth: 1,
    },
    tabContainer: {
        flexDirection: 'row',
        padding: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 4,
    },
    label: {
        fontWeight: 'bold',
        opacity: 0.7,
    },
    value: {
        flex: 1,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    }
});
