import * as tf from '@tensorflow/tfjs';
/**
 * Base class for logits processors.
 */

import { Tensor } from '@huggingface/transformers';
import {
  TensorAdapterImplementation,
  getTensorAdapter,
} from './tensor-adapters';

export type TensorType = any;

/**
 * Base class for logits processors.
 * This class implements a shared `__call__` method is called by the models
 * and returns the processed logits. It relies on the `process_logits` method
 * that must be implemented by the subclasses to do the actual processing. The
 * `tensor_adapter` attribute, created at initialization based on the
 * tensor library name specified in the constructor, is used to manipulate the
 * tensors using the appropriate library for the model (numpy, torch...).
 */
export abstract class OutlinesLogitsProcessor {
  tensor_adapter: TensorAdapterImplementation;

  constructor(tensor_library_name: string) {
    /**
     * Parameters
     * ----------
     * tensor_library_name
     *     The name of the library to use to manipulate tensors. Possible
     *     values are "jax", "mlx", "numpy", "tensorflow" and "torch". You
     *     must choose the library that your model is using.
     */
    const tensor_adapter_class = getTensorAdapter(tensor_library_name);
    if (tensor_adapter_class === undefined) {
      throw new NotImplementedError(
        `Library ${tensor_library_name} is not available`
      );
    }
    this.tensor_adapter = new tensor_adapter_class();
  }

  abstract process_logits(
    input_ids: TensorType,
    logits: TensorType
  ): TensorType;
  /**
   * Main method to implement for logits processors subclasses.
   * This method applies a mask on the logits to bias the generation.
   * It is called by the `__call__` method that standardizes the shape of
   * `input_ids` and `logits` to ensure they are 2D tensors.
   * Elements to keep in mind when designing universal logits processors:
   * - logits processors are only used once and never re-applied for a new
   * sequence generator
   * - Some models only pass output_ids, some models such as llamacpp and
   * transformers prefix with input_ids
   * - Some sampling methods, such as beam search, result in unstable
   * sequence ordering in models like vLLM
   * Parameters
   * ----------
   * input_ids
   *     The ids of the tokens of the existing sequences in a 2D tensor.
   * logits
   *     The logits for the current generation step in a 2D tensor.
   * Returns
   * -------
   * TensorType
   *     The processed logits as a 2D tensor.
   */

  __call__(input_ids: TensorType, logits: TensorType): TensorType {
    /**
     * Entrypoint for logits processors, this is the method that is
     * called by the model.
     * Because different models use different structures to store the
     * input_ids and logits, we standardize their format to 2D tensors
     * before calling the `process_logits` method. After processing, the
     * logits are cast back to the original array library type before being
     * returned.
     * Parameters
     * ----------
     * input_ids
     *     The ids of the tokens of the existing sequences in a tensor.
     * logits
     *     The logits for the current generation step in a tensor.
     * Returns
     * -------
     * TensorType
     *     The processed logits as a tensor.
     */
    // if input_ids is 1D and logits is 2D with a single sequence,
    // reshape input_ids to 2D (needed for mlx-lm)

    // TODO: Refactor all of this parts.
    input_ids = tf.tensor(input_ids.map((x) => x.map((y) => Number(y))));
    logits = tf.tensor([logits.data]);
    if (
      this.tensor_adapter.shape(input_ids).length === 1 &&
      this.tensor_adapter.shape(logits).length === 2 &&
      this.tensor_adapter.shape(logits)[0] === 1
    ) {
      input_ids = this.tensor_adapter.unsqueeze(input_ids);
    }

    if (
      !(
        this.tensor_adapter.shape(logits).slice(0, -1).length ===
          this.tensor_adapter.shape(input_ids).slice(0, -1).length &&
        this.tensor_adapter
          .shape(logits)
          .slice(0, -1)
          .every(
            (dim, i) =>
              dim === this.tensor_adapter.shape(input_ids).slice(0, -1)[i]
          )
      )
    ) {
      throw new Error(
        `Logits batch shape ${this.tensor_adapter
          .shape(logits)
          .slice(0, -1)} ` +
          `does not match input_ids batch shape ${this.tensor_adapter
            .shape(input_ids)
            .slice(0, -1)}`
      );
    }

    // Guarantee passed as 2D Tensors, then convert back to original
    // (1D or 2D) shape
    let processed_logits: TensorType;
    if (this.tensor_adapter.shape(logits).length === 2) {
      processed_logits = this.process_logits(input_ids, logits);
    } else if (this.tensor_adapter.shape(logits).length === 1) {
      processed_logits = this.tensor_adapter.squeeze(
        this.process_logits(
          this.tensor_adapter.unsqueeze(input_ids),
          this.tensor_adapter.unsqueeze(logits)
        )
      );
    } else {
      throw new Error(
        `Logits shape ${this.tensor_adapter.shape(logits)} is not ` +
          'supported'
      );
    }

    return new Tensor(
      'float32',
      processed_logits.dataSync(),
      processed_logits.shape
    );
  }
}

class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}
