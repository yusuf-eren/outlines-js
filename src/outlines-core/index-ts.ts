/**
 * Outlines Core - TypeScript Implementation
 *
 * This module provides TypeScript implementations of all functionality
 * available in the Rust/Node.js bindings, offering a pure TypeScript
 * alternative for cross-platform compatibility.
 *
 * @module outlines-core-ts
 */

// Core classes
import { Vocabulary, Index, Guide } from './guide';
import { buildRegexFromSchema } from './json-schema-regex';
import {
  regexFromStr,
  regexFromValue,
  getJsonSchemaConstants,
} from './utilities';
import * as constants from './json-schema-constants';

// Re-export everything
export { Vocabulary, Index, Guide };
export {
  buildRegexFromSchema,
  regexFromStr,
  regexFromValue,
  getJsonSchemaConstants,
};
export * from './json-schema-constants';
export * from './types';
export * from './utilities';

// Version information
export const VERSION = '1.0.0';

/**
 * Main outlines-core namespace that mirrors the Python bindings structure
 */
export namespace OutlinesCore {
  // JSON Schema submodule
  export namespace JsonSchema {
    export const BOOLEAN = constants.BOOLEAN;
    export const DATE = constants.DATE;
    export const DATE_TIME = constants.DATE_TIME;
    export const INTEGER = constants.INTEGER;
    export const NULL = constants.NULL;
    export const NUMBER = constants.NUMBER;
    export const STRING = constants.STRING;
    export const STRING_INNER = constants.STRING_INNER;
    export const TIME = constants.TIME;
    export const UUID = constants.UUID;
    export const WHITESPACE = constants.WHITESPACE;
    export const EMAIL = constants.EMAIL;
    export const URI = constants.URI;

    export const buildRegexFromSchema = regexFromStr;
  }
}

/**
 * Create a simple example demonstrating the functionality
 *
 * @example
 * ```typescript
 * import { createExample } from 'outlines-core-ts';
 *
 * async function demo() {
 *   const example = createExample();
 *   console.log('Generated regex:', example.regex);
 *   console.log('Guide state:', example.guide.getState());
 * }
 * ```
 */
export function createExample() {
  // Create a simple schema
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'integer' },
    },
    required: ['name', 'age'],
  };

  // Generate regex
  const regex = regexFromValue(schema);

  // Create vocabulary
  const tokens = [
    '{"',
    'name',
    '":',
    '"',
    'John',
    '"',
    ',',
    'age',
    ':',
    '25',
    '}',
  ];
  const tokenMap: Record<string, number[]> = {};
  tokens.forEach((token, index) => {
    tokenMap[token] = [index];
  });

  const vocabulary = new Vocabulary(tokens.length, tokenMap);

  // Create index and guide
  const index = new Index(regex, vocabulary);
  const guide = new Guide(index);

  return {
    schema,
    regex,
    vocabulary,
    index,
    guide,
    allowedTokens: guide.getTokens(),
  };
}

/**
 * Quick start helper for common use cases
 */
export const QuickStart = {
  /**
   * Create a regex from a JSON schema string
   */
  regexFromString: (schemaStr: string, whitespace?: string) => {
    return regexFromStr(schemaStr, whitespace);
  },

  /**
   * Create a regex from a JSON schema object
   */
  regexFromObject: (schema: any, whitespace?: string) => {
    return regexFromValue(schema, { whitespacePattern: whitespace });
  },

  /**
   * Create a simple vocabulary for testing
   */
  createVocabulary: (tokens: string[], eosTokenId?: number) => {
    const tokenMap: Record<string, number[]> = {};
    const eos = eosTokenId ?? tokens.length;

    tokens.forEach((token, index) => {
      if (index !== eos) {
        tokenMap[token] = [index];
      }
    });

    return new Vocabulary(eos, tokenMap);
  },

  /**
   * Create a complete guide setup
   */
  createGuide: (schema: any, tokens: string[]) => {
    const regex = regexFromValue(schema);
    const vocabulary = QuickStart.createVocabulary(tokens);
    const index = new Index(regex, vocabulary);
    const guide = new Guide(index);

    return { regex, vocabulary, index, guide };
  },
};

// Default export for convenience
const OutlinesCoreTS = {
  Vocabulary,
  Index,
  Guide,
  buildRegexFromSchema,
  regexFromStr,
  regexFromValue,
  getJsonSchemaConstants,
  createExample,
  QuickStart,
  VERSION,
};

export default OutlinesCoreTS;
