import * as tf from '@tensorflow/tfjs';
/**
 * Logits processors for structured generation.
 *  _______________________________
 * / Don't want to self-host?       \
 * \ Try .json at http://dottxt.co /
 *  -------------------------------
 *        \   ^__^
 *         \  (oo)\_______
 *             (__)\       )\/\
 *                 ||----w |
 *                 ||     ||
 *
 * Copyright 2024- the Outlines developers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { buildRegexFromSchema } from '../outlines-core';
import { OutlinesLogitsProcessor, TensorType } from './base-logit-processor';
import { Tokenizer } from '../models/tokenizer';
import { Guide, RegexGuide, CFGGuide, Instruction } from './guide';
import { JsonSchema } from '../types';

/**
 * Bias generation using a guide.
 *
 * Attributes
 * ----------
 * tokenizer
 *     The outlines tokenizer used to convert tokens to ids.
 * guide
 *     The outlines guide used to bias the logits.
 */
export class GuideLogitsProcessor extends OutlinesLogitsProcessor {
  tokenizer: Tokenizer;
  guide: Guide;
  _guide_states: Map<string, any>;
  _seq_start_idx: number | null;

  constructor(tokenizer: Tokenizer, guide: Guide, tensor_library_name: string) {
    /**
     * Parameters
     * ----------
     * tokenizer
     *     The tokenizer used to convert tokens to ids.
     * guide
     *     The `outlines.processors.guide.Guide` that is used to bias the
     *     logits.
     * tensor_library_name
     *     The name of the library to use to manipulate the tensors.
     */
    super(tensor_library_name);
    this.tokenizer = tokenizer;
    this.guide = guide;
    this._guide_states = new Map();
    this._guide_states.set(this.hash_key([]), this.guide.initialState);
    this._seq_start_idx = null;
  }

  process_logits(input_ids: TensorType, logits: TensorType): TensorType {
    /**
     * Use the Guide to bias the logits before sampling the next token.
     *
     * Parameters
     * ----------
     * input_ids
     *     The ids of the tokens of the existing sequences.
     * logits
     *     The logits for the current generation step.
     *
     * Returns
     * -------
     * TensorType
     *     The biased logits.
     */
    if (this._seq_start_idx === null) {
      this._seq_start_idx = this.tensor_adapter.shape(input_ids)[1]; // Assume [batch_size, seq_len]
    }

    const sequence_states: any[] = []; // vector of states corresponding to `input_ids`

    for (const seq_ids of input_ids.arraySync()) {
      const gen_ids = seq_ids.slice(this._seq_start_idx);
      const curr_state_key = this.hash_key(
        this.tensor_adapter.toList(tf.tensor(gen_ids))
      );

      if (!this._guide_states.has(curr_state_key)) {
        const prev_state = this._guide_states.get(
          this.hash_key(
            this.tensor_adapter.toList(tf.tensor(gen_ids.slice(0, -1)))
          )
        );
        const curr_state = this.guide.getNextState(
          prev_state,
          this.tensor_adapter.toScalar(tf.tensor(gen_ids[gen_ids.length - 1]))
        );
        this._guide_states.set(curr_state_key, curr_state);
      }

      sequence_states.push(this._guide_states.get(curr_state_key));
    }

    const allowed_tokens_batch: TensorType[] = [];
    const batch_indices: TensorType[] = [];

    console.log('---sequence_states', sequence_states);
    for (let i = 0; i < sequence_states.length; i++) {
      const guide_state = sequence_states[i];
      console.log('---guide_state', guide_state);
      const allowed_tokens = this.guide.getNextInstruction(guide_state).tokens;
      console.log('---allowed_tokens', allowed_tokens, '---iiiiii', i);
      allowed_tokens_batch.push(allowed_tokens);
      batch_indices.push(
        this.tensor_adapter.fullLike(tf.tensor(allowed_tokens), i)
      ); // Store batch index for each allowed token
    }

    const device = this.tensor_adapter.getDevice(logits);

    const allowed_tokens_concat = this.tensor_adapter.toDevice(
      this.tensor_adapter.concatenate(tf.tensor(allowed_tokens_batch) as any),
      device
    );

    const batch_indices_concat = this.tensor_adapter.toDevice(
      this.tensor_adapter.concatenate(batch_indices),
      device
    );

    const mask = this.tensor_adapter.booleanOnesLike(logits);
    // Set mask values to False for allowed tokens (False = not masked)
    this.setMaskValues(
      mask,
      batch_indices_concat,
      allowed_tokens_concat,
      false
    );
    const masked_logits = this.tensor_adapter.applyMask(
      logits,
      mask,
      -Infinity
    );

    console.log('---masked_logits', masked_logits);

    return masked_logits;
  }

