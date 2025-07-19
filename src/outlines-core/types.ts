/**
 * Fundamental types used throughout the outlines-core library.
 *
 * These types mirror the Rust implementation in src/primitives.rs
 */

/**
 * Token content - represented as a byte array in Rust, string in TypeScript
 */
export type Token = string | Uint8Array;

/**
 * Token identifier - a 32-bit unsigned integer
 */
export type TokenId = number;

/**
 * State identifier in the finite state automaton - a 32-bit unsigned integer
 */
export type StateId = number;

/**
 * Type guard to check if a value is a valid TokenId
 */
export function isTokenId(value: any): value is TokenId {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 0xffffffff
  ); // 32-bit unsigned max
}

/**
 * Type guard to check if a value is a valid StateId
 */
export function isStateId(value: any): value is StateId {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 0xffffffff
  ); // 32-bit unsigned max
}

/**
 * Type guard to check if a value is a valid Token
 */
export function isToken(value: any): value is Token {
  return typeof value === 'string' || value instanceof Uint8Array;
}

/**
 * Convert a string token to bytes
 */
export function tokenToBytes(token: Token): Uint8Array {
  if (typeof token === 'string') {
    return new TextEncoder().encode(token);
  }
  return token;
}

/**
 * Convert bytes to a string token
 */
export function bytesToToken(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Parameters for loading a pretrained model from Hugging Face
 */
export interface FromPretrainedParameters {
  /** Git revision to use (commit hash, tag, or branch name) */
  revision?: string;
  /** Authentication token for private models */
  token?: string;
}

/**
 * Configuration options for building regex from JSON schema
 */
export interface JsonSchemaOptions {
  /** Custom whitespace pattern to use instead of default */
  whitespacePattern?: string;
  /** Maximum recursion depth for handling references (default: 3) */
  maxRecursionDepth?: number;
}

/**
 * Error types that can occur in the library
 */
export enum ErrorType {
  // Index Errors
  IndexDfaError = 'IndexDfaError',
  DfaHasNoStartState = 'DfaHasNoStartState',

  // Vocabulary Errors
  EOSTokenDisallowed = 'EOSTokenDisallowed',
  TokenizersError = 'TokenizersError',
  UnsupportedTokenizer = 'UnsupportedTokenizer',
  UnableToLocateEosTokenId = 'UnableToLocateEosTokenId',
  UnsupportedByTokenProcessor = 'UnsupportedByTokenProcessor',
  DecoderUnpackingFailed = 'DecoderUnpackingFailed',
  ByteProcessorFailed = 'ByteProcessorFailed',
  ByteFallbackProcessorFailed = 'ByteFallbackProcessorFailed',

  // JSON Schema Errors
  SerdeJsonError = 'SerdeJsonError',
  UnsupportedJsonSchema = 'UnsupportedJsonSchema',
  PropertiesNotFound = 'PropertiesNotFound',
  AllOfMustBeAnArray = 'AllOfMustBeAnArray',
  AnyOfMustBeAnArray = 'AnyOfMustBeAnArray',
  OneOfMustBeAnArray = 'OneOfMustBeAnArray',
  PrefixItemsMustBeAnArray = 'PrefixItemsMustBeAnArray',
  UnsupportedEnumDataType = 'UnsupportedEnumDataType',
  EnumMustBeAnArray = 'EnumMustBeAnArray',
  UnsupportedConstDataType = 'UnsupportedConstDataType',
  ConstKeyNotFound = 'ConstKeyNotFound',
  RefMustBeAString = 'RefMustBeAString',
  ExternalReferencesNotSupported = 'ExternalReferencesNotSupported',
  InvalidReferenceFormat = 'InvalidReferenceFormat',
  TypeMustBeAStringOrArray = 'TypeMustBeAStringOrArray',
  UnsupportedType = 'UnsupportedType',
  MaxBoundError = 'MaxBoundError',
  StringTypeUnsupportedFormat = 'StringTypeUnsupportedFormat',
  InvalidReferencePath = 'InvalidReferencePath',
  RefRecursionLimitReached = 'RefRecursionLimitReached',
}

/**
 * Custom error class for outlines-core errors
 */
export class OutlinesError extends Error {
  public readonly type: ErrorType;
  public readonly details?: any;

  constructor(type: ErrorType, message: string, details?: any) {
    super(message);
    this.name = 'OutlinesError';
    this.type = type;
    this.details = details;
  }

  /**
   * Check if this error is due to reaching recursion limit
   */
  isRecursionLimit(): boolean {
    return this.type === ErrorType.RefRecursionLimitReached;
  }
}
