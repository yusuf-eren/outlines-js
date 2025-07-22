/**
 * TypeScript implementation of buildRegexFromSchema with exact same functionality as Rust version
 * Generates regular expressions from JSON schemas for structured text generation
 */

// JSON Schema regex constants - exactly matching Rust implementation
export const JSON_SCHEMA_CONSTANTS = {
  STRING_INNER: `([^"\\\\\\x00-\\x1F\\x7F-\\x9F]|\\\\["\\\\])`,
  STRING: `"([^"\\\\\\x00-\\x1F\\x7F-\\x9F]|\\\\["\\\\])*"`,
  INTEGER: `(-)?(0|[1-9][0-9]*)`,
  NUMBER: `((-)?(0|[1-9][0-9]*))(\.[0-9]+)?([eE][+-][0-9]+)?`,
  BOOLEAN: `(true|false)`,
  NULL: `null`,
  WHITESPACE: `[ ]?`,
  DATE_TIME: `"(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\\.[0-9]{3})?(Z)?"`,
  DATE: `"(?:\\d{4})-(?:0[1-9]|1[0-2])-(?:0[1-9]|[1-2][0-9]|3[0-1])"`,
  TIME: `"(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\\\\.[0-9]+)?(Z)?"`,
  UUID: `"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"`,
  URI: `"(?:(https?|ftp):\\/\\/([^\\s:@]+(:[^\\s:@]*)?@)?([a-zA-Z\\d.-]+\\.[a-zA-Z]{2,}|localhost)(:\\d+)?(\\/[^\\s?#]*)?(\\?[^\\s#]*)?(#[^\\s]*)?|urn:[a-zA-Z\\d][a-zA-Z\\d\\-]{0,31}:[^\\s]+)"`,
  EMAIL: `"(?:[a-z0-9!#$%&'*+/=?^_\`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_\`{|}~-]+)*|"(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21\\x23-\\x5b\\x5d-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21-\\x5a\\x53-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])+)\\])"`,
} as const;

// Error types matching Rust implementation
export class JsonSchemaError extends Error {
  constructor(message: string, public errorType?: string) {
    super(message);
    this.name = 'JsonSchemaError';
  }
}

// Format types enum
enum FormatType {
  DateTime = 'date-time',
  Date = 'date',
  Time = 'time',
  Uuid = 'uuid',
  Uri = 'uri',
  Email = 'email',
}

// Main Parser class - matches Rust Parser struct
class Parser {
  private root: any;
  private whitespacePattern: string;
  private recursionDepth: number;
  private maxRecursionDepth: number;

  constructor(root: any) {
    this.root = root;
    this.whitespacePattern = JSON_SCHEMA_CONSTANTS.WHITESPACE;
    this.recursionDepth = 0;
    this.maxRecursionDepth = 3;
  }

  withWhitespacePattern(pattern: string): Parser {
    this.whitespacePattern = pattern;
    return this;
  }

  withMaxRecursionDepth(depth: number): Parser {
    this.maxRecursionDepth = depth;
    return this;
  }

  toRegex(json: any): string {
    if (typeof json !== 'object' || json === null) {
      throw new JsonSchemaError(
        'Expected JSON object',
        'UnsupportedJsonSchema'
      );
    }

    // Handle empty object case
    if (Object.keys(json).length === 0) {
      return this.parseEmptyObject();
    }

    console.log('----pass', json);

    console.log('---pascheck', 'properties' in json, 'for ', json);
    console.log('---pascheck', 'allOf' in json, 'for ', json);
    console.log('---pascheck', 'anyOf' in json, 'for ', json);
    console.log('---pascheck', 'oneOf' in json, 'for ', json);
    console.log('---pascheck', 'prefixItems' in json, 'for ', json);
    console.log('---pascheck', 'enum' in json, 'for ', json);
    console.log('---pascheck', 'const' in json, 'for ', json);
    console.log('---pascheck', '$ref' in json, 'for ', json);
    console.log('---pascheck', 'type' in json, 'for ', json);

    // Handle different schema types based on keys present
    if ('properties' in json) return this.parseProperties(json);
    if ('allOf' in json) return this.parseAllOf(json);
    if ('anyOf' in json) return this.parseAnyOf(json);
    if ('oneOf' in json) return this.parseOneOf(json);
    if ('prefixItems' in json) return this.parsePrefixItems(json);
    if ('enum' in json) return this.parseEnum(json);
    if ('const' in json) return this.parseConst(json);
    if ('$ref' in json) return this.parseRef(json);
    if ('type' in json) return this.parseType(json);

    console.log('----rs', json);

    throw new JsonSchemaError(
      `Unsupported JSON Schema structure: ${JSON.stringify(json)}`,
      'UnsupportedJsonSchema'
    );
  }

