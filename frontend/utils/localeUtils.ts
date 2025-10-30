import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache for user preferences (loaded once at app start)
let cachedCurrencyPreference: string | null = null;
let cachedMeasurementPreference: string | null = null;

// Initialize preferences cache (call this on app start)
export const initializePreferences = async (): Promise<void> => {
  try {
    cachedCurrencyPreference = await AsyncStorage.getItem('user_currency_preference');
    cachedMeasurementPreference = await AsyncStorage.getItem('user_measurement_preference');
  } catch (error) {
    console.error('Failed to load preferences:', error);
  }
};

// Get user's saved currency preference (synchronous from cache)
const getUserCurrencyPreference = (): string | null => {
  return cachedCurrencyPreference;
};

// Get user's saved measurement preference (synchronous from cache)
const getUserMeasurementPreference = (): string | null => {
  return cachedMeasurementPreference;
};

// Update cache when preference changes
export const setCurrencyPreference = async (currency: string): Promise<void> => {
  cachedCurrencyPreference = currency;
  await AsyncStorage.setItem('user_currency_preference', currency);
};

export const setMeasurementPreference = async (measurement: string): Promise<void> => {
  cachedMeasurementPreference = measurement;
  await AsyncStorage.setItem('user_measurement_preference', measurement);
};

// Get device locale
export const getDeviceLocale = (): string => {
  const locale =
    Platform.OS === 'ios'
      ? NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
      : NativeModules.I18nManager?.localeIdentifier;

  return locale || 'en-US';
};

// Get country code from locale
export const getCountryCode = (): string => {
  const locale = getDeviceLocale();
  const parts = locale.split(/[-_]/);
  return parts[parts.length - 1].toUpperCase();
};

// Currency configuration by country
const currencyConfig: { [key: string]: { symbol: string; code: string; decimals: number } } = {
  US: { symbol: '$', code: 'USD', decimals: 2 },
  IN: { symbol: '₹', code: 'INR', decimals: 0 },
  GB: { symbol: '£', code: 'GBP', decimals: 2 },
  EU: { symbol: '€', code: 'EUR', decimals: 2 },
  DE: { symbol: '€', code: 'EUR', decimals: 2 },
  FR: { symbol: '€', code: 'EUR', decimals: 2 },
  IT: { symbol: '€', code: 'EUR', decimals: 2 },
  ES: { symbol: '€', code: 'EUR', decimals: 2 },
  JP: { symbol: '¥', code: 'JPY', decimals: 0 },
  CN: { symbol: '¥', code: 'CNY', decimals: 2 },
  AU: { symbol: 'A$', code: 'AUD', decimals: 2 },
  CA: { symbol: 'C$', code: 'CAD', decimals: 2 },
  AE: { symbol: 'د.إ', code: 'AED', decimals: 2 },
  SA: { symbol: 'ر.س', code: 'SAR', decimals: 2 },
  SG: { symbol: 'S$', code: 'SGD', decimals: 2 },
  MY: { symbol: 'RM', code: 'MYR', decimals: 2 },
  TH: { symbol: '฿', code: 'THB', decimals: 2 },
  BR: { symbol: 'R$', code: 'BRL', decimals: 2 },
  MX: { symbol: 'MX$', code: 'MXN', decimals: 2 },
  ZA: { symbol: 'R', code: 'ZAR', decimals: 2 },
};

// Measurement system by country
const measurementSystem: { [key: string]: 'imperial' | 'metric' } = {
  US: 'imperial',
  LR: 'imperial',
  MM: 'imperial',
  // Rest of world uses metric
};

// Get currency info for device location
export const getCurrencyInfo = () => {
  const countryCode = getCountryCode();
  return currencyConfig[countryCode] || currencyConfig['US']; // Default to USD
};

