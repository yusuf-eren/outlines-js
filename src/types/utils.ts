/**
 * Utility functions for the types module.
 *
 * TypeScript port of the Python utilities for type identification and conversion.
 */

import { ZodObject } from 'zod';
import { JsonSchema7Type } from 'zod-to-json-schema';

// Type aliases for common constructs
export type Any = any;
export type Callable = Function;
export type Dict<K extends string | number | symbol = any, V = any> = Record<
  K,
  V
>;
export type List<T = any> = T[];
export type Tuple<T extends readonly any[] = readonly any[]> = T;

// Interface for schema builders (Genson-like functionality)
export interface SchemaBuilder {
  addObject(obj: any): void;
  toSchema(): JsonSchema7Type;
}

// Interface for BaseModel-like objects (Pydantic equivalent)
export interface BaseModel {
  [key: string]: any;
}

// Type guards and identification functions

/**
 * Check if a value represents the integer type
 */
export function isInt(value: Any): boolean {
  return value === Number || value === 'number' || value === 'integer';
}

/**
 * Check if a value is an integer instance
 */
export function isIntInstance(value: Any): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/**
 * Check if a value represents the float type
 */
export function isFloat(value: Any): boolean {
  return value === Number || value === 'number' || value === 'float';
}

/**
 * Check if a value is a float instance
 */
export function isFloatInstance(value: Any): value is number {
  return typeof value === 'number' && !Number.isInteger(value);
}

/**
 * Check if a value represents the string type
 */
export function isString(value: Any): boolean {
  return typeof value === 'string';
}

/**
 * Check if a value is a string instance
 */
export function isStrInstance(value: Any): value is string {
  return typeof value === 'string';
}

/**
 * Check if a value represents the boolean type
 */
export function isBool(value: Any): boolean {
  return value === Boolean || value === 'boolean';
}

/**
 * Check if a value is a dictionary/object instance
 */
export function isDictInstance(value: Any): value is Record<string, any> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

/**
 * Check if a value represents the Date type
 */
export function isDatetime(value: Any): boolean {
  return (
    value === Date || (typeof value === 'object' && value?.constructor === Date)
  );
}

/**
 * Check if a value represents a date
 */
export function isDate(value: Any): boolean {
  return (
    value === Date || (typeof value === 'object' && value?.constructor === Date)
  );
}

/**
 * Check if a value represents a time
 */
export function isTime(value: Any): boolean {
  // In TypeScript, we don't have a separate Time type, but we can check for time-like strings
  return typeof value === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(value);
}

/**
 * Check if a value is the native dict/object type
 */
export function isNativeDict(value: Any): boolean {
  return value === Object || value === 'object';
}

/**
 * Check if a value is a typed dictionary
 */
export function isTypedDict(value: Any): boolean {
  // In TypeScript, this would be an interface or type with known keys
  return (
    typeof value === 'object' && value !== null && value.constructor === Object
  );
}

/**
 * Check if a value is a dataclass equivalent (interface with constructor)
 */
export function isDataclass(value: Any): boolean {
  return (
    typeof value === 'function' &&
    value.prototype &&
    value.prototype.constructor === value
  );
}

/**
 * Check if a value is a Pydantic-like model
 */
export function isPydanticModel(value: Any): boolean {
  return (
    typeof value === 'function' &&
    value.prototype &&
    typeof value.prototype.constructor === 'function'
  );
}

export function isZodSchema(value: Any): value is ZodObject<any> {
  return value instanceof ZodObject;
}

/**
 * Check if a value is a schema builder
 */
export function isGensonSchemaBuilder(value: Any): value is SchemaBuilder {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.addObject === 'function' &&
    typeof value.toSchema === 'function'
  );
}

/**
 * Check if a value is a literal type
 */
export function isLiteral(value: Any): boolean {
  // In TypeScript, literal types are represented as their actual values
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  );
}

/**
 * Check if a value represents a union type
 */
export function isUnion(value: Any): boolean {
  // Check if it's an array of types (representing a union)
  return Array.isArray(value) && value.length > 1;
}

/**
 * Check if a value is an enum
 */
export function isEnum(value: Any): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.constructor === 'function' &&
    Object.values(value).every(
      (v) => typeof v === 'string' || typeof v === 'number'
    )
  );
}

/**
 * Check if a value is callable (function)
 */
export function isCallable(value: Any): value is Function {
  return typeof value === 'function';
}

/**
 * Check if a value is a typing List
 */
export function isTypingList(value: Any): boolean {
  return Array.isArray(value) || value === Array;
}

/**
 * Check if a value is a typing Tuple
 */
export function isTypingTuple(value: Any): boolean {
  return Array.isArray(value) && Object.hasOwnProperty.call(value, 'length');
}