  private parseEmptyObject(): string {
    // Empty object means unconstrained, any json type is legal
    const types = [
      { type: 'boolean' },
      { type: 'null' },
      { type: 'number' },
      { type: 'integer' },
      { type: 'string' },
      { type: 'array' },
      { type: 'object' },
    ];

    const regexes = types.map((t) => `(${this.toRegex(t)})`);
    return regexes.join('|');
  }

  private parseProperties(obj: any): string {
    let regex = '\\{';

    const properties = obj.properties;
    if (!properties || typeof properties !== 'object') {
      throw new JsonSchemaError(
        "'properties' not found or not an object",
        'PropertiesNotFound'
      );
    }

    const requiredProperties = Array.isArray(obj.required) ? obj.required : [];
    const propertyNames = Object.keys(properties);
    const isRequired = propertyNames.map((name) =>
      requiredProperties.includes(name)
    );

    if (isRequired.some(Boolean)) {
      const lastRequiredPos = isRequired.reduce(
        (lastIndex, isReq, index) => (isReq ? index : lastIndex),
        -1
      );

      for (let i = 0; i < propertyNames.length; i++) {
        const name = propertyNames[i];
        const value = properties[name];

        let subregex = `${this.whitespacePattern}"${this.escapeRegex(name)}"${
          this.whitespacePattern
        }:${this.whitespacePattern}`;

        try {
          subregex += this.toRegex(value);
        } catch (e) {
          if (
            e instanceof JsonSchemaError &&
            e.errorType === 'RefRecursionLimitReached'
          ) {
            continue;
          }
          throw e;
        }

        if (i < lastRequiredPos) {
          subregex = `${subregex}${this.whitespacePattern},`;
        } else if (i > lastRequiredPos) {
          subregex = `${this.whitespacePattern},${subregex}`;
        }

        regex += isRequired[i] ? subregex : `(${subregex})?`;
      }
    } else {
      // No required properties - generate optional patterns
      const propertySubregexes: string[] = [];

      for (const [name, value] of Object.entries(properties)) {
        let subregex = `${this.whitespacePattern}"${this.escapeRegex(name)}"${
          this.whitespacePattern
        }:${this.whitespacePattern}`;

        try {
          subregex += this.toRegex(value);
        } catch (e) {
          if (
            e instanceof JsonSchemaError &&
            e.errorType === 'RefRecursionLimitReached'
          ) {
            continue;
          }
          throw e;
        }

        propertySubregexes.push(subregex);
      }

      const possiblePatterns: string[] = [];
      for (let i = 0; i < propertySubregexes.length; i++) {
        let pattern = '';

        for (let j = 0; j < i; j++) {
          pattern += `(${propertySubregexes[j]}${this.whitespacePattern},)?`;
        }

        pattern += propertySubregexes[i];
        possiblePatterns.push(pattern);
      }

      regex += `(${possiblePatterns.join('|')})?`;
    }

    regex += `${this.whitespacePattern}\\}`;
    return regex;
  }

  private parseAllOf(obj: any): string {
    const allOf = obj.allOf;
    if (!Array.isArray(allOf)) {
      throw new JsonSchemaError(
        "'allOf' must be an array",
        'AllOfMustBeAnArray'
      );
    }

    const subregexes = allOf.map((schema) => this.toRegex(schema));
    return `(${subregexes.join('')})`;
  }

