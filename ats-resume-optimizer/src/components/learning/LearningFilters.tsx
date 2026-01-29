import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Chip, Menu, Button, Divider, useTheme, Surface } from 'react-native-paper';
import { LearningEntry, LearningPath } from '../../types/learning.types';

export type LearningSortOption =
    | 'recent' | 'skill_asc' | 'skill_desc'
    | 'progress_desc' | 'company_asc';

export interface LearningFilterState {
    paths: LearningPath[];
    companies: string[];
    dateRange: 'all' | '7days' | '30days';
}

interface Props {
    entries: LearningEntry[];
    onFilterChange: (filters: LearningFilterState) => void;
    currentSort: LearningSortOption;
    onSortChange: (sort: LearningSortOption) => void;
}

export const LearningFilters: React.FC<Props> = ({
    entries,
    onFilterChange,
    currentSort,
    onSortChange
}) => {
    const theme = useTheme();
    const [isExpanded, setIsExpanded] = useState(false);
    const [sortMenuVisible, setSortMenuVisible] = useState(false);

    const [filters, setFilters] = useState<LearningFilterState>({
        paths: [],
        companies: [],
        dateRange: 'all'
    });

    const uniqueCompanies = useMemo(() => {
        const companies = new Set(entries.map(e => e.companyName));
        return Array.from(companies).sort();
    }, [entries]);

    const updateFilters = (newFilters: Partial<LearningFilterState>) => {
        const updated = { ...filters, ...newFilters };
        setFilters(updated);
        onFilterChange(updated);
    };

    const toggleFilter = (key: keyof LearningFilterState, value: string) => {
        const list = filters[key] as string[];
        const newList = list.includes(value)
            ? list.filter(item => item !== value)
            : [...list, value];
        updateFilters({ [key]: newList });
    };

    const clearAll = () => {
        const cleared: LearningFilterState = {
            paths: [],
            companies: [],
            dateRange: 'all'
        };
        setFilters(cleared);
        onFilterChange(cleared);
    };

    const getSortLabel = (sort: LearningSortOption) => {
        switch (sort) {
            case 'recent': return 'Recently Added';
            case 'skill_asc': return 'Skill Name (A-Z)';
            case 'skill_desc': return 'Skill Name (Z-A)';
            case 'progress_desc': return 'Highest Progress';
            case 'company_asc': return 'By Company';
            default: return 'Sort By';
        }
    };

    return (
        <Surface style={[styles.container, { backgroundColor: theme.colors.elevation.level2 }]} elevation={1}>
            <View style={styles.contentWrapper}>
                <View style={styles.topBar}>
                    <Menu
                        visible={sortMenuVisible}
                        onDismiss={() => setSortMenuVisible(false)}
                        anchor={
                            <Button
                                mode="outlined"
                                onPress={() => setSortMenuVisible(true)}
                                icon="sort"
                                compact
                                style={styles.sortButton}
                            >
                                {getSortLabel(currentSort)}
                            </Button>
                        }
                    >
                        <Menu.Item onPress={() => { setSortMenuVisible(false); setTimeout(() => onSortChange('recent'), 0); }} title="Recently Added" />
                        <Menu.Item onPress={() => { setSortMenuVisible(false); setTimeout(() => onSortChange('progress_desc'), 0); }} title="Highest Progress" />
                        <Divider />
                        <Menu.Item onPress={() => { setSortMenuVisible(false); setTimeout(() => onSortChange('skill_asc'), 0); }} title="Skill Name (A-Z)" />
                        <Menu.Item onPress={() => { setSortMenuVisible(false); setTimeout(() => onSortChange('company_asc'), 0); }} title="By Company" />
                    </Menu>

                    <Button
                        mode={isExpanded ? "contained-tonal" : "text"}
                        onPress={() => setIsExpanded(!isExpanded)}
                        icon={isExpanded ? "chevron-up" : "filter-variant"}
                        compact
                    >
                        Filters
                    </Button>
                </View>

                {isExpanded && (
                    <View style={[styles.expandedContent, { backgroundColor: theme.colors.elevation.level1 }]}>
                        {/* Learning Path */}
                        <Text variant="labelMedium" style={styles.label}>Learning Path</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                            {[
                                { label: 'AI-Assisted', value: 'ai' },
                                { label: 'Self Learning', value: 'self' }
                            ].map(path => (
                                <Chip
                                    key={path.value}
                                    selected={filters.paths.includes(path.value as LearningPath)}
                                    onPress={() => toggleFilter('paths', path.value)}
                                    style={styles.chip}
                                >
                                    {path.label}
                                </Chip>
                            ))}
                        </ScrollView>

                        {/* Date Range */}
                        <Text variant="labelMedium" style={[styles.label, { marginTop: 12 }]}>Added Date</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                            {[
                                { label: 'All Time', value: 'all' },
                                { label: 'Last 7 Days', value: '7days' },
                                { label: 'Last 30 Days', value: '30days' }
                            ].map(range => (
                                <Chip
                                    key={range.value}
                                    selected={filters.dateRange === range.value}
                                    onPress={() => updateFilters({ dateRange: range.value as any })}
                                    style={styles.chip}
                                >
                                    {range.label}
                                </Chip>
                            ))}
                        </ScrollView>

                        {/* Companies */}
                        {uniqueCompanies.length > 0 && (
                            <>
                                <Text variant="labelMedium" style={[styles.label, { marginTop: 12 }]}>Context (Company)</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                                    {uniqueCompanies.map(company => (
                                        <Chip
                                            key={company}
                                            selected={filters.companies.includes(company)}
                                            onPress={() => toggleFilter('companies', company)}
                                            style={styles.chip}
                                        >
                                            {company}
                                        </Chip>
                                    ))}
                                </ScrollView>
                            </>
                        )}

                        <Button onPress={clearAll} compact style={{ marginTop: 12 }}>
                            Clear Filters
                        </Button>
                    </View>
                )}
            </View>
        </Surface>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 8,
        // backgroundColor: '#fff', -- Handled by Surface elevation or explicit override below
    },
    contentWrapper: {
        overflow: 'hidden',
        borderRadius: 8,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 8,
        alignItems: 'center'
    },
    sortButton: {
        minWidth: 160
    },
    expandedContent: {
        padding: 16,
        paddingTop: 0,
        // backgroundColor: '#f9f9f9' -- Handled inline if needed or let it match container
    },
    label: {
        fontWeight: 'bold',
        opacity: 0.7,
        marginBottom: 8
    },
    chipRow: {
        flexDirection: 'row',
        marginBottom: 4
    },
    chip: {
        marginRight: 8
    }
});