/**
 * Check if a value is a typing Dict
 */
export function isTypingDict(value: Any): boolean {
  return (
    value === Object ||
    (typeof value === 'object' && value?.constructor === Object)
  );
}

// Type conversion functions

/**
 * Create an enum from a literal type
 */
export function getEnumFromLiteral(value: Any): Record<string, any> {
  if (Array.isArray(value)) {
    const enumObj: Record<string, any> = {};
    value.forEach((item, index) => {
      enumObj[String(item)] = item;
    });
    return enumObj;
  }
  return { [String(value)]: value };
}

/**
 * Turn a function signature into a JSON schema.
 *
 * TypeScript equivalent of Python's signature inspection.
 */
export function get_schema_from_signature(fn: Function): JsonSchema7Type {
  const fnName = fn.name || 'Arguments';

  // Get parameter names from function string (basic implementation)
  const fnString = fn.toString();
  const paramMatch = fnString.match(/\(([^)]*)\)/);
  const params = paramMatch
    ? paramMatch[1]
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p)
    : [];

  const properties: Record<string, JsonSchema7Type> = {};
  const required: string[] = [];

  // Basic parameter analysis (TypeScript doesn't have runtime type info like Python)
  params.forEach((param) => {
    const paramName = param.split('=')[0].trim();
    if (paramName) {
      properties[paramName] = { type: 'string' }; // Default to string type
      if (!param.includes('=')) {
        required.push(paramName);
      }
    }
  });

  return {
    type: 'object',
    title: fnName,
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Generate a JSON schema from an enum-like object
 */
export function get_schema_from_enum(
  enumObj: Record<string, any>
): JsonSchema7Type {
  if (Object.keys(enumObj).length === 0) {
    throw new Error('Enum object has 0 members');
  }

  const choices: JsonSchema7Type[] = [];

  for (const [key, value] of Object.entries(enumObj)) {
    if (typeof value === 'function') {
      choices.push(get_schema_from_signature(value));
    } else {
      const schemaType = typeof value as
        | 'string'
        | 'number'
        | 'boolean'
        | 'object'
        | 'null'
        | 'integer'
        | 'array';
      choices.push({
        type:
          schemaType === 'object' && value === null
            ? 'null'
            : schemaType === 'number' && Number.isInteger(value)
            ? 'integer'
            : Array.isArray(value)
            ? 'array'
            : schemaType,
        const: value,
      } as JsonSchema7Type);
    }
  }

  return {
    title: enumObj.constructor?.name || 'Enum',
    anyOf: choices,
  } as JsonSchema7Type;
}

/**
 * Simple schema builder implementation
 */
export class SimpleSchemaBuilder implements SchemaBuilder {
  private objects: any[] = [];

  addObject(obj: any): void {
    this.objects.push(obj);
  }

  toSchema(): JsonSchema7Type {
    if (this.objects.length === 0) {
      return { type: 'object' };
    }

    // Analyze the objects to infer schema
    const firstObj = this.objects[0];
    const properties: Record<string, JsonSchema7Type> = {};

    if (typeof firstObj === 'object' && firstObj !== null) {
      for (const [key, value] of Object.entries(firstObj)) {
        let schemaProperty: JsonSchema7Type;

        if (Array.isArray(value)) {
          schemaProperty = { type: 'array' };
        } else if (value === null) {
          schemaProperty = { type: 'null' };
        } else if (typeof value === 'number' && Number.isInteger(value)) {
          schemaProperty = { type: 'integer' };
        } else if (typeof value === 'number') {
          schemaProperty = { type: 'number' };
        } else if (typeof value === 'boolean') {
          schemaProperty = { type: 'boolean' };
        } else if (typeof value === 'string') {
          schemaProperty = { type: 'string' };
        } else {
          schemaProperty = { type: 'object' };
        }

        properties[key] = schemaProperty;
      }
    }

    return {
      type: 'object',
      properties,
    };
  }
}

export function isJSON(value: any): value is JSON {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Export all utility functions
export default {
  isInt,
  isIntInstance,
  isFloat,
  isFloatInstance,
  isStrInstance,
  isBool,
  isDictInstance,
  isDatetime,
  isDate,
  isTime,
  isNativeDict,
  isTypedDict,
  isDataclass,
  isPydanticModel,
  isZodSchema,
  isJSON,
  isGensonSchemaBuilder,
  isLiteral,
  isUnion,
  isEnum,
  isCallable,
  isTypingList,
  isTypingTuple,
  isTypingDict,
  getEnumFromLiteral,
  get_schema_from_signature,
  get_schema_from_enum,
  SimpleSchemaBuilder,
};