  private parseAnyOf(obj: any): string {
    const anyOf = obj.anyOf;
    if (!Array.isArray(anyOf)) {
      throw new JsonSchemaError(
        "'anyOf' must be an array",
        'AnyOfMustBeAnArray'
      );
    }

    const subregexes = anyOf.map((schema) => this.toRegex(schema));
    return `(${subregexes.join('|')})`;
  }

  private parseOneOf(obj: any): string {
    const oneOf = obj.oneOf;
    if (!Array.isArray(oneOf)) {
      throw new JsonSchemaError(
        "'oneOf' must be an array",
        'OneOfMustBeAnArray'
      );
    }

    const subregexes = oneOf.map((schema) => `(?:${this.toRegex(schema)})`);
    return `(${subregexes.join('|')})`;
  }

  private parsePrefixItems(obj: any): string {
    const prefixItems = obj.prefixItems;
    if (!Array.isArray(prefixItems)) {
      throw new JsonSchemaError(
        "'prefixItems' must be an array",
        'PrefixItemsMustBeAnArray'
      );
    }

    const elementPatterns = prefixItems.map((schema) => this.toRegex(schema));
    const commaSplitPattern = `${this.whitespacePattern},${this.whitespacePattern}`;
    const tupleInner = elementPatterns.join(commaSplitPattern);

    return `\\[${this.whitespacePattern}${tupleInner}${this.whitespacePattern}\\]`;
  }

  private parseEnum(obj: any): string {
    const enumValues = obj.enum;
    if (!Array.isArray(enumValues)) {
      throw new JsonSchemaError("'enum' must be an array", 'EnumMustBeAnArray');
    }

    const choices = enumValues.map((choice) => this.parseConstValue(choice));
    return `(${choices.join('|')})`;
  }

  private parseConst(obj: any): string {
    if (!('const' in obj)) {
      throw new JsonSchemaError(
        "'const' key not found in object",
        'ConstKeyNotFound'
      );
    }
    return this.parseConstValue(obj.const);
  }

  private parseConstValue(value: any): string {
    if (Array.isArray(value)) {
      const innerRegex = value
        .map((v) => this.parseConstValue(v))
        .join(`${this.whitespacePattern},${this.whitespacePattern}`);
      return `\\[${this.whitespacePattern}${innerRegex}${this.whitespacePattern}\\]`;
    }

    if (value && typeof value === 'object') {
      const innerRegex = Object.entries(value)
        .map(
          ([key, val]) =>
            `"${key}"${this.whitespacePattern}:${
              this.whitespacePattern
            }${this.parseConstValue(val)}`
        )
        .join(`${this.whitespacePattern},${this.whitespacePattern}`);
      return `\\{${this.whitespacePattern}${innerRegex}${this.whitespacePattern}\\}`;
    }

    return this.escapeRegex(JSON.stringify(value));
  }

  private parseRef(obj: any): string {
    if (this.recursionDepth > this.maxRecursionDepth) {
      throw new JsonSchemaError(
        `Ref recursion limit reached: ${this.maxRecursionDepth}`,
        'RefRecursionLimitReached'
      );
    }

    this.recursionDepth++;

    try {
      const refPath = obj['$ref'];
      if (typeof refPath !== 'string') {
        throw new JsonSchemaError(
          "'$ref' must be a string",
          'RefMustBeAString'
        );
      }

      const parts = refPath.split('#');

      if (parts.length === 1 || (parts.length === 2 && parts[0] === '')) {
        const fragment = parts.length === 1 ? parts[0] : parts[1];
        const pathParts = fragment.split('/').filter((s) => s.length > 0);
        const referencedSchema = this.resolveLocalRef(this.root, pathParts);
        return this.toRegex(referencedSchema);
      }

      if (parts.length === 2) {
        const [base, fragment] = parts;
        if (this.root.$id === base || base === '') {
          const pathParts = fragment.split('/').filter((s) => s.length > 0);
          const referencedSchema = this.resolveLocalRef(this.root, pathParts);
          return this.toRegex(referencedSchema);
        }
        throw new JsonSchemaError(
          `External references are not supported: ${refPath}`,
          'ExternalReferencesNotSupported'
        );
      }

      throw new JsonSchemaError(
        `Invalid reference format: ${refPath}`,
        'InvalidReferenceFormat'
      );
    } finally {
      this.recursionDepth--;
    }
  }

