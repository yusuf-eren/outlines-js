/**
 * Regular expression DSL and output types for structured generation.
 *
 * This module contains elements related to three logical steps in the use of
 * output types for structured generation:
 *
 * 1. Definition of `Term` classes that contain output type definitions.
 * 2. Conversion of TypeScript types into `Term` instances (`typescriptTypesToTerms`).
 * 3. Conversion of a `Term` instance into a regular expression (`toRegex`).
 */

import { toJSONSchema } from 'zod';
import {
  isInt,
  isIntInstance,
  isFloat,
  isFloatInstance,
  isString,
  isStrInstance,
  isBool,
  isDatetime,
  isDate,
  isTime,
  isNativeDict,
  isDictInstance,
  isDataclass,
  isTypedDict,
  isPydanticModel,
  isGensonSchemaBuilder,
  isLiteral,
  isUnion,
  isEnum,
  isCallable,
  isTypingList,
  isTypingTuple,
  isTypingDict,
  get_schema_from_signature,
  isZodSchema,
  isJSON,
} from './utils';
import { boolean, integer, number, string } from './index';
import { buildRegexFromSchema } from '../outlines-core';

// Base Term class
export abstract class Term {
  /**
   * Represents types defined with a regular expression.
   */

  /**
   * Addition operator - creates a sequence
   */
  add(other: Term | string): Sequence {
    if (typeof other === 'string') {
      other = new StringTerm(other);
    }
    return new Sequence([this, other]);
  }

  /**
   * OR operator - creates alternatives
   */
  or(other: Term | string): Alternatives {
    if (typeof other === 'string') {
      other = new StringTerm(other);
    }
    return new Alternatives([this, other]);
  }

  /**
   * Validate that a given value matches this term's pattern
   */
  validate(value: string): string {
    const pattern = toRegex(this);
    const compiled = new RegExp(`^${pattern}$`);
    if (!compiled.test(String(value))) {
      throw new Error(
        `Input should be in the language of the regular expression ${pattern}`
      );
    }
    return value;
  }

  /**
   * Check that a given value is in the language defined by the Term
   */
  matches(value: string): boolean {
    const pattern = toRegex(this);
    const compiled = new RegExp(`^${pattern}$`);
    return compiled.test(String(value));
  }

  /**
   * Display the regex tree in ASCII format
   */
  displayAsciiTree(indent: string = '', isLast: boolean = true): string {
    const branch = isLast ? '└── ' : '├── ';
    let result = indent + branch + this.displayNode() + '\n';

    const newIndent = indent + (isLast ? '    ' : '│   ');
    result += this.displayChildren(newIndent);
    return result;
  }

  /**
   * Display the current node - to be implemented by subclasses
   */
  protected abstract displayNode(): string;

  /**
   * Display the children of this node - override in subclasses with children
   */
  protected displayChildren(indent: string): string {
    return '';
  }

  toString(): string {
    return this.displayAsciiTree();
  }

  // Utility methods for building complex patterns
  optional(): Optional {
    return optional(this);
  }

  exactly(count: number): QuantifyExact {
    return exactly(count, this);
  }

  atLeast(count: number): QuantifyMinimum {
    return atLeast(count, this);
  }

  atMost(count: number): QuantifyMaximum {
    return atMost(count, this);
  }

  between(minCount: number, maxCount: number): QuantifyBetween {
    return between(minCount, maxCount, this);
  }

  oneOrMore(): KleenePlus {
    return oneOrMore(this);
  }

  zeroOrMore(): KleeneStar {
    return zeroOrMore(this);
  }

  // Deprecated methods
  times(count: number): QuantifyExact {
    console.warn('times() is deprecated. Use exactly() instead.');
    return this.exactly(count);
  }

  repeat(
    minCount: number,
    maxCount?: number
  ): QuantifyMinimum | QuantifyMaximum | QuantifyBetween {
    console.warn(
      'repeat() is deprecated. Use between(), atLeast(), or atMost() instead.'
    );
    if (maxCount === undefined) {
      return this.atLeast(minCount);
    }
    return this.between(minCount, maxCount);
  }
}