// Get currency code based on user preference or locale
export const getCurrencyCode = async (): Promise<string> => {
  // First, check user's manual preference
  const userPref = await getUserCurrencyPreference();
  if (userPref) {
    return userPref;
  }

  // Fall back to device locale
  const locale = getDeviceLocale();
  const countryCode = locale.split(/[-_]/)[1] || locale.split(/[-_]/)[0];

  const currencyMap: { [key: string]: string } = {
    US: 'USD',
    IN: 'INR',
    GB: 'GBP',
    EU: 'EUR',
    JP: 'JPY',
    CN: 'CNY',
    AU: 'AUD',
    CA: 'CAD',
    CH: 'CHF',
    SE: 'SEK',
    NO: 'NOK',
    DK: 'DKK',
    NZ: 'NZD',
    SG: 'SGD',
    HK: 'HKD',
    KR: 'KRW',
    BR: 'BRL',
    MX: 'MXN',
    ZA: 'ZAR',
    AE: 'AED',
  };

  return currencyMap[countryCode.toUpperCase()] || 'USD';
};

// Format currency based on locale
export const formatCurrency = (amount: number, showCode: boolean = false): string => {
  const currency = getCurrencyInfo();
  const formatted = amount.toLocaleString(getDeviceLocale(), {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  });
  
  if (showCode) {
    return `${currency.symbol}${formatted} ${currency.code}`;
  }
  return `${currency.symbol}${formatted}`;
};

// Get measurement system for device location
export const getMeasurementSystem = (): 'imperial' | 'metric' => {
  const countryCode = getCountryCode();
  return measurementSystem[countryCode] || 'metric'; // Default to metric
};

// Convert and format length measurements
export const formatLength = (feet: number): string => {
  const system = getMeasurementSystem();
  
  if (system === 'imperial') {
    return `${feet.toFixed(1)} ft`;
  } else {
    const meters = feet * 0.3048;
    return `${meters.toFixed(2)} m`;
  }
};

// Convert and format area measurements
export const formatArea = (sqFeet: number): string => {
  const system = getMeasurementSystem();
  
  if (system === 'imperial') {
    return `${sqFeet.toFixed(0)} sq ft`;
  } else {
    const sqMeters = sqFeet * 0.092903;
    return `${sqMeters.toFixed(2)} sq m`;
  }
};

// Convert and format weight (for jewelry)
export const formatWeight = (grams: number): string => {
  const system = getMeasurementSystem();
  
  if (system === 'imperial') {
    const ounces = grams * 0.035274;
    return `${ounces.toFixed(2)} oz`;
  } else {
    return `${grams.toFixed(1)} g`;
  }
};

// Format volume (for paint, etc.)
export const formatVolume = (gallons: number): string => {
  const system = getMeasurementSystem();
  
  if (system === 'imperial') {
    return `${gallons.toFixed(2)} gallons`;
  } else {
    const liters = gallons * 3.78541;
    return `${liters.toFixed(2)} liters`;
  }
};

// Get measurement unit labels for forms
export const getUnitLabels = () => {
  const system = getMeasurementSystem();
  
  return {
    length: system === 'imperial' ? 'feet' : 'meters',
    area: system === 'imperial' ? 'sq ft' : 'sq m',
    weight: system === 'imperial' ? 'oz' : 'grams',
    volume: system === 'imperial' ? 'gallons' : 'liters',
  };
};

// Convert user input to standard storage format (always store in feet/USD)
export const parseLength = (value: string): number => {
  const system = getMeasurementSystem();
  const num = parseFloat(value);
  
  if (system === 'metric') {
    // Convert meters to feet for storage
    return num / 0.3048;
  }
  return num;
};

export const parseArea = (value: string): number => {
  const system = getMeasurementSystem();
  const num = parseFloat(value);
  
  if (system === 'metric') {
    // Convert sq meters to sq feet for storage
    return num / 0.092903;
  }
  return num;
};

// Get locale-specific date format
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(getDeviceLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Get info about current locale settings
export const getLocaleInfo = () => {
  const locale = getDeviceLocale();
  const countryCode = getCountryCode();
  const currency = getCurrencyInfo();
  const measurement = getMeasurementSystem();
  
  return {
    locale,
    countryCode,
    currency: {
      symbol: currency.symbol,
      code: currency.code,
    },
    measurement,
    units: getUnitLabels(),
  };
};