  private parseType(obj: any): string {
    const type = obj.type;

    if (typeof type === 'string') {
      return this.parseTypeString(type, obj);
    }

    if (Array.isArray(type)) {
      const xorPatterns = type.map((instanceType) => {
        if (typeof instanceType !== 'string') {
          throw new JsonSchemaError(
            "'type' must be a string or an array of string",
            'TypeMustBeAStringOrArray'
          );
        }
        return `(?:${this.parseTypeString(instanceType, obj)})`;
      });
      return `(${xorPatterns.join('|')})`;
    }

    throw new JsonSchemaError(
      "'type' must be a string or an array of string",
      'TypeMustBeAStringOrArray'
    );
  }

  private parseTypeString(instanceType: string, obj: any): string {
    switch (instanceType) {
      case 'string':
        return this.parseStringType(obj);
      case 'number':
        return this.parseNumberType(obj);
      case 'integer':
        return this.parseIntegerType(obj);
      case 'array':
        return this.parseArrayType(obj);
      case 'object':
        return this.parseObjectType(obj);
      case 'boolean':
        return JSON_SCHEMA_CONSTANTS.BOOLEAN;
      case 'null':
        return JSON_SCHEMA_CONSTANTS.NULL;
      default:
        throw new JsonSchemaError(
          `Unsupported type: ${instanceType}`,
          'UnsupportedType'
        );
    }
  }

  private parseStringType(obj: any): string {
    // Handle length constraints
    if ('maxLength' in obj || 'minLength' in obj) {
      const maxLength = obj.maxLength;
      const minLength = obj.minLength;

      if (
        typeof minLength === 'number' &&
        typeof maxLength === 'number' &&
        minLength > maxLength
      ) {
        throw new JsonSchemaError(
          'maxLength must be greater than or equal to minLength',
          'MaxBoundError'
        );
      }

      const formattedMax =
        typeof maxLength === 'number' ? maxLength.toString() : '';
      const formattedMin =
        typeof minLength === 'number' ? minLength.toString() : '0';

      return `"${JSON_SCHEMA_CONSTANTS.STRING_INNER}{${formattedMin},${formattedMax}}"`;
    }

    // Handle pattern constraint
    if ('pattern' in obj) {
      const pattern = obj.pattern;
      if (typeof pattern === 'string') {
        if (pattern.startsWith('^') && pattern.endsWith('$')) {
          return `("${pattern.slice(1, -1)}")`;
        }
        return `("${pattern}")`;
      }
    }

    // Handle format constraint
    if ('format' in obj) {
      const format = obj.format;
      switch (format) {
        case FormatType.DateTime:
          return JSON_SCHEMA_CONSTANTS.DATE_TIME;
        case FormatType.Date:
          return JSON_SCHEMA_CONSTANTS.DATE;
        case FormatType.Time:
          return JSON_SCHEMA_CONSTANTS.TIME;
        case FormatType.Uuid:
          return JSON_SCHEMA_CONSTANTS.UUID;
        case FormatType.Uri:
          return JSON_SCHEMA_CONSTANTS.URI;
        case FormatType.Email:
          return JSON_SCHEMA_CONSTANTS.EMAIL;
        default:
          throw new JsonSchemaError(
            `Format ${format} is not supported by Outlines`,
            'StringTypeUnsupportedFormat'
          );
      }
    }

    return JSON_SCHEMA_CONSTANTS.STRING;
  }

