import React, { useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Keyboard, TouchableOpacity } from 'react-native';
import { TextInput, Menu, Button, Text, Searchbar, useTheme } from 'react-native-paper';
import { COUNTRY_CALLING_CODES, CountryCallingCode } from '../../constants/countries';

interface CountryCodeSelectorProps {
    onSelect: (country: CountryCallingCode) => void;
    selectedCountry: CountryCallingCode;
    disabled?: boolean;
}

export const CountryCodeSelector: React.FC<CountryCodeSelectorProps> = ({ onSelect, selectedCountry, disabled }) => {
    const theme = useTheme();
    const [visible, setVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCountries = useMemo(() => {
        return COUNTRY_CALLING_CODES.filter(
            country =>
                country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                country.code.includes(searchQuery) ||
                country.iso.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery]);

    const openMenu = () => {
        Keyboard.dismiss();
        setVisible(true);
    };
    const closeMenu = () => {
        setVisible(false);
        setSearchQuery('');
    };

    return (
        <Menu
            visible={visible}
            onDismiss={closeMenu}
            anchor={
                <TouchableOpacity onPress={disabled ? undefined : openMenu} disabled={disabled} style={{ marginRight: 8 }}>
                    <View pointerEvents="none">
                        <TextInput
                            mode="outlined"
                            label={selectedCountry.iso}
                            value={selectedCountry.code}
                            editable={false}
                            disabled={disabled}
                            style={{ width: 90, backgroundColor: theme.dark ? '#151515' : theme.colors.surfaceVariant }}
                            right={<TextInput.Icon icon="menu-down" />}
                        />
                    </View>
                </TouchableOpacity>
            }
            contentStyle={[styles.menuContent, { backgroundColor: theme.colors.surface }]}
        >
            <View style={styles.searchContainer}>
                <Searchbar
                    placeholder="Search country..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                    inputStyle={styles.searchInput}
                />
            </View>
            <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled">
                {filteredCountries.slice(0, 50).map((country) => (
                    <Menu.Item
                        key={`${country.iso}-${country.code}`}
                        onPress={() => {
                            onSelect(country);
                            closeMenu();
                        }}
                        title={`${country.name} (${country.code})`}
                        titleStyle={{ fontSize: 14 }}
                    />
                ))}
                {filteredCountries.length === 0 && (
                    <Text style={styles.noResults}>No countries found</Text>
                )}
            </ScrollView>
        </Menu>
    );
};

const styles = StyleSheet.create({
    anchorButton: {
        height: 56,
        justifyContent: 'center',
        marginRight: 8,
        borderRadius: 4,
    },
    anchorContent: {
        height: 56,
    },
    menuContent: {
        width: 300,
        maxHeight: 400,
    },
    searchContainer: {
        padding: 8,
    },
    searchBar: {
        elevation: 0,
        backgroundColor: 'transparent',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    searchInput: {
        fontSize: 14,
    },
    scrollContainer: {
        maxHeight: 300,
    },
    noResults: {
        padding: 16,
        textAlign: 'center',
        opacity: 0.6,
    }
});
