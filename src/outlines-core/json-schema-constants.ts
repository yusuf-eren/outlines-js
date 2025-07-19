/**
 * Static collection of regular expressions for JSON and format types used
 * in generating a regular expression string based on a given JSON schema.
 *
 * These constants mirror the Rust implementation in src/json_schema/types.rs
 */

// Basic JSON type patterns
export const STRING_INNER = '([^"\\\\\\x00-\\x1F\\x7F-\\x9F]|\\\\["\\\\])';
export const STRING = '"([^"\\\\\\x00-\\x1F\\x7F-\\x9F]|\\\\["\\\\])*"';
export const INTEGER = '(-)?(0|[1-9][0-9]*)';
export const NUMBER = '((-)?(0|[1-9][0-9]*))(\\.([0-9]+))?([eE][+-]?([0-9]+))?';
export const BOOLEAN = '(true|false)';
export const NULL = 'null';

/**
 * Default whitespace pattern used for generating a regular expression from JSON schema.
 *
 * It's being imposed since letting the model choose the number of white spaces and
 * new lines led to pathological behaviors, especially for small models.
 */
export const WHITESPACE = '[ ]?';

// Format-specific patterns
export const DATE_TIME =
  '"(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\\.[0-9]{3})?(Z)?"';
export const DATE =
  '"(?:\\d{4})-(?:0[1-9]|1[0-2])-(?:0[1-9]|[1-2][0-9]|3[0-1])"';
export const TIME =
  '"(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\\\\.[0-9]+)?(Z)?"';
export const UUID =
  '"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"';
export const URI =
  '"(?:(https?|ftp):\\/\\/([^\\s:@]+(:[^\\s:@]*)?@)?([a-zA-Z\\d.-]+\\.[a-zA-Z]{2,}|localhost)(:\\d+)?(\\/[^\\s?#]*)?(\\?[^\\s#]*)?(#[^\\s]*)?|urn:[a-zA-Z\\d][a-zA-Z\\d\\-]{0,31}:[^\\s]+)"';
export const EMAIL =
  '"(?:[a-z0-9!#$%&\'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&\'*+/=?^_`{|}~-]+)*|"(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21\\x23-\\x5b\\x5d-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21-\\x5a\\x53-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])+)\\])"';

/**
 * Supported JSON types enum
 */
export enum JsonType {
  String = 'string',
  Integer = 'integer',
  Number = 'number',
  Boolean = 'boolean',
  Null = 'null',
}

/**
 * Get regex pattern for a JSON type
 */
export function getJsonTypeRegex(type: JsonType): string {
  switch (type) {
    case JsonType.String:
      return STRING;
    case JsonType.Integer:
      return INTEGER;
    case JsonType.Number:
      return NUMBER;
    case JsonType.Boolean:
      return BOOLEAN;
    case JsonType.Null:
      return NULL;
    default:
      throw new Error(`Unsupported JSON type: ${type}`);
  }
}

/**
 * Supported format types for strings
 */
export enum FormatType {
  DateTime = 'date-time',
  Date = 'date',
  Time = 'time',
  Uuid = 'uuid',
  Uri = 'uri',
  Email = 'email',
}

/**
 * Get regex pattern for a format type
 */
export function getFormatTypeRegex(format: FormatType): string {
  switch (format) {
    case FormatType.DateTime:
      return DATE_TIME;
    case FormatType.Date:
      return DATE;
    case FormatType.Time:
      return TIME;
    case FormatType.Uuid:
      return UUID;
    case FormatType.Uri:
      return URI;
    case FormatType.Email:
      return EMAIL;
    default:
      throw new Error(`Unsupported format type: ${format}`);
  }
}

/**
 * Parse format type from string
 */
export function parseFormatType(format: string): FormatType | null {
  switch (format) {
    case 'date-time':
      return FormatType.DateTime;
    case 'date':
      return FormatType.Date;
    case 'time':
      return FormatType.Time;
    case 'uuid':
      return FormatType.Uuid;
    case 'uri':
      return FormatType.Uri;
    case 'email':
      return FormatType.Email;
    default:
      return null;
  }
}