  private parseNumberType(obj: any): string {
    const bounds = [
      'minDigitsInteger',
      'maxDigitsInteger',
      'minDigitsFraction',
      'maxDigitsFraction',
      'minDigitsExponent',
      'maxDigitsExponent',
    ];

    const hasBounds = bounds.some((key) => key in obj);

    if (hasBounds) {
      const [minDigitsInteger, maxDigitsInteger] = this.validateQuantifiers(
        obj.minDigitsInteger,
        obj.maxDigitsInteger,
        1
      );
      const [minDigitsFraction, maxDigitsFraction] = this.validateQuantifiers(
        obj.minDigitsFraction,
        obj.maxDigitsFraction,
        0
      );
      const [minDigitsExponent, maxDigitsExponent] = this.validateQuantifiers(
        obj.minDigitsExponent,
        obj.maxDigitsExponent,
        0
      );

      const integersQuantifier = this.buildQuantifier(
        minDigitsInteger,
        maxDigitsInteger,
        1,
        '*'
      );
      const fractionQuantifier = this.buildQuantifier(
        minDigitsFraction,
        maxDigitsFraction,
        0,
        '+'
      );
      const exponentQuantifier = this.buildQuantifier(
        minDigitsExponent,
        maxDigitsExponent,
        0,
        '+'
      );

      return `((-)?(0|[1-9][0-9]${integersQuantifier}))(\\.[0-9]${fractionQuantifier})?([eE][+-][0-9]${exponentQuantifier})?`;
    }

    return JSON_SCHEMA_CONSTANTS.NUMBER;
  }

  private parseIntegerType(obj: any): string {
    if ('minDigits' in obj || 'maxDigits' in obj) {
      const [minDigits, maxDigits] = this.validateQuantifiers(
        obj.minDigits,
        obj.maxDigits,
        1
      );
      const quantifier = this.buildQuantifier(minDigits, maxDigits, 0, '*');
      return `(-)?(0|[1-9][0-9]${quantifier})`;
    }

    return JSON_SCHEMA_CONSTANTS.INTEGER;
  }

  private parseObjectType(obj: any): string {
    const minProperties = obj.minProperties;
    const maxProperties = obj.maxProperties;

    const numRepeats = this.getNumItemsPattern(minProperties, maxProperties);

    if (!numRepeats) {
      return `\\{${this.whitespacePattern}\\}`;
    }

    const allowEmpty = !minProperties || minProperties === 0 ? '?' : '';
    const additionalProperties = obj.additionalProperties;

    let valuePattern: string;

    if (additionalProperties === undefined || additionalProperties === true) {
      const legalTypes: any[] = [
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' },
        { type: 'null' },
      ];

      const depth = obj.depth || 2;
      if (depth > 0) {
        legalTypes.push({ type: 'object', depth: depth - 1 });
        legalTypes.push({ type: 'array', depth: depth - 1 });
      }

      valuePattern = this.toRegex({ anyOf: legalTypes });
    } else {
      valuePattern = this.toRegex(additionalProperties);
    }

    const keyValuePattern = `${JSON_SCHEMA_CONSTANTS.STRING}${this.whitespacePattern}:${this.whitespacePattern}${valuePattern}`;
    const keyValueSuccessorPattern = `${this.whitespacePattern},${this.whitespacePattern}${keyValuePattern}`;
    const multipleKeyValuePattern = `(${keyValuePattern}(${keyValueSuccessorPattern}){0,})${allowEmpty}`;

    return `\\{${this.whitespacePattern}${multipleKeyValuePattern}${this.whitespacePattern}\\}`;
  }

  private parseArrayType(obj: any): string {
    const numRepeats =
      this.getNumItemsPattern(obj.minItems, obj.maxItems) || '';

    if (!numRepeats) {
      return `\\[${this.whitespacePattern}\\]`;
    }

    const allowEmpty = !obj.minItems || obj.minItems === 0 ? '?' : '';

    if ('items' in obj) {
      const itemsRegex = this.toRegex(obj.items);
      return `\\[${this.whitespacePattern}((${itemsRegex})(,${this.whitespacePattern}(${itemsRegex}))${numRepeats})${allowEmpty}${this.whitespacePattern}\\]`;
    }

    // Unconstrained array case
    const legalTypes: any[] = [
      { type: 'boolean' },
      { type: 'null' },
      { type: 'number' },
      { type: 'integer' },
      { type: 'string' },
    ];

    const depth = obj.depth || 2;
    if (depth > 0) {
      legalTypes.push({ type: 'object', depth: depth - 1 });
      legalTypes.push({ type: 'array', depth: depth - 1 });
    }

    const regexes = legalTypes.map((t) => this.toRegex(t));
    const regexesJoined = regexes.join('|');

    return `\\[${this.whitespacePattern}((${regexesJoined})(,${this.whitespacePattern}(${regexesJoined}))${numRepeats})${allowEmpty}${this.whitespacePattern}\\]`;
  }