// String Term class
export class StringTerm extends Term {
  constructor(public value: string) {
    super();
  }

  protected displayNode(): string {
    return `String('${this.value}')`;
  }
}

// Regex Term class
export class Regex extends Term {
  constructor(public pattern: string) {
    super();
  }

  protected displayNode(): string {
    return `Regex('${this.pattern}')`;
  }
}

// CFG Term class
export class CFG extends Term {
  constructor(public definition: string) {
    super();
  }

  protected displayNode(): string {
    return `CFG('${this.definition}')`;
  }

  equals(other: any): boolean {
    return other instanceof CFG && this.definition === other.definition;
  }

  static async fromFile(path: string): Promise<CFG> {
    const fs = await import('fs');
    const definition = fs.readFileSync(path, 'utf-8');
    return new CFG(definition);
  }
}

// FSM Term class
export class FSM extends Term {
  constructor(public fsm: any) {
    super();
  }

  protected displayNode(): string {
    return `FSM(${this.fsm.toString()})`;
  }
}

// JsonSchema Term class
export class JsonSchema extends Term {
  public schema: string;
  public whitespacePattern?: string;

  constructor(
    schema: Record<string, any> | string | any,
    whitespacePattern?: string
  ) {
    console.log('---schemaON CONSTRUCTOR 1', schema, whitespacePattern);
    super();
    console.log(
      '---schemaON CONSTRUCTOR 2',
      schema,
      whitespacePattern,
      typeof schema
    );
    let schemaStr: string;

    if (isZodSchema(schema)) {
      // TODO: TO JSON FUNCTION IMPLEMENT
      schemaStr = JSON.stringify(toJSONSchema(schema));

      console.log('---schemaStr', schemaStr);
    } else if (isStrInstance(schema)) {
      schemaStr = String(schema);
    } else if (isJSON(schema)) {
      console.log('---schema is JSON', schema);
      schemaStr = JSON.stringify(schema);
    } else {
      throw new Error(
        `Cannot parse schema ${schema}. The schema must be either ` +
          'a class, typed dict, a dataclass, a schema builder, or a string ' +
          'or dict that contains the JSON schema specification'
      );
    }

    this.schema = schemaStr;
    this.whitespacePattern = whitespacePattern;

    console.log('---this.schema', this.schema);
    // Validate the schema
    try {
      this.schema = JSON.parse(this.schema);
    } catch (e) {
      throw new Error(`Invalid JSON schema: ${e}`);
    }
  }

  protected displayNode(): string {
    return `JsonSchema('${this.schema}')`;
  }

  equals(other: any): boolean {
    if (!(other instanceof JsonSchema)) {
      return false;
    }
    try {
      const selfDict = JSON.parse(this.schema);
      const otherDict = JSON.parse(other.schema);
      return JSON.stringify(selfDict) === JSON.stringify(otherDict);
    } catch {
      return this.schema === other.schema;
    }
  }

  static async fromFile(path: string): Promise<JsonSchema> {
    const fs = await import('fs');
    const schema = JSON.parse(fs.readFileSync(path, 'utf-8'));
    return new JsonSchema(schema);
  }
}

// Quantifier classes
export class KleeneStar extends Term {
  constructor(public term: Term) {
    super();
  }

  protected displayNode(): string {
    return 'KleeneStar(*)';
  }

  protected displayChildren(indent: string): string {
    return this.term.displayAsciiTree(indent, true);
  }
}

export class KleenePlus extends Term {
  constructor(public term: Term) {
    super();
  }

  protected displayNode(): string {
    return 'KleenePlus(+)';
  }

  protected displayChildren(indent: string): string {
    return this.term.displayAsciiTree(indent, true);
  }
}

export class Optional extends Term {
  constructor(public term: Term) {
    super();
  }

  protected displayNode(): string {
    return 'Optional(?)';
  }

  protected displayChildren(indent: string): string {
    return this.term.displayAsciiTree(indent, true);
  }
}

