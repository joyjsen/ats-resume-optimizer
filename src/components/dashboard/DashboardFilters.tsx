import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Chip, Menu, Button, IconButton, Divider, Checkbox, TextInput, useTheme, Surface } from 'react-native-paper';
import { SavedAnalysis } from '../../types/history.types';

export type SortOption =
    | 'recent' | 'oldest'
    | 'position_asc' | 'position_desc'
    | 'company_asc' | 'company_desc'
    | 'score_desc' | 'score_asc';

export interface FilterState {
    companies: string[];
    positions: string[];
    dateRange: 'all' | '7days' | '30days' | '3months' | 'custom';
    customStartDate?: string; // YYYY-MM-DD
    customEndDate?: string;   // YYYY-MM-DD
    scoreRanges: string[];    // '1-20', '21-40', '41-60', '61-80', '81-100'
}

interface DashboardFiltersProps {
    fullHistory: SavedAnalysis[];
    onFilterChange: (filters: FilterState) => void;
    currentSort: SortOption;
    onSortChange: (sort: SortOption) => void;
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
    fullHistory,
    onFilterChange,
    currentSort,
    onSortChange
}) => {
    const theme = useTheme();
    const [isExpanded, setIsExpanded] = useState(false);
    const [sortMenuVisible, setSortMenuVisible] = useState(false);

    // Initial Filter State
    const [filters, setFilters] = useState<FilterState>({
        companies: [],
        positions: [],
        dateRange: 'all',
        scoreRanges: []
    });

    // Extract Unique Options from History
    const uniqueCompanies = useMemo(() => {
        const companies = new Set(fullHistory.map(item => item.company));
        return Array.from(companies).sort();
    }, [fullHistory]);

    const uniquePositions = useMemo(() => {
        const positions = new Set(fullHistory.map(item => item.jobTitle));
        return Array.from(positions).sort();
    }, [fullHistory]);

    // Handle Updates
    const updateFilters = (newFilters: Partial<FilterState>) => {
        const updated = { ...filters, ...newFilters };
        setFilters(updated);
        onFilterChange(updated);
    };

    const toggleArrayFilter = (key: 'companies' | 'positions' | 'scoreRanges', value: string) => {
        const list = filters[key];
        const newList = list.includes(value)
            ? list.filter(item => item !== value)
            : [...list, value];
        updateFilters({ [key]: newList });
    };

    const clearAll = () => {
        const cleared: FilterState = {
            companies: [],
            positions: [],
            dateRange: 'all',
            scoreRanges: [],
            customStartDate: '',
            customEndDate: ''
        };
        setFilters(cleared);
        onFilterChange(cleared);
    };

    const getSortLabel = (sort: SortOption) => {
        switch (sort) {
            case 'recent': return 'Most Recent';
            case 'oldest': return 'Oldest First';
            case 'position_asc': return 'Position (A-Z)';
            case 'position_desc': return 'Position (Z-A)';
            case 'company_asc': return 'Company (A-Z)';
            case 'company_desc': return 'Company (Z-A)';
            case 'score_desc': return 'ATS Score (High → Low)';
            case 'score_asc': return 'ATS Score (Low → High)';
            default: return 'Sort By';
        }
    };

    const handleSortSelection = (option: SortOption) => {
        setSortMenuVisible(false);
        // Delay the state update slightly to ensure the menu closes smoothly
        // and the anchor button update doesn't conflict with the menu closing animation.
        setTimeout(() => {
            onSortChange(option);
        }, 100);
    };

    return (
        <Surface style={styles.container} elevation={1}>
            <View style={styles.contentContainer}>
                {/* Top Bar: Sort & Toggle */}
                <View style={styles.topBar}>
                    <Menu
                        visible={sortMenuVisible}
                        onDismiss={() => setSortMenuVisible(false)}
                        anchor={
                            <Button
                                mode="outlined"
                                onPress={() => setSortMenuVisible(true)}
                                icon="sort"
                                style={styles.sortButton}
                            >
                                {getSortLabel(currentSort)}
                            </Button>
                        }
                    >
                        <Menu.Item onPress={() => handleSortSelection('recent')} title="Most Recent" />
                        <Menu.Item onPress={() => handleSortSelection('oldest')} title="Oldest First" />
                        <Menu.Item onPress={() => handleSortSelection('score_desc')} title="Highest Score" />
                        <Menu.Item onPress={() => handleSortSelection('score_asc')} title="Lowest Score" />
                        <Divider />
                        <Menu.Item onPress={() => handleSortSelection('position_asc')} title="Position (A-Z)" />
                        <Menu.Item onPress={() => handleSortSelection('company_asc')} title="Company (A-Z)" />
                    </Menu>

                    <Button
                        mode={isExpanded ? "contained-tonal" : "text"}
                        onPress={() => setIsExpanded(!isExpanded)}
                        icon={isExpanded ? "chevron-up" : "filter-variant"}
                    >
                        Filters
                    </Button>
                </View>

                {/* Collapsible Filters */}
                {isExpanded && (
                    <View style={[styles.filtersContent, { backgroundColor: theme.colors.elevation.level2 }]}>

                        {/* Date Range */}
                        <Text variant="titleSmall" style={styles.filterTitle}>Date Range</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                            {['all', '7days', '30days', '3months'].map((range) => (
                                <Chip
                                    key={range}
                                    selected={filters.dateRange === range}
                                    onPress={() => updateFilters({ dateRange: range as any })}
                                    style={styles.chip}
                                >
                                    {range === 'all' ? 'All Time' : range === '7days' ? 'Last 7 Days' : range === '30days' ? 'Last 30 Days' : 'Last 3 Months'}
                                </Chip>
                            ))}
                        </ScrollView>

                        {/* Score Range */}
                        <Text variant="titleSmall" style={styles.filterTitle}>ATS Score</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                            {[
                                { label: 'Needs Brush-up (0-49)', value: '0-49' },
                                { label: 'Encouraged (50-74)', value: '50-74' },
                                { label: 'Strong Match (75-100)', value: '75-100' }
                            ].map(range => (
                                <Chip
                                    key={range.value}
                                    selected={filters.scoreRanges.includes(range.value)}
                                    onPress={() => toggleArrayFilter('scoreRanges', range.value)}
                                    showSelectedOverlay
                                    style={styles.chip}
                                >
                                    {range.label}
                                </Chip>
                            ))}
                        </ScrollView>

                        {/* Companies */}
                        <Text variant="titleSmall" style={styles.filterTitle}>Company</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                            {uniqueCompanies.map(company => (
                                <Chip
                                    key={company}
                                    selected={filters.companies.includes(company)}
                                    onPress={() => toggleArrayFilter('companies', company)}
                                    showSelectedOverlay
                                    style={styles.chip}
                                >
                                    {company}
                                </Chip>
                            ))}
                        </ScrollView>

                        {/* Positions */}
                        <Text variant="titleSmall" style={styles.filterTitle}>Position</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                            {uniquePositions.map(pos => (
                                <Chip
                                    key={pos}
                                    selected={filters.positions.includes(pos)}
                                    onPress={() => toggleArrayFilter('positions', pos)}
                                    showSelectedOverlay
                                    style={styles.chip}
                                >
                                    {pos}
                                </Chip>
                            ))}
                        </ScrollView>

                        <Button onPress={clearAll} style={{ marginTop: 12 }}>
                            Clear All Filters
                        </Button>
                    </View>
                )}

                {/* Active Filter Indicators (Collapsed View Summary) */}
                {!isExpanded && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeFiltersRow}>
                        {filters.dateRange !== 'all' && (
                            <Chip onClose={() => updateFilters({ dateRange: 'all' })} style={[styles.activeChip, { backgroundColor: theme.colors.secondaryContainer }]} compact>
                                Date: {filters.dateRange}
                            </Chip>
                        )}
                        {filters.companies.map(c => (
                            <Chip key={c} onClose={() => toggleArrayFilter('companies', c)} style={[styles.activeChip, { backgroundColor: theme.colors.secondaryContainer }]} compact>
                                {c}
                            </Chip>
                        ))}
                        {filters.scoreRanges.map(s => (
                            <Chip key={s} onClose={() => toggleArrayFilter('scoreRanges', s)} style={[styles.activeChip, { backgroundColor: theme.colors.secondaryContainer }]} compact>
                                Score: {s}
                            </Chip>
                        ))}
                    </ScrollView>
                )}
            </View>
        </Surface>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        borderRadius: 8,
        // backgroundColor: '#fff' - Removed hardcoded
        // Surface component handles background color based on elevation
    },
    contentContainer: {
        borderRadius: 8,
        overflow: 'hidden'
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 8,
        alignItems: 'center'
    },
    sortButton: {
        marginRight: 8
    },
    filtersContent: {
        padding: 16,
        paddingTop: 0,
        // backgroundColor: '#f8f9fa' - Removed, handled by inline style using theme
    },
    filterTitle: {
        marginTop: 12,
        marginBottom: 8,
        fontWeight: 'bold',
        opacity: 0.7
    },
    chipRow: {
        flexDirection: 'row',
        gap: 8,
        paddingBottom: 4
    },
    chip: {
        marginRight: 4
    },
    activeFiltersRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 8
    },
    activeChip: {
        marginRight: 8,
        // backgroundColor: '#e3f2fd' - Removed, let Chip handle it or use theme in render
    }
});