  copy(): GuideLogitsProcessor {
    /**Return a copy of the logits processor.*/
    return new GuideLogitsProcessor(
      this.tokenizer,
      this.guide.copy(),
      this.tensor_adapter.libraryName
    );
  }

  protected hash_key(array: any[]): string {
    // Simple hash implementation for array keys
    return JSON.stringify(array);
  }

  private setMaskValues(
    mask: TensorType,
    batch_indices: TensorType,
    token_indices: TensorType,
    value: boolean
  ): void {
    // Set specific values in the mask tensor
    // This is a simplified implementation that works with the mask as a boolean array
    try {
      const mask_list = this.tensor_adapter.toList(mask);
      const batch_list = this.tensor_adapter.toList(batch_indices);
      const token_list = this.tensor_adapter.toList(token_indices);

      const batch_array = Array.isArray(batch_list) ? batch_list : [batch_list];
      const token_array = Array.isArray(token_list) ? token_list : [token_list];

      // For each batch index and token index pair, set the mask value
      for (
        let i = 0;
        i < Math.min(batch_array.length, token_array.length);
        i++
      ) {
        const batch_idx = batch_array[i];
        const token_idx = token_array[i];

        if (Array.isArray(mask_list) && Array.isArray(mask_list[batch_idx])) {
          mask_list[batch_idx][token_idx] = value;
        }
      }
    } catch (error) {
      console.warn('Could not set mask values:', error);
    }
  }
}

/**
 * Bias generation based on a regular expression.
 */
export class RegexLogitsProcessor extends GuideLogitsProcessor {
  constructor(
    regex_string: string,
    tokenizer: Tokenizer,
    tensor_library_name: string
  ) {
    /**
     * Parameters
     * ----------
     * regex_string
     *     A string that represents a regular expression.
     * tokenizer
     *     An Outlines tokenizer.
     * tensor_library_name
     *     The name of the library to use to manipulate the tensors.
     */
    // Build a guide from the regex string and then pass it to the
    // GuideLogitsProcessor superclass.
    const guide = RegexGuide.fromRegex(regex_string, tokenizer);
    super(tokenizer, guide, tensor_library_name);
  }
}

/**
 * Bias generation based on a JSON schema.
 */
export class JSONLogitsProcessor extends RegexLogitsProcessor {
  constructor(
    schema: JsonSchema,
    tokenizer: Tokenizer,
    tensor_library_name: string,
    whitespace_pattern?: string
  ) {
    /**
     * Parameters
     * ----------
     * schema
     *     A JSON schema that encodes the structure we want the model to generate.
     * tokenizer
     *     The tokenizer used to convert tokens to ids.
     * tensor_library_name
     *     The name of the library to use to manipulate the tensors.
     * whitespace_pattern
     *     Pattern to use for JSON syntactic whitespace (doesn't impact string
     *     literals). For example, to allow only a single space or newline with
     *     `whitespace_pattern=r"[\n ]?"`.
     */
    // Convert the JSON schema into a regex string and then pass it to the
    // RegexLogitsProcessor superclass.
    const schema_str = JSONLogitsProcessor.schema_to_string(schema);
    const regex_string = buildRegexFromSchema(schema_str, whitespace_pattern);
    super(regex_string, tokenizer, tensor_library_name);
  }

  private static schema_to_string(schema: JsonSchema): string {
    if (typeof schema === 'string') {
      return schema;
    }
    if (typeof schema === 'function') {
      // Handle Pydantic-like model classes
      // For now, return a basic object schema
      return JSON.stringify({
        type: 'object',
        properties: {},
        additionalProperties: true,
      });
    }
    return JSON.stringify(schema);
  }
}

/**
 * Bias generation based on a context-free grammar.
 */
export class CFGLogitsProcessor extends GuideLogitsProcessor {
  constructor(
    cfg_str: string,
    tokenizer: Tokenizer,
    tensor_library_name: string
  ) {
    /**
     * Parameters
     * ----------
     * cfg_str
     *     A string that represents a grammar.
     * tokenizer
     *     The tokenizer used to convert tokens to ids.
     * tensor_library_name
     *     The name of the library to use to manipulate the tensors.
     */
    // Build a guide from the CFG string and then pass it to the
    // GuideLogitsProcessor superclass.
    const cfg_guide = new CFGGuide(cfg_str, tokenizer);
    super(tokenizer, cfg_guide, tensor_library_name);
  }