export class Alternatives extends Term {
  constructor(public terms: Term[]) {
    super();
  }

  protected displayNode(): string {
    return 'Alternatives(|)';
  }

  protected displayChildren(indent: string): string {
    return this.terms
      .map((term, i) =>
        term.displayAsciiTree(indent, i === this.terms.length - 1)
      )
      .join('');
  }
}

export class Sequence extends Term {
  constructor(public terms: Term[]) {
    super();
  }

  protected displayNode(): string {
    return 'Sequence';
  }

  protected displayChildren(indent: string): string {
    return this.terms
      .map((term, i) =>
        term.displayAsciiTree(indent, i === this.terms.length - 1)
      )
      .join('');
  }
}

export class QuantifyExact extends Term {
  constructor(public term: Term, public count: number) {
    super();
  }

  protected displayNode(): string {
    return `Quantify({${this.count}})`;
  }

  protected displayChildren(indent: string): string {
    return this.term.displayAsciiTree(indent, true);
  }
}

export class QuantifyMinimum extends Term {
  constructor(public term: Term, public minCount: number) {
    super();
  }

  protected displayNode(): string {
    return `Quantify({${this.minCount},})`;
  }

  protected displayChildren(indent: string): string {
    return this.term.displayAsciiTree(indent, true);
  }
}

export class QuantifyMaximum extends Term {
  constructor(public term: Term, public maxCount: number) {
    super();
  }

  protected displayNode(): string {
    return `Quantify({,${this.maxCount}})`;
  }

  protected displayChildren(indent: string): string {
    return this.term.displayAsciiTree(indent, true);
  }
}

export class QuantifyBetween extends Term {
  constructor(
    public term: Term,
    public minCount: number,
    public maxCount: number
  ) {
    super();
    if (this.minCount > this.maxCount) {
      throw new Error(
        'QuantifyBetween: `maxCount` must be greater than `minCount`.'
      );
    }
  }

  protected displayNode(): string {
    return `Quantify({${this.minCount},${this.maxCount}})`;
  }

  protected displayChildren(indent: string): string {
    return this.term.displayAsciiTree(indent, true);
  }
}

// Factory functions
export function regex(pattern: string): Regex {
  return new Regex(pattern);
}

export function cfg(definition: string): CFG {
  return new CFG(definition);
}

export function fsm(fsmInstance: any): FSM {
  return new FSM(fsmInstance);
}

export function jsonSchema(
  schema: Record<string, any> | string | any
): JsonSchema {
  console.log('---jsonSchema', schema);
  return new JsonSchema(schema);
}

export function either(...terms: Array<string | Term>): Alternatives {
  const convertedTerms = terms.map((arg) =>
    typeof arg === 'string' ? new StringTerm(arg) : arg
  );
  return new Alternatives(convertedTerms);
}

export function optional(term: Term | string): Optional {
  const convertedTerm = typeof term === 'string' ? new StringTerm(term) : term;
  return new Optional(convertedTerm);
}

export function exactly(count: number, term: Term | string): QuantifyExact {
  const convertedTerm = typeof term === 'string' ? new StringTerm(term) : term;
  return new QuantifyExact(convertedTerm, count);
}

export function atLeast(count: number, term: Term | string): QuantifyMinimum {
  const convertedTerm = typeof term === 'string' ? new StringTerm(term) : term;
  return new QuantifyMinimum(convertedTerm, count);
}

export function atMost(count: number, term: Term | string): QuantifyMaximum {
  const convertedTerm = typeof term === 'string' ? new StringTerm(term) : term;
  return new QuantifyMaximum(convertedTerm, count);
}

export function between(
  minCount: number,
  maxCount: number,
  term: Term | string
): QuantifyBetween {
  const convertedTerm = typeof term === 'string' ? new StringTerm(term) : term;
  return new QuantifyBetween(convertedTerm, minCount, maxCount);
}

export function zeroOrMore(term: Term | string): KleeneStar {
  const convertedTerm = typeof term === 'string' ? new StringTerm(term) : term;
  return new KleeneStar(convertedTerm);
}

