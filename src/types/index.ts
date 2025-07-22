/**
 * Output types for structured generation and regex DSL.
 */

// Import local modules
// import airports from './airports';
import countries from './countries';
// import locale from './locale';

// Import DSL components
import {
  Regex,
  CFG,
  FSM,
  JsonSchema,
  regex,
  cfg,
  fsm,
  jsonSchema,
  optional,
  either,
  exactly,
  atLeast,
  atMost,
  between,
  zeroOrMore,
  oneOrMore,
  // deprecated
  repeat,
  times,
} from './dsl';

// Python types converted to TypeScript regex patterns
export const string = new Regex('"[^"]*"');
export const integer = new Regex('[+-]?(0|[1-9][0-9]*)');
export const boolean = new Regex('(true|false)'); // Self note TODO: Test this. This is python conversion.
export const number = new Regex(
  `${integer.pattern}(\\.[0-9]+)?([eE][+-][0-9]+)?`
);
export const date = new Regex('(\\d{4})-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])');
export const time = new Regex('([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])');
export const datetime = new Regex(`(${date.pattern})(\\s)(${time.pattern})`);

// Basic regex types
export const digit = new Regex('\\d');
export const char = new Regex('\\w');
export const newline = new Regex('(\\r\\n|\\r|\\n)'); // Matched new lines on Linux, Windows & MacOS
export const whitespace = new Regex('\\s');
export const hexStr = new Regex('(0x)?[a-fA-F0-9]+');
export const uuid4 = new Regex(
  '[a-fA-F0-9]{8}-' +
    '[a-fA-F0-9]{4}-' +
    '4[a-fA-F0-9]{3}-' +
    '[89abAB][a-fA-F0-9]{3}-' +
    '[a-fA-F0-9]{12}'
);
export const ipv4 = new Regex(
  '((25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})\\.){3}' +
    '(25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})'
);

// Document-specific types
export const sentence = new Regex('[A-Z].*\\s*[.!?]');
export const paragraph = new Regex(
  `${sentence.pattern}(?:\\s+${sentence.pattern})*\\n+`
);

// The following regex is RFC 5322 compliant and was found at:
// https://emailregex.com/
export const email = new Regex(
  '(?:[a-z0-9!#$%&\'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&\'*+/=?^_`{|}~-]+)*|"(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21\\x23-\\x5b\\x5d-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21-\\x5a\\x53-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])+)\\])'
);

// Matches any ISBN number. Note that this is not completely correct as not all
// 10 or 13 digits numbers are valid ISBNs. See https://en.wikipedia.org/wiki/ISBN
// Taken from O'Reilly's Regular Expression Cookbook:
// https://www.oreilly.com/library/view/regular-expressions-cookbook/9781449327453/ch04s13.html
//
// TODO: The check digit can only be computed by calling a function to compute it dynamically
export const isbn = new Regex(
  '(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]'
);

// Re-export DSL components
export {
  Regex,
  CFG,
  FSM,
  JsonSchema,
  regex,
  cfg,
  fsm,
  jsonSchema,
  optional,
  either,
  exactly,
  atLeast,
  atMost,
  between,
  zeroOrMore,
  oneOrMore,
  // deprecated
  repeat,
  times,
} from './dsl';

// Re-export utility functions
export { getEnumFromLiteral } from './utils';

// Re-export domain-specific modules
export { countries };

// Export all built-in types as a convenience object
export const BuiltinTypes = {
  // Basic types
  string,
  integer,
  boolean,
  number,
  date,
  time,
  datetime,

  // Character types
  digit,
  char,
  newline,
  whitespace,

  // Formatted types
  hexStr,
  uuid4,
  ipv4,
  email,
  isbn,

  // Document types
  sentence,
  paragraph,
} as const;

// Export type definitions for the built-in types
export type BuiltinTypeNames = keyof typeof BuiltinTypes;

// Default export with everything
export default {
  ...BuiltinTypes,

  Regex,
  CFG,
  FSM,
  JsonSchema,
  regex,
  cfg,
  fsm,
  jsonSchema,
  optional,
  either,
  exactly,
  atLeast,
  atMost,
  between,
  zeroOrMore,
  oneOrMore,

  // Domain modules
  countries,
  // Should add airports too. TODO: add airports
};