  private resolveLocalRef(schema: any, pathParts: string[]): any {
    let current = schema;
    for (const part of pathParts) {
      if (!(part in current)) {
        throw new JsonSchemaError(
          `Invalid reference path: ${part}`,
          'InvalidReferencePath'
        );
      }
      current = current[part];
    }
    return current;
  }

  private validateQuantifiers(
    minBound?: number,
    maxBound?: number,
    startOffset: number = 0
  ): [number | null, number | null] {
    const adjustedMin =
      typeof minBound === 'number' ? Math.max(0, minBound - startOffset) : null;
    const adjustedMax =
      typeof maxBound === 'number' ? Math.max(0, maxBound - startOffset) : null;

    if (
      adjustedMin !== null &&
      adjustedMax !== null &&
      adjustedMax < adjustedMin
    ) {
      throw new JsonSchemaError(
        'maxLength must be greater than or equal to minLength',
        'MaxBoundError'
      );
    }

    return [adjustedMin, adjustedMax];
  }

  private buildQuantifier(
    min: number | null,
    max: number | null,
    defaultMin: number,
    unboundedSuffix: string
  ): string {
    if (min !== null && max !== null) {
      return `{${min},${max}}`;
    }
    if (min !== null) {
      return `{${min},}`;
    }
    if (max !== null) {
      return `{${defaultMin},${max}}`;
    }
    return unboundedSuffix;
  }

  private getNumItemsPattern(
    minItems?: number,
    maxItems?: number
  ): string | null {
    const min = minItems || 0;

    if (maxItems === undefined) {
      return `{${Math.max(0, min - 1)},}`;
    }

    if (maxItems < 1) {
      return null;
    }

    return `{${Math.max(0, min - 1)},${maxItems - 1}}`;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  }
}

/**
 * Generate regex from JSON schema - exact same functionality as Rust version
 * @param jsonSchema - JSON schema as string
 * @param whitespacePattern - Optional whitespace pattern
 * @param maxRecursionDepth - Maximum recursion depth (default: 3)
 */
export function buildRegexFromSchema(
  jsonSchema: string,
  whitespacePattern?: string,
  maxRecursionDepth?: number
): string {
  let jsonValue: any;

  try {
    console.log('---jsonSchemaYARRAK', jsonSchema, typeof jsonSchema);
    jsonValue = JSON.parse(jsonSchema);
  } catch (e) {
    throw new JsonSchemaError('Expected a valid JSON string.');
  }

  console.log('---jsonValue', jsonValue);
  let parser = new Parser(jsonValue);

  if (whitespacePattern) {
    parser = parser.withWhitespacePattern(whitespacePattern);
  }

  if (maxRecursionDepth !== undefined) {
    parser = parser.withMaxRecursionDepth(maxRecursionDepth);
  }

  console.log(
    '---parser.toRegex(jsonValue)',
    parser.toRegex(jsonValue),
    jsonValue
  );

  return parser.toRegex(jsonValue);
}

/**
 * Generate regex from JSON schema string (simple version)
 * @param schema - JSON schema as string
 */
export function regexFromStr(schema: string): string {
  return buildRegexFromSchema(schema, undefined, undefined);
}

// const schema = {
//   properties: {
//     name: { title: 'Name', type: 'string' },
//     age: { title: 'Age', type: 'integer' },
//   },
//   required: ['name', 'age'],
//   title: 'Person',
//   type: 'object',
// };

// const q = buildRegexFromSchema(JSON.stringify(schema));
// console.log(q);
