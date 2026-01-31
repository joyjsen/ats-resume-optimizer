import React from 'react';
import { View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Card, Text, List, Avatar, Button, useTheme } from 'react-native-paper';
import { UpskillPath, SkillToLearn } from '../../types/analysis.types';

interface Props {
    upskillPath: UpskillPath;
}

export const UpskillRoadmap = ({ upskillPath }: Props) => {
    const theme = useTheme();

    const renderSkill = (skill: SkillToLearn, index: number) => (
        <View key={skill.skill} style={styles.stepContainer}>
            <View style={styles.timeline}>
                <View style={[styles.line, index === 0 && styles.firstLine]} />
                <Avatar.Text size={24} label={(index + 1).toString()} style={styles.number} />
                <View style={[styles.line, index === upskillPath.skills.length - 1 && styles.lastLine]} />
            </View>

            <Card style={[styles.card, { flex: 1 }]}>
                <Card.Title
                    title={skill.skill}
                    subtitle={`${skill.estimatedTime} • Priority ${skill.priority}`}
                />
                <Card.Content>
                    <Text variant="titleSmall">Recommended Courses</Text>
                    {skill.courses.slice(0, 2).map((course, i) => (
                        <TouchableOpacity key={i} onPress={() => Linking.openURL(course.url)}>
                            <List.Item
                                title={course.name}
                                description={`${course.platform} • ${course.cost === 0 ? 'Free' : '$' + course.cost}`}
                                left={props => <List.Icon {...props} icon="school" />}
                                right={props => <List.Icon {...props} icon="open-in-new" />}
                            />
                        </TouchableOpacity>
                    ))}
                </Card.Content>
            </Card>
        </View>
    );

    return (
        <View>
            {upskillPath.skills.map(renderSkill)}
        </View>
    );
};

const styles = StyleSheet.create({
    stepContainer: {
        flexDirection: 'row',
        marginBottom: 0,
    },
    timeline: {
        width: 40,
        alignItems: 'center',
    },
    line: {
        width: 2,
        flex: 1,
        backgroundColor: '#ccc',
    },
    firstLine: {
        opacity: 0,
    },
    lastLine: {
        opacity: 0,
    },
    number: {
        backgroundColor: '#6200ee',
    },
    card: {
        marginBottom: 16,
        marginLeft: 8,
    },
});
