/**
 * Utility functions for outlines-core functionality.
 * 
 * This module provides convenient wrappers and utility functions
 * that mirror the functionality available in the Python bindings.
 */

import { buildRegexFromSchema } from './json-schema-regex';
import { JsonSchemaOptions, OutlinesError, ErrorType } from './types';
import * as constants from './json-schema-constants';

/**
 * Generates a regular expression string from a JSON schema string.
 * 
 * This is a convenience wrapper around buildRegexFromSchema that matches
 * the Python binding interface.
 * 
 * @param jsonSchema - JSON schema as a string
 * @param whitespacePattern - Optional custom whitespace pattern
 * @param maxRecursionDepth - Maximum recursion depth (default: 3)
 * @returns Regular expression string
 * 
 * @example
 * ```typescript
 * const schema = JSON.stringify({
 *   type: "object",
 *   properties: {
 *     name: { type: "string" },
 *     age: { type: "integer" }
 *   },
 *   required: ["name", "age"]
 * });
 * 
 * const regex = regexFromStr(schema);
 * console.log("Generated regex:", regex);
 * 
 * // With custom whitespace pattern
 * const regexCustom = regexFromStr(schema, "[\\n ]*");
 * ```
 */
export function regexFromStr(
  jsonSchema: string,
  whitespacePattern?: string,
  maxRecursionDepth?: number
): string {
  try {
    const schemaObject = JSON.parse(jsonSchema);
    return buildRegexFromSchema(schemaObject, whitespacePattern, maxRecursionDepth);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new OutlinesError(
        ErrorType.SerdeJsonError,
        "Expected a valid JSON string",
        { originalError: error }
      );
    }
    throw error;
  }
}

/**
 * Generates a regular expression string from a JSON schema object.
 * 
 * @param jsonSchema - JSON schema as an object
 * @param options - Configuration options
 * @returns Regular expression string
 * 
 * @example
 * ```typescript
 * const schema = {
 *   type: "object",
 *   properties: {
 *     name: { type: "string" },
 *     age: { type: "integer" }
 *   },
 *   required: ["name", "age"]
 * };
 * 
 * const regex = regexFromValue(schema);
 * console.log("Generated regex:", regex);
 * 
 * // With options
 * const regexCustom = regexFromValue(schema, {
 *   whitespacePattern: "[\\n ]*",
 *   maxRecursionDepth: 5
 * });
 * ```
 */
export function regexFromValue(
  jsonSchema: any,
  options?: JsonSchemaOptions
): string {
  return buildRegexFromSchema(
    jsonSchema,
    options?.whitespacePattern,
    options?.maxRecursionDepth
  );
}

/**
 * Get all available JSON schema constants.
 * 
 * This provides access to all the regex constants that are available
 * in the Python bindings through the json_schema submodule.
 * 
 * @returns Object containing all JSON schema regex constants
 */
export function getJsonSchemaConstants() {
  return {
    // Basic type patterns
    BOOLEAN: constants.BOOLEAN,
    DATE: constants.DATE,
    DATE_TIME: constants.DATE_TIME,
    INTEGER: constants.INTEGER,
    NULL: constants.NULL,
    NUMBER: constants.NUMBER,
    STRING: constants.STRING,
    STRING_INNER: constants.STRING_INNER,
    TIME: constants.TIME,
    UUID: constants.UUID,
    WHITESPACE: constants.WHITESPACE,
    EMAIL: constants.EMAIL,
    URI: constants.URI,
    
    // Utility functions
    getJsonTypeRegex: constants.getJsonTypeRegex,
    getFormatTypeRegex: constants.getFormatTypeRegex,
    parseFormatType: constants.parseFormatType,
    
    // Enums
    JsonType: constants.JsonType,
    FormatType: constants.FormatType
  };
}

/**
 * Validate a JSON schema before processing.
 * 
 * @param schema - JSON schema to validate
 * @throws OutlinesError if schema is invalid
 */
export function validateJsonSchema(schema: any): void {
  if (schema === null || schema === undefined) {
    throw new OutlinesError(
      ErrorType.UnsupportedJsonSchema,
      "Schema cannot be null or undefined"
    );
  }
  
  if (typeof schema !== 'object') {
    throw new OutlinesError(
      ErrorType.UnsupportedJsonSchema,
      "Schema must be an object"
    );
  }
}

/**
 * Check if a value is a valid JSON schema type.
 * 
 * @param type - Type value to check
 * @returns True if valid JSON schema type
 */
export function isValidJsonType(type: any): boolean {
  const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
  
  if (typeof type === 'string') {
    return validTypes.includes(type);
  }
  
  if (Array.isArray(type)) {
    return type.every(t => typeof t === 'string' && validTypes.includes(t));
  }
  
  return false;
}

/**
 * Normalize whitespace pattern for use in regex generation.
 * 
 * @param pattern - Whitespace pattern to normalize
 * @returns Normalized pattern or default if invalid
 */
export function normalizeWhitespacePattern(pattern?: string): string {
  if (!pattern || typeof pattern !== 'string') {
    return constants.WHITESPACE;
  }
  
  // Basic validation - ensure it's a valid regex pattern
  try {
    new RegExp(pattern);
    return pattern;
  } catch {
    console.warn(`Invalid whitespace pattern "${pattern}", using default`);
    return constants.WHITESPACE;
  }
}

/**
 * Create a simple vocabulary for testing purposes.
 * 
 * @param tokens - Array of token strings
 * @param eosTokenId - End-of-sequence token ID
 * @returns Token map suitable for Vocabulary constructor
 */
export function createSimpleTokenMap(
  tokens: string[],
  eosTokenId: number = tokens.length
): Map<string, number[]> {
  const tokenMap = new Map<string, number[]>();
  
  tokens.forEach((token, index) => {
    if (index !== eosTokenId) {
      tokenMap.set(token, [index]);
    }
  });
  
  return tokenMap;
}

/**
 * Convert token map to the format expected by Vocabulary.
 * 
 * @param tokenMap - Map of tokens to token IDs
 * @returns Object with tokens as keys and token ID arrays as values
 */
export function tokenMapToObject(tokenMap: Map<string, number[]>): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  
  for (const [token, ids] of tokenMap) {
    result[token] = ids;
  }
  
  return result;
}

/**
 * Debug utility to print schema structure.
 * 
 * @param schema - JSON schema to analyze
 * @param depth - Current depth (for internal use)
 */
export function debugSchema(schema: any, depth: number = 0): void {
  const indent = '  '.repeat(depth);
  
  if (typeof schema !== 'object' || schema === null) {
    console.log(`${indent}${typeof schema}: ${schema}`);
    return;
  }
  
  if (Array.isArray(schema)) {
    console.log(`${indent}Array[${schema.length}]:`);
    schema.forEach((item, index) => {
      console.log(`${indent}  [${index}]:`);
      debugSchema(item, depth + 2);
    });
    return;
  }
  
  console.log(`${indent}Object:`);
  Object.entries(schema).forEach(([key, value]) => {
    console.log(`${indent}  ${key}:`);
    debugSchema(value, depth + 2);
  });
}

// Re-export commonly used items for convenience
export { constants };
export * from './types';
export * from './json-schema-constants'; 