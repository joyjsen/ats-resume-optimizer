import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { Text, Chip, Button, Divider, useTheme, Surface } from 'react-native-paper';
import { Application, ApplicationStage } from '../../types/application.types';

export type ApplicationSortOption =
    | 'recent' | 'score_desc' | 'score_asc'
    | 'company_asc' | 'company_desc'
    | 'stage_priority';

export interface ApplicationFilterState {
    stages: ApplicationStage[];
    companies: string[];
    scoreRanges: string[]; // '0-49', '50-74', '75-100'
    dateRange: 'all' | '7days' | '30days' | '3months';
}

interface Props {
    applications: Application[];
    onFilterChange: (filters: ApplicationFilterState) => void;
    currentSort: ApplicationSortOption;
    onSortChange: (sort: ApplicationSortOption) => void;
}

export const ApplicationFilters: React.FC<Props> = ({
    applications,
    onFilterChange,
    currentSort,
    onSortChange
}) => {
    const theme = useTheme();
    const [isExpanded, setIsExpanded] = useState(false);
    const [sortMenuVisible, setSortMenuVisible] = useState(false);

    const [filters, setFilters] = useState<ApplicationFilterState>({
        stages: [],
        companies: [],
        scoreRanges: [],
        dateRange: 'all'
    });

    const uniqueCompanies = useMemo(() => {
        const companies = new Set(applications.map(app => app.company));
        return Array.from(companies).sort();
    }, [applications]);

    const updateFilters = (newFilters: Partial<ApplicationFilterState>) => {
        const updated = { ...filters, ...newFilters };
        setFilters(updated);
        onFilterChange(updated);
    };

    const toggleFilter = (key: keyof ApplicationFilterState, value: string) => {
        const list = filters[key] as string[];
        const newList = list.includes(value)
            ? list.filter(item => item !== value)
            : [...list, value];
        updateFilters({ [key]: newList });
    };

    const clearAll = () => {
        const cleared: ApplicationFilterState = {
            stages: [],
            companies: [],
            scoreRanges: [],
            dateRange: 'all'
        };
        setFilters(cleared);
        onFilterChange(cleared);
    };

    const getSortLabel = (sort: ApplicationSortOption) => {
        switch (sort) {
            case 'recent': return 'Recently Updated';
            case 'score_desc': return 'Highest Score';
            case 'score_asc': return 'Lowest Score';
            case 'company_asc': return 'Company (A-Z)';
            case 'company_desc': return 'Company (Z-A)';
            case 'stage_priority': return 'Stage Priority';
            default: return 'Sort By';
        }
    };

    const sortOptions: { value: ApplicationSortOption; label: string }[] = [
        { value: 'recent', label: 'Recently Updated' },
        { value: 'score_desc', label: 'Highest ATS Score' },
        { value: 'score_asc', label: 'Lowest ATS Score' },
        { value: 'company_asc', label: 'Company (A-Z)' },
        { value: 'company_desc', label: 'Company (Z-A)' },
        { value: 'stage_priority', label: 'Stage Priority' },
    ];

    return (
        <Surface style={[styles.container, { backgroundColor: theme.colors.elevation.level2 }]} elevation={1}>
            <View style={styles.contentWrapper}>
                <View style={styles.topBar}>
                    <Button
                        mode="outlined"
                        onPress={() => setSortMenuVisible(true)}
                        icon="sort"
                        compact
                        style={styles.sortButton}
                    >
                        {getSortLabel(currentSort)}
                    </Button>

                    <Button
                        mode={isExpanded ? "contained-tonal" : "text"}
                        onPress={() => setIsExpanded(!isExpanded)}
                        icon={isExpanded ? "chevron-up" : "filter-variant"}
                        compact
                    >
                        Filters
                    </Button>
                </View>

                {/* Sort Modal */}
                <Modal
                    visible={sortMenuVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setSortMenuVisible(false)}
                >
                    <TouchableWithoutFeedback onPress={() => setSortMenuVisible(false)}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback>
                                <View style={[styles.modalContent, { backgroundColor: theme.colors.elevation.level3 }]}>
                                    <Text variant="titleMedium" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>Sort By</Text>
                                    <Divider style={{ marginBottom: 8 }} />
                                    {sortOptions.map((option) => (
                                        <TouchableOpacity
                                            key={option.value}
                                            style={[
                                                styles.modalOption,
                                                currentSort === option.value && { backgroundColor: theme.colors.primaryContainer }
                                            ]}
                                            onPress={() => {
                                                onSortChange(option.value);
                                                setSortMenuVisible(false);
                                            }}
                                        >
                                            <Text
                                                style={[
                                                    styles.modalOptionText,
                                                    { color: theme.colors.onSurface },
                                                    currentSort === option.value && { color: theme.colors.primary, fontWeight: 'bold' }
                                                ]}
                                            >
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>

                {isExpanded && (
                    <View style={[styles.expandedContent, { backgroundColor: theme.colors.elevation.level1 }]}>
                        {/* ATS Score */}
                        <Text variant="labelMedium" style={styles.label}>ATS Score Compatibility</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                            {[
                                { label: 'Red (<50%)', value: '0-49' },
                                { label: 'Orange (50-74%)', value: '50-74' },
                                { label: 'Green (>=75%)', value: '75-100' }
                            ].map(range => (
                                <Chip
                                    key={range.value}
                                    selected={filters.scoreRanges.includes(range.value)}
                                    onPress={() => toggleFilter('scoreRanges', range.value)}
                                    style={styles.chip}
                                >
                                    {range.label}
                                </Chip>
                            ))}
                        </ScrollView>

                        {/* App Stage */}
                        <Text variant="labelMedium" style={[styles.label, { marginTop: 12 }]}>Application Stage</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                            {[
                                'submitted', 'phone_screen', 'technical', 'final_round', 'offer', 'rejected', 'withdrawn'
                            ].map(stage => (
                                <Chip
                                    key={stage}
                                    selected={filters.stages.includes(stage as ApplicationStage)}
                                    onPress={() => toggleFilter('stages', stage)}
                                    style={styles.chip}
                                >
                                    {stage.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </Chip>
                            ))}
                        </ScrollView>

                        {/* Date Range */}
                        <Text variant="labelMedium" style={[styles.label, { marginTop: 12 }]}>Last Activity</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                            {[
                                { label: 'All Time', value: 'all' },
                                { label: 'Last 7 Days', value: '7days' },
                                { label: 'Last 30 Days', value: '30days' },
                                { label: 'Last 3 Months', value: '3months' }
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
                                <Text variant="labelMedium" style={[styles.label, { marginTop: 12 }]}>Company</Text>
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
        // backgroundColor: '#fff',
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
        // backgroundColor: '#f9f9f9'
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
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        // backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        width: '80%',
        maxWidth: 320,
    },
    modalTitle: {
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalOption: {
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    modalOptionSelected: {
        // backgroundColor: '#e3f2fd',
    },
    modalOptionText: {
        fontSize: 15,
        // color: '#333',
    },
});
