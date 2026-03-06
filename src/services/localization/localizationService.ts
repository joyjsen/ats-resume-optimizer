import { Platform } from 'react-native';
import { PRICING_DATA } from './pricingData';

// Safely handle expo-localization which requires native modules
let Localization: any = null;
try {
    Localization = require('expo-localization');
} catch (e) {
    console.warn('[Localization] Failed to load expo-localization:', e);
}

export interface CountryData {
    code: string; // ISO 3166-1 alpha-2
    name: string;
    currency: string; // ISO 4217
    symbol: string;
}

// Comprehensive list of countries supported by Apple IAP (approx. 175)
// This list maps the country code to its primary currency
export const COUNTRIES: CountryData[] = [
    {
        "code": "??",
        "name": "Afghanistan",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Albania",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Algeria",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Angola",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Anguilla",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Antigua and Barbuda",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Argentina",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Armenia",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "AU",
        "name": "Australia",
        "currency": "AUD",
        "symbol": "$"
    },
    {
        "code": "AT",
        "name": "Austria",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Azerbaijan",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Bahamas",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Bahrain",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Barbados",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Belarus",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "BE",
        "name": "Belgium",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Belize",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Benin",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Bermuda",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Bhutan",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Bolivia",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Bosnia and Herzegovina",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Botswana",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "BR",
        "name": "Brazil",
        "currency": "BRL",
        "symbol": "R$"
    },
    {
        "code": "??",
        "name": "British Virgin Islands",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Brunei",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Bulgaria",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Burkina Faso",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Cambodia",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Cameroon",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "CA",
        "name": "Canada",
        "currency": "CAD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Cape Verde",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Cayman Islands",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Chad",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "CL",
        "name": "Chile",
        "currency": "CLP",
        "symbol": "$"
    },
    {
        "code": "CN",
        "name": "China mainland",
        "currency": "CNY",
        "symbol": "¥"
    },
    {
        "code": "CO",
        "name": "Colombia",
        "currency": "COP",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Congo, Democratic Republic of the",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Congo, Republic of the",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Costa Rica",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Croatia",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Cyprus",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Czech Republic",
        "currency": "CZK",
        "symbol": "Kč"
    },
    {
        "code": "??",
        "name": "Côte d’Ivoire",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "DK",
        "name": "Denmark",
        "currency": "DKK",
        "symbol": "kr"
    },
    {
        "code": "??",
        "name": "Dominica",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Dominican Republic",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Ecuador",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "EG",
        "name": "Egypt",
        "currency": "EGP",
        "symbol": "E£"
    },
    {
        "code": "??",
        "name": "El Salvador",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Estonia",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Eswatini",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Fiji",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "FI",
        "name": "Finland",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "FR",
        "name": "France",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Gabon",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Gambia",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Georgia",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "DE",
        "name": "Germany",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Ghana",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "GR",
        "name": "Greece",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Grenada",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Guatemala",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Guinea-Bissau",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Guyana",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Honduras",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "HK",
        "name": "Hong Kong",
        "currency": "HKD",
        "symbol": "HK$"
    },
    {
        "code": "??",
        "name": "Hungary",
        "currency": "HUF",
        "symbol": "Ft"
    },
    {
        "code": "??",
        "name": "Iceland",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "IN",
        "name": "India",
        "currency": "INR",
        "symbol": "₹"
    },
    {
        "code": "ID",
        "name": "Indonesia",
        "currency": "IDR",
        "symbol": "Rp"
    },
    {
        "code": "??",
        "name": "Iraq",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "IE",
        "name": "Ireland",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "IL",
        "name": "Israel",
        "currency": "ILS",
        "symbol": "₪"
    },
    {
        "code": "IT",
        "name": "Italy",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Jamaica",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "JP",
        "name": "Japan",
        "currency": "JPY",
        "symbol": "¥"
    },
    {
        "code": "??",
        "name": "Jordan",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Kazakhstan",
        "currency": "KZT",
        "symbol": "₸"
    },
    {
        "code": "??",
        "name": "Kenya",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "KR",
        "name": "Korea, Republic of",
        "currency": "KRW",
        "symbol": "₩"
    },
    {
        "code": "??",
        "name": "Kosovo",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Kuwait",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Kyrgyzstan",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Laos",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Latvia",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Lebanon",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Liberia",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Libya",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Lithuania",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Luxembourg",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Macau",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Madagascar",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Malawi",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "MY",
        "name": "Malaysia",
        "currency": "MYR",
        "symbol": "RM"
    },
    {
        "code": "??",
        "name": "Maldives",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Mali",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Malta",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Mauritania",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Mauritius",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "MX",
        "name": "Mexico",
        "currency": "MXN",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Micronesia",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Moldova",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Mongolia",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Montenegro",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Montserrat",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Morocco",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Mozambique",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Myanmar",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Namibia",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Nauru",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Nepal",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "NL",
        "name": "Netherlands",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "NZ",
        "name": "New Zealand",
        "currency": "NZD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Nicaragua",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Niger",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "NG",
        "name": "Nigeria",
        "currency": "NGN",
        "symbol": "₦"
    },
    {
        "code": "??",
        "name": "North Macedonia",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "NO",
        "name": "Norway",
        "currency": "NOK",
        "symbol": "kr"
    },
    {
        "code": "??",
        "name": "Oman",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "PK",
        "name": "Pakistan",
        "currency": "PKR",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Palau",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Panama",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Papua New Guinea",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Paraguay",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "PE",
        "name": "Peru",
        "currency": "PEN",
        "symbol": "S/"
    },
    {
        "code": "PH",
        "name": "Philippines",
        "currency": "PHP",
        "symbol": "₱"
    },
    {
        "code": "PL",
        "name": "Poland",
        "currency": "PLN",
        "symbol": "zł"
    },
    {
        "code": "PT",
        "name": "Portugal",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Qatar",
        "currency": "QAR",
        "symbol": "﷼"
    },
    {
        "code": "??",
        "name": "Romania",
        "currency": "RON",
        "symbol": "lei"
    },
    {
        "code": "RU",
        "name": "Russia",
        "currency": "RUB",
        "symbol": "₽"
    },
    {
        "code": "??",
        "name": "Rwanda",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Saudi Arabia",
        "currency": "SAR",
        "symbol": "﷼"
    },
    {
        "code": "??",
        "name": "Senegal",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Serbia",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Seychelles",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Sierra Leone",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "SG",
        "name": "Singapore",
        "currency": "SGD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Slovakia",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Slovenia",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Solomon Islands",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "ZA",
        "name": "South Africa",
        "currency": "ZAR",
        "symbol": "R"
    },
    {
        "code": "ES",
        "name": "Spain",
        "currency": "EUR",
        "symbol": "€"
    },
    {
        "code": "??",
        "name": "Sri Lanka",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "St. Kitts and Nevis",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "St. Lucia",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "St. Vincent and the Grenadines",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Suriname",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "SE",
        "name": "Sweden",
        "currency": "SEK",
        "symbol": "kr"
    },
    {
        "code": "CH",
        "name": "Switzerland",
        "currency": "CHF",
        "symbol": "CHF"
    },
    {
        "code": "??",
        "name": "São Tomé and Príncipe",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Taiwan",
        "currency": "TWD",
        "symbol": "NT$"
    },
    {
        "code": "??",
        "name": "Tajikistan",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Tanzania",
        "currency": "TZS",
        "symbol": "Sh"
    },
    {
        "code": "TH",
        "name": "Thailand",
        "currency": "THB",
        "symbol": "฿"
    },
    {
        "code": "??",
        "name": "Tonga",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Trinidad and Tobago",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Tunisia",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Turkmenistan",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Turks and Caicos Islands",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "TR",
        "name": "Türkiye",
        "currency": "TRY",
        "symbol": "₺"
    },
    {
        "code": "??",
        "name": "Uganda",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Ukraine",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "AE",
        "name": "United Arab Emirates",
        "currency": "AED",
        "symbol": "د.إ"
    },
    {
        "code": "GB",
        "name": "United Kingdom",
        "currency": "GBP",
        "symbol": "£"
    },
    {
        "code": "US",
        "name": "United States",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Uruguay",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Uzbekistan",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Vanuatu",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Venezuela",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "VN",
        "name": "Vietnam",
        "currency": "VND",
        "symbol": "₫"
    },
    {
        "code": "??",
        "name": "Yemen",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Zambia",
        "currency": "USD",
        "symbol": "$"
    },
    {
        "code": "??",
        "name": "Zimbabwe",
        "currency": "USD",
        "symbol": "$"
    }
];

