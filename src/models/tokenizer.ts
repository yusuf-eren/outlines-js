import { Tensor } from '@huggingface/transformers';
import ndarray from 'ndarray';
import * as tf from '@tensorflow/tfjs';

/**
 * Tokenizer interface for text encoding and decoding operations.
 *
 * This interface defines the contract that all tokenizers must implement
 * to be compatible with the outlines generation system.
 */

/**
 * Result type for tokenizer encoding operations.
 * Contains both token IDs and attention mask.
 */
// TODO: Review that section. It is raw function. We will use either ndarray, raw node type, or tensor.
// EVen huggingface.js maximum supports float32. BigInt64Array
// export type TokenizerEncodingResult = [Int32Array, Int32Array];

/**
 * Tokenizer interface that all tokenizer implementations must follow.
 *
 * This interface provides the essential methods for converting between
 * text and token representations, along with metadata about special tokens.
 */
export interface Tokenizer {
  /** The end-of-sequence token as a string */
  readonly eosToken: string;

  /** The token ID for the end-of-sequence token */
  readonly eosTokenId: number;

  /** The token ID for padding tokens */
  readonly padTokenId: number;

  /** Mapping from token strings to their corresponding IDs */
  readonly vocabulary: Record<string, number>;

  /** Set of special tokens (like EOS, PAD, UNK, etc.) */
  readonly specialTokens: Set<string>;

  /**
   * Encode text prompts into arrays of token IDs and attention masks.
   *
   * @param prompt - Single string or array of strings to encode
   * @returns Object containing token IDs and attention mask arrays
   */
  encode(
    prompt: string | string[],
    options?: Record<string, any>
  ): [Tensor, Tensor];

  /**
   * Decode an array of token IDs back to strings.
   *
   * @param tokenIds - Array of token IDs to decode
   * @returns Array of decoded strings
   */
  decode(tokenIds: Tensor[] | Tensor): string[];

  /**
   * Convert a token to its equivalent string representation.
   *
   * This is useful for tokenizers (e.g., BPE) where special characters
   * like whitespace may be represented by unique symbols (e.g., 'Ġ').
   * This method ensures that the token is converted to a human-readable string,
   * preventing mismatches between raw tokens and their string forms.
   *
   * @param token - The token to convert
   * @returns The string representation of the token
   */
  convertTokenToString(token: string): string;
}