export function oneOrMore(term: Term | string): KleenePlus {
  const convertedTerm = typeof term === 'string' ? new StringTerm(term) : term;
  return new KleenePlus(convertedTerm);
}

// Type conversion function
export function typescriptTypesToTerms(
  type: any,
  recursionDepth: number = 0
): Term {
  if (recursionDepth > 10) {
    throw new Error(
      `Maximum recursion depth exceeded when converting ${type}. This might be due to a recursive type definition.`
    );
  }

  // First handle Term instances
  if (type instanceof Term) {
    return type;
  }

  if (isZodSchema(type)) {
    console.log('---type', type);
    console.log('---toJSONSchemaRAW', toJSONSchema(type));
    return new JsonSchema(toJSONSchema(type));
  }

  // Basic types
  if (isInt(type)) {
    return integer;
  } else if (isFloat(type)) {
    return number;
  } else if (isBool(type)) {
    return boolean;
  } else if (isString(type)) {
    return string;
  } else if (isNativeDict(type)) {
    return new JsonSchema('{}');
  } else if (isTime(type)) {
    return new Regex('([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])');
  } else if (isDate(type)) {
    return new Regex('(\\d{4})-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])');
  } else if (isDatetime(type)) {
    return new Regex(
      '(\\d{4})-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])(\\s)([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])'
    );
  }

  // Basic type instances
  if (isStrInstance(type)) {
    return new StringTerm(type);
  } else if (isIntInstance(type) || isFloatInstance(type)) {
    return new Regex(String(type));
  }

  // Structured types
  const structuredTypeChecks = [
    (x: any) => isDataclass(x),
    (x: any) => isTypedDict(x),
    (x: any) => isPydanticModel(x),
  ];

  if (structuredTypeChecks.some((check) => check(type))) {
    return new JsonSchema(type);
  }

  if (isGensonSchemaBuilder(type)) {
    const schema = type.toSchema();
    return new JsonSchema(JSON.stringify(schema));
  }

  if (isEnum(type)) {
    return new Alternatives(
      getEnumMembers(type).map((member) =>
        typescriptTypesToTerms(member, recursionDepth + 1)
      )
    );
  }

  if (isLiteral(type)) {
    return handleLiteral(type);
  } else if (isUnion(type)) {
    return handleUnion(type, recursionDepth);
  } else if (isTypingList(type)) {
    return handleList(type, recursionDepth);
  } else if (isTypingTuple(type)) {
    return handleTuple(type, recursionDepth);
  } else if (isTypingDict(type)) {
    return handleDict(type, recursionDepth);
  }

  if (isCallable(type)) {
    return new JsonSchema(get_schema_from_signature(type));
  }

  const typeName = type?.name || type;
  throw new TypeError(
    `Type ${typeName} is currently not supported. Please open an issue: ` +
      'https://github.com/dottxt-ai/outlines/issues'
  );
}

// Helper functions
function getEnumMembers(ptype: any): any[] {
  const regularMembers = Object.values(ptype);
  const functionMembers: any[] = [];

  for (const [key, value] of Object.entries(ptype)) {
    if (
      typeof value === 'function' &&
      !key.startsWith('_') &&
      key !== 'generateNextValue'
    ) {
      functionMembers.push(value);
    }
  }

  return [...regularMembers, ...functionMembers];
}

export function handleLiteral(args: any): Alternatives {
  if (Array.isArray(args)) {
    return new Alternatives(args.map((arg) => typescriptTypesToTerms(arg)));
  }
  return new Alternatives([typescriptTypesToTerms(args)]);
}

export function handleUnion(args: any, recursionDepth: number): Alternatives {
  // Handle the Optional<T> type (T | undefined)
  if (Array.isArray(args) && args.length === 2 && args.includes(undefined)) {
    const otherType = args.find((arg) => arg !== undefined);
    return new Alternatives([
      typescriptTypesToTerms(otherType, recursionDepth + 1),
      new StringTerm('null'),
    ]);
  }

  if (Array.isArray(args)) {
    return new Alternatives(
      args.map((arg) => typescriptTypesToTerms(arg, recursionDepth + 1))
    );
  }

  return new Alternatives([typescriptTypesToTerms(args, recursionDepth + 1)]);
}