  process_logits(input_ids: TensorType, logits: TensorType): TensorType {
    /**
     * Same behavior as GuideLogitsProcessor, but uses rejection
     * sampling.
     *
     * Parameters
     * ----------
     * input_ids
     *     The ids of the tokens of the existing sequences.
     * logits
     *     The logits for the current generation step.
     *
     * Returns
     * -------
     * TensorType
     *     The biased logits.
     */
    if (this._seq_start_idx === null) {
      this._seq_start_idx = this.tensor_adapter.shape(input_ids)[1]; // Usually [batch_size, seq_len]
    }

    const sequence_states: any[] = []; // vector of states corresponding to `input_ids`

    for (const seq_ids of input_ids) {
      const gen_ids = seq_ids.slice(this._seq_start_idx);
      const curr_state_key = this.hash_key(this.tensor_adapter.toList(gen_ids));

      if (!this._guide_states.has(curr_state_key)) {
        const prev_state = this._guide_states.get(
          this.hash_key(this.tensor_adapter.toList(gen_ids.slice(0, -1)))
        );
        const curr_state = this.guide.getNextState(
          prev_state,
          this.tensor_adapter.toScalar(gen_ids[gen_ids.length - 1])
        );
        this._guide_states.set(curr_state_key, curr_state);
      }

      sequence_states.push(this._guide_states.get(curr_state_key));
    }

    const mask = this.createFullLikeMask(logits, -Infinity);

    for (let i = 0; i < sequence_states.length; i++) {
      const guide_state = sequence_states[i];
      const sorted_indices = this.tensor_adapter.argsortDescending(logits[i]);
      const first_legal_token = this.get_first_valid_token(
        guide_state,
        sorted_indices
      );

      if (first_legal_token !== -1) {
        this.setLogitValue(
          mask,
          i,
          first_legal_token,
          this.getLogitValue(logits, i, first_legal_token)
        );
      }
    }

    return mask;
  }

  private get_first_valid_token(
    guide_state: any,
    sorted_indices: TensorType
  ): number {
    // Find the first valid token according to the guide
    const indices_list = this.tensor_adapter.toList(sorted_indices);

    for (const token_id of indices_list) {
      // Check if this token is valid for the current state
      try {
        // Use the CFG guide's iter_valid_token_ids method
        const valid_tokens = Array.from(
          (this.guide as CFGGuide).iterValidTokenIds(guide_state, [token_id])
        );
        if (valid_tokens.length > 0) {
          return token_id;
        }
      } catch (error) {
        // Token is not valid, continue to next
        continue;
      }
    }

    return -1; // No valid token found
  }

  private createFullLikeMask(
    tensor: TensorType,
    fill_value: number
  ): TensorType {
    // Create a tensor filled with the specified value with the same shape as the input
    const shape = this.tensor_adapter.shape(tensor);
    const total_size = shape.reduce((a, b) => a * b, 1);
    const flat_array = new Array(total_size).fill(fill_value);

    // Reshape to match original tensor shape
    if (shape.length === 2) {
      const result = [];
      for (let i = 0; i < shape[0]; i++) {
        result.push(flat_array.slice(i * shape[1], (i + 1) * shape[1]));
      }
      return result as any;
    }

    return flat_array as any;
  }

  private setLogitValue(
    tensor: TensorType,
    seq_index: number,
    token_index: number,
    value: number
  ): void {
    // Set a specific logit value
    try {
      const tensor_list = this.tensor_adapter.toList(tensor);

      if (Array.isArray(tensor_list) && Array.isArray(tensor_list[seq_index])) {
        tensor_list[seq_index][token_index] = value;
      } else if (Array.isArray(tensor_list)) {
        tensor_list[token_index] = value;
      }
    } catch (error) {
      console.warn('Could not set logit value:', error);
    }
  }

  private getLogitValue(
    tensor: TensorType,
    seq_index: number,
    token_index: number
  ): number {
    // Get a specific logit value
    try {
      const tensor_list = this.tensor_adapter.toList(tensor);

      if (Array.isArray(tensor_list) && Array.isArray(tensor_list[seq_index])) {
        return tensor_list[seq_index][token_index] || 0;
      } else if (Array.isArray(tensor_list)) {
        return tensor_list[token_index] || 0;
      }
    } catch (error) {
      console.warn('Could not get logit value:', error);
    }

    return 0;
  }
}

// Re-export base class
export { OutlinesLogitsProcessor };
