/**
 * Tensor adapter for the `tensorflow` library.
 */

import * as tf from '@tensorflow/tfjs';
import { TensorAdapter, TorchTensor } from './base';

/**
 * TensorFlow tensor adapter implementation.
 *
 * This adapter provides TensorFlow.js-specific implementations for tensor
 * operations using the @tensorflow/tfjs-node package.
 */
export class TensorFlowTensorAdapter extends TensorAdapter<tf.Tensor> {
  /**
   * The name of the tensor library this adapter supports.
   */
  readonly libraryName = 'tensorflow';

  /**
   * Get the shape of the tensor.
   *
   * @param tensor - The tensor to get the shape of
   * @returns The shape of the tensor as an array of numbers
   */
  shape(tensor: tf.Tensor): number[] {
    return tensor.shape;
  }

  /**
   * Add a dimension to the tensor at axis 0.
   *
   * @param tensor - The tensor to add a dimension to
   * @returns The tensor with an additional dimension
   */
  unsqueeze(tensor: tf.Tensor): tf.Tensor {
    return tf.expandDims(tensor, 0);
  }

  /**
   * Remove a dimension from the tensor at axis 0.
   *
   * @param tensor - The tensor to remove a dimension from
   * @returns The tensor with one less dimension
   */
  squeeze(tensor: tf.Tensor): tf.Tensor {
    return tf.squeeze(tensor, [0]);
  }

  /**
   * Convert the tensor to a list.
   *
   * @param tensor - The tensor to convert to a list
   * @returns The tensor as a nested array
   */
  toList(tensor: tf.Tensor): any[] {
    const data = tensor.dataSync();
    return Array.from(data);
  }

  /**
   * Return the only element of the tensor.
   *
   * @param tensor - The tensor to return the only element of
   * @returns The only element of the tensor
   */
  toScalar(tensor: tf.Tensor): any {
    const data = tensor.dataSync();
    return data[0];
  }

  /**
   * Create a tensor with the same shape as the input tensor filled
   * with a scalar value.
   *
   * @param tensor - The tensor to create a new tensor with the same shape
   * @param fillValue - The value to fill the new tensor with
   * @returns A tensor with the same shape filled with the specified value
   */
  fullLike(tensor: TorchTensor, fillValue: any): tf.Tensor {
    return tf.fill(tensor.shape, fillValue);
  }

  /**
   * Create a tensor from a JavaScript array
   *
   * @param array - The JavaScript array to convert
   * @returns A TensorFlow tensor
   */
  fromArray(array: number[]): tf.Tensor {
    return tf.tensor(array);
  }

  /**
   * Concatenate a list of tensors along axis 0.
   *
   * @param tensors - The list of tensors to concatenate
   * @returns The concatenated tensor
   */
  concatenate(tensors: tf.Tensor[]): tf.Tensor {
    // Ensure tensors is an array; if not, wrap it in an array
    if (!Array.isArray(tensors)) {
      tensors = [tensors];
    }
    // Degenerate case: only one tensor, just return its identity
    if (tensors.length === 1) {
      return tensors[0];
    }
    // Otherwise, concatenate along axis 0
    return tf.concat(tensors, 0);
  }

  /**
   * Get the name of the tensor's device.
   *
   * @param tensor - The tensor to get the device of
   * @returns The name of the tensor's device
   */
  getDevice(tensor: tf.Tensor): string {
    // TensorFlow.js doesn't expose device information in the same way
    // Return a default device name
    return 'cpu';
  }

  /**
   * Move the tensor to a specified device.
   *
   * @param tensor - The tensor to move to a specified device
   * @param device - The name of the device to move the tensor to
   * @returns The tensor moved to the specified device
   */
  toDevice(tensor: tf.Tensor, device: string): tf.Tensor {
    // TensorFlow.js handles device placement automatically
    // Return a copy of the tensor
    return tf.clone(tensor);
  }

  /**
   * Create a boolean ones tensor with the same shape as the input tensor.
   *
   * @param tensor - The tensor to create a boolean ones tensor with the same shape
   * @returns A boolean ones tensor with the same shape as the input tensor
   */
  booleanOnesLike(tensor: tf.Tensor): tf.Tensor {
    return tf.onesLike(tensor).cast('bool');
  }

  /**
   * Fill the elements of the tensor where the mask is True with the
   * specified value.
   *
   * @param tensor - The tensor to fill
   * @param mask - The mask to apply to the tensor
   * @param value - The value to fill the tensor with
   * @returns The tensor with the mask applied
   */
  applyMask(tensor: tf.Tensor, mask: tf.Tensor, value: any): tf.Tensor {
    return tf.where(
      mask,
      tf.fill(tensor.shape, value).cast(tensor.dtype),
      tensor
    );
  }

  /**
   * Return the indices that would sort the tensor in descending order
   * along axis -1.
   *
   * @param tensor - The tensor to sort
   * @returns The indices that would sort the tensor in descending order along axis -1
   */
  argsortDescending(tensor: tf.Tensor): tf.Tensor {
    // TensorFlow.js doesn't have argsort, but we can use topk to get all indices
    // in descending order along the last axis
    const k = tensor.shape[tensor.shape.length - 1];
    const { indices } = tf.topk(tensor, k, true); // sorted=true for descending order
    return indices;
  }
}