export function handleList(args: any, recursionDepth: number): Sequence {
  if (!Array.isArray(args) || args.length !== 1) {
    throw new TypeError(
      `Only homogeneous lists are supported. Got multiple type arguments ${args}.`
    );
  }

  const itemType = typescriptTypesToTerms(args[0], recursionDepth + 1);
  return new Sequence([
    new StringTerm('['),
    itemType,
    new KleeneStar(new Sequence([new StringTerm(', '), itemType])),
    new StringTerm(']'),
  ]);
}

export function handleTuple(
  args: any,
  recursionDepth: number
): Sequence | StringTerm {
  if (!Array.isArray(args) || args.length === 0) {
    return new StringTerm('()');
  } else if (args.length === 2 && args[1] === '...') {
    // Handle rest parameters
    const itemTerm = typescriptTypesToTerms(args[0], recursionDepth + 1);
    return new Sequence([
      new StringTerm('('),
      itemTerm,
      new KleeneStar(new Sequence([new StringTerm(', '), itemTerm])),
      new StringTerm(')'),
    ]);
  } else {
    const items = args.map((arg: any) =>
      typescriptTypesToTerms(arg, recursionDepth + 1)
    );
    const separator = new StringTerm(', ');
    const elements: Term[] = [];

    for (let i = 0; i < items.length; i++) {
      elements.push(items[i]);
      if (i < items.length - 1) {
        elements.push(separator);
      }
    }

    return new Sequence([
      new StringTerm('('),
      ...elements,
      new StringTerm(')'),
    ]);
  }
}

export function handleDict(args: any, recursionDepth: number): Sequence {
  if (!Array.isArray(args) || args.length !== 2) {
    throw new TypeError(
      `Dict must have exactly two type arguments. Got ${args}.`
    );
  }

  const keyType = typescriptTypesToTerms(args[0], recursionDepth + 1);
  const valueType = typescriptTypesToTerms(args[1], recursionDepth + 1);

  return new Sequence([
    new StringTerm('{'),
    new Optional(
      new Sequence([
        keyType,
        new StringTerm(':'),
        valueType,
        new KleeneStar(
          new Sequence([
            new StringTerm(', '),
            keyType,
            new StringTerm(':'),
            valueType,
          ])
        ),
      ])
    ),
    new StringTerm('}'),
  ]);
}

// Deprecated functions (with warnings)
export function repeat(
  term: Term,
  minCount?: number,
  maxCount?: number
): QuantifyMinimum | QuantifyMaximum | QuantifyBetween {
  console.warn(
    'The `repeat` function is deprecated. Use `between`, `atLeast` or `atMost` instead.'
  );

  if (minCount === undefined && maxCount === undefined) {
    throw new Error(
      'You must provide a value for at least `minCount` or `maxCount`'
    );
  }

  if (maxCount === undefined) {
    return atLeast(minCount!, term);
  }

  if (minCount === undefined) {
    return atMost(maxCount, term);
  }

  return between(minCount, maxCount, term);
}

export function times(term: Term, count: number): QuantifyExact {
  console.warn('The `times` function is deprecated. Use `exactly` instead.');
  return exactly(count, term);
}