class LocalizationService {
    /**
     * Get the current device region (ISO 3166-1 alpha-2)
     */
    getCurrentRegion(): string {
        try {
            if (!Localization) {
                return 'US';
            }

            const locals = Localization.getLocales ? Localization.getLocales() : [];
            if (locals && locals.length > 0) {
                return locals[0].regionCode || 'US';
            }
        } catch (error) {
            console.warn('[LocalizationService] Error getting current region:', error);
        }
        return 'US';
    }

    /**
     * Get country data by code
     */
    getCountryByCode(code: string): CountryData | undefined {
        return COUNTRIES.find(c => c.code === code);
    }

    /**
     * Get the default country for the device
     */
    getDefaultCountry(): CountryData {
        const region = this.getCurrentRegion();
        return this.getCountryByCode(region) || COUNTRIES.find(c => c.code === 'US')!;
    }

    /**
     * Format currency value
     */
    formatCurrency(value: number, currencyCode: string = 'USD'): string {
        try {
            return new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: currencyCode,
            }).format(value);
        } catch (e) {
            const country = COUNTRIES.find(c => c.currency === currencyCode);
            return `${country?.symbol || '$'}${value.toFixed(2)}`;
        }
    }

    /**
     * Get the exact price for a package and country
     */
    getPriceForPackage(countryName: string, packageId: string): number | null {
        const countryPricing = PRICING_DATA[countryName];
        if (countryPricing && countryPricing.prices[packageId]) {
            return countryPricing.prices[packageId];
        }
        return null;
    }

    /**
     * Estimate price conversion for display.
     * Now uses PRICING_DATA as primary source of truth.
     */
    estimatePrice(usdPrice: number, targetCurrency: string, countryName?: string, packageId?: string): number {
        // 1. Try exact match from PRICING_DATA
        if (countryName && packageId) {
            const exactPrice = this.getPriceForPackage(countryName, packageId);
            if (exactPrice !== null) return exactPrice;
        }

        // 2. Fallback to estimation logic if exact data is missing
        if (targetCurrency === 'USD') return usdPrice;

        const rates: Record<string, number> = {
            'EUR': 0.92,
            'GBP': 0.79,
            'INR': 83.0,
            'JPY': 150.0,
            'CAD': 1.35,
            'AUD': 1.53,
            'CNY': 7.2,
            'BRL': 5.0,
        };

        const rate = rates[targetCurrency] || 1.0;
        return usdPrice * rate;
    }
}

export const localizationService = new LocalizationService();
