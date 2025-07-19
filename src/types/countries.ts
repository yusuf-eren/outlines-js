/**
 * Generate valid country codes and names.
 */

import { iso31661 } from 'iso-3166';

/**
 * Interface for country data structure
 */
export interface CountryData {
  alpha2: string;
  alpha3: string;
  numeric: string;
  name: string;
}

/**
 * Get all countries from the iso-3166 package
 */
const countries = iso31661 as CountryData[];

/**
 * Generate Unicode flags for all ISO 3166-1 alpha-2 country codes
 */
function getCountryFlags(): Record<string, string> {
  const base = '🇦'.codePointAt(0)!;
  const flags: Record<string, string> = {};

  for (const country of countries) {
    const code = country.alpha2;
    if (code && code.length === 2) {
      const firstChar = String.fromCodePoint(
        base + code.charCodeAt(0) - 'A'.charCodeAt(0)
      );
      const secondChar = String.fromCodePoint(
        base + code.charCodeAt(1) - 'A'.charCodeAt(0)
      );
      flags[code] = firstChar + secondChar;
    }
  }

  return flags;
}

/**
 * Create Alpha-2 country codes enum-like object
 */
const createAlpha2Enum = (): Record<string, string> => {
  const alpha2Codes: Record<string, string> = {};
  for (const country of countries) {
    if (country.alpha2) {
      alpha2Codes[country.alpha2] = country.alpha2;
    }
  }
  return alpha2Codes;
};

/**
 * Create Alpha-3 country codes enum-like object
 */
const createAlpha3Enum = (): Record<string, string> => {
  const alpha3Codes: Record<string, string> = {};
  for (const country of countries) {
    if (country.alpha3) {
      alpha3Codes[country.alpha3] = country.alpha3;
    }
  }
  return alpha3Codes;
};

/**
 * Create numeric country codes enum-like object
 */
const createNumericEnum = (): Record<string, string> => {
  const numericCodes: Record<string, string> = {};
  for (const country of countries) {
    if (country.numeric) {
      const numericStr = String(country.numeric);
      numericCodes[numericStr] = numericStr;
    }
  }
  return numericCodes;
};

/**
 * Create country names enum-like object
 */
const createNameEnum = (): Record<string, string> => {
  const names: Record<string, string> = {};
  for (const country of countries) {
    if (country.name) {
      // Clean up the name to be a valid identifier
      const cleanName = country.name.replace(/[^a-zA-Z0-9]/g, '_');
      names[cleanName] = country.name;
    }
  }
  return names;
};

/**
 * Create country flags enum-like object
 */
const createFlagEnum = (): Record<string, string> => {
  const flagMapping = getCountryFlags();
  const flags: Record<string, string> = {};

  for (const [code, flag] of Object.entries(flagMapping)) {
    flags[code] = flag;
  }

  return flags;
};

export const Alpha2 = createAlpha2Enum();
export const Alpha3 = createAlpha3Enum();
export const Numeric = createNumericEnum();
export const Name = createNameEnum();
export const Flag = createFlagEnum();

export const flagMapping = getCountryFlags();

export type Alpha2Code = keyof typeof Alpha2;
export type Alpha3Code = keyof typeof Alpha3;
export type NumericCode = keyof typeof Numeric;
export type CountryName = keyof typeof Name;
export type CountryFlag = keyof typeof Flag;

// Export utility functions
export { getCountryFlags };

// Export arrays for easier iteration
export const ALPHA_2_CODES = Object.keys(Alpha2);
export const ALPHA_3_CODES = Object.keys(Alpha3);
export const NUMERIC_CODES = Object.keys(Numeric);
export const COUNTRY_NAMES = Object.values(Name);
export const COUNTRY_FLAGS = Object.values(Flag);

export { countries };

export default {
  Alpha2,
  Alpha3,
  Numeric,
  Name,
  Flag,
  flagMapping,
  getCountryFlags,
  ALPHA_2_CODES,
  ALPHA_3_CODES,
  NUMERIC_CODES,
  COUNTRY_NAMES,
  COUNTRY_FLAGS,
  countries,
};