// Regex conversion function
export function toRegex(term: Term): string {
  console.log('---termBEFORE_      toRegex', term, term.constructor.name);
  if (term instanceof StringTerm) {
    return escapeRegex(term.value);
  } else if (term instanceof Regex) {
    return `(${term.pattern})`;
  } else if (term instanceof JsonSchema) {
    console.log('instens', term.schema, term.whitespacePattern);
    const regexStr = buildRegexFromSchema(
      JSON.stringify(term.schema, null, 2),
      term.whitespacePattern
    );
    console.log('---term.schema', term.schema);
    console.log('---regexStr', regexStr);
    return `(${regexStr})`;
  } else if (term instanceof KleeneStar) {
    return `(${toRegex(term.term)})*`;
  } else if (term instanceof KleenePlus) {
    return `(${toRegex(term.term)})+`;
  } else if (term instanceof Optional) {
    return `(${toRegex(term.term)})?`;
  } else if (term instanceof Alternatives) {
    const regexes = term.terms.map((subterm) => toRegex(subterm));
    return `(${regexes.join('|')})`;
  } else if (term instanceof Sequence) {
    const regexes = term.terms.map((subterm) => toRegex(subterm));
    return regexes.join('');
  } else if (term instanceof QuantifyExact) {
    return `(${toRegex(term.term)}){${term.count}}`;
  } else if (term instanceof QuantifyMinimum) {
    return `(${toRegex(term.term)}){${term.minCount},}`;
  } else if (term instanceof QuantifyMaximum) {
    return `(${toRegex(term.term)}){0,${term.maxCount}}`;
  } else if (term instanceof QuantifyBetween) {
    return `(${toRegex(term.term)}){${term.minCount},${term.maxCount}}`;
  } else {
    throw new TypeError(
      `Cannot convert object ${term.toString()} to a regular expression.`
    );
  }
}

// Helper functions
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// function buildRegexFromSchema(
//   schema: string,
//   whitespacePattern?: string
// ): string {
//   try {
//     const parsedSchema = JSON.parse(schema);
//     const ws = whitespacePattern || '[ \\t\\n\\r]*';

//     // Handle integer type specifically
//     if (parsedSchema.type === 'integer') {
//       return '[+-]?(0|[1-9][0-9]*)';
//     }

//     // Handle string type
//     if (parsedSchema.type === 'string') {
//       return '"[^"]*"';
//     }

//     // Handle number type
//     if (parsedSchema.type === 'number') {
//       return '[+-]?(0|[1-9][0-9]*)(\\.[0-9]+)?([eE][+-]?[0-9]+)?';
//     }

//     // Handle boolean type
//     if (parsedSchema.type === 'boolean') {
//       return '(true|false)';
//     }

//     // Handle object schemas with pattern properties (outlines format)
//     if (
//       typeof parsedSchema === 'object' &&
//       !parsedSchema.type &&
//       !Array.isArray(parsedSchema)
//     ) {
//       const properties = Object.keys(parsedSchema);

//       if (properties.length > 0) {
//         // Build JSON object pattern: {"key1": pattern1, "key2": pattern2}
//         const propertyPatterns: string[] = [];

//         for (const key of properties) {
//           const keyPattern = `"${escapeRegex(key)}"`;
//           const valueDef = parsedSchema[key];
//           let valuePattern: string;

//           if (valueDef && typeof valueDef === 'object' && valueDef.pattern) {
//             // Use the pattern directly from the property definition
//             valuePattern = valueDef.pattern;
//           } else {
//             // Fallback to generic value pattern
//             valuePattern =
//               '(?:null|true|false|[+-]?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|"[^"]*")';
//           }

//           propertyPatterns.push(`${keyPattern}${ws}:${ws}${valuePattern}`);
//         }

//         // Create object pattern: { "key1": value1, "key2": value2 }
//         const objectContent = propertyPatterns.join(`${ws},${ws}`);
//         return `\\{${ws}${objectContent}${ws}\\}`;
//       }
//     }

//     // Fallback for unsupported types
//     return '.*';
//   } catch (error) {
//     // If JSON parsing fails, return fallback
//     console.warn('Failed to parse schema for regex conversion:', error);
//     return '.*';
//   }
// }

// Export aliases
export { StringTerm as String, typescriptTypesToTerms as pythonTypesToTerms };

export default {
  regex,
  cfg,
  fsm,
  jsonSchema,
  either,
  optional,
  exactly,
  atLeast,
  atMost,
  between,
  zeroOrMore,
  oneOrMore,
  typescriptTypesToTerms,
  toRegex,
  repeat,
  times,
};
