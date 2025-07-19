/**
 * Base class for tensor adapters.
 */

// Type definition for torch tensor (since we can't import torch in TS)
export interface TorchTensor {
  // Basic torch tensor interface - implementations should handle actual torch tensors
  shape: number[];
  device?: string;
}

/**
 * Abstract base class for tensor adapters.
 *
 * This class defines the interface for tensor adapters that are used to
 * manipulate tensors in different libraries. Concrete implementations of
 * this class should provide specific implementations for each method as
 * well as providing a `libraryName` property.
 *
 * TODO: Update the version of outlines-core used to receive plain arrays
 * instead of torch tensors. In the meantime, implementations of this class
 * must make sure that their `fullLike` and `concatenate` methods can
 * handle torch tensors.
 */
export abstract class TensorAdapter<TensorType> {
  /**
   * The name of the tensor library this adapter supports.
   */
  abstract readonly libraryName: string;

  /**
   * Get the shape of the tensor.
   *
   * @param tensor - The tensor to get the shape of
   * @returns The shape of the tensor. The array contains as many elements as
   *          there are dimensions in the tensor
   */
  abstract shape(tensor: TensorType): number[];

  /**
   * Add a dimension to the tensor at axis 0.
   *
   * @param tensor - The tensor to add a dimension to
   * @returns The tensor with an additional dimension
   */
  abstract unsqueeze(tensor: TensorType): TensorType;

  /**
   * Remove a dimension from the tensor at axis 0.
   *
   * @param tensor - The tensor to remove a dimension from
   * @returns The tensor with one less dimension
   */
  abstract squeeze(tensor: TensorType): TensorType;

  /**
   * Convert the tensor to a list.
   *
   * @param tensor - The tensor to convert to a list
   * @returns The tensor as a list
   */
  abstract toList(tensor: TensorType): any[];

  /**
   * Return the only element of the tensor.
   *
   * @param tensor - The tensor to return the only element of
   * @returns The only element of the tensor
   */
  abstract toScalar(tensor: TensorType): any;

  /**
   * Create a tensor with the same shape as the input tensor filled
   * with a scalar value.
   *
   * ATTENTION: This method receives a torch tensor regardless of the
   * library used.
   *
   * @param tensor - The tensor to create a new tensor with the same shape
   * @param fillValue - The value to fill the new tensor with
   * @returns A tensor with the same shape as the input tensor filled with the
   *          specified value
   */
  abstract fullLike(tensor: TorchTensor, fillValue: any): TensorType;

  /**
   * Create a tensor from a JavaScript array
   *
   * @param array - The JavaScript array to convert
   * @returns A tensor
   */
  abstract fromArray(array: number[]): TensorType;

  /**
   * Concatenate a list of tensors along axis 0.
   *
   * ATTENTION: This method can either receive a list of torch tensors or
   * a list of tensors from the library used.
   *
   * @param tensors - The list of tensors to concatenate
   * @returns The concatenated tensor
   */
  abstract concatenate(tensors: (TorchTensor | TensorType)[]): TensorType;

  /**
   * Get the name of the tensor's device.
   *
   * @param tensor - The tensor to get the device of
   * @returns The name of the tensor's device
   */
  abstract getDevice(tensor: TensorType): string;

  /**
   * Move the tensor to a specified device.
   *
   * @param tensor - The tensor to move to a specified device
   * @param device - The name of the device to move the tensor to
   * @returns The tensor moved to the specified device
   */
  abstract toDevice(tensor: TensorType, device: string): TensorType;

  /**
   * Create a boolean ones tensor with the same shape as the input tensor.
   *
   * @param tensor - The tensor to create a boolean ones tensor with the same shape
   * @returns A boolean ones tensor with the same shape as the input tensor
   */
  abstract booleanOnesLike(tensor: TensorType): TensorType;

  /**
   * Fill the elements of the tensor where the mask is True with the
   * specified value.
   *
   * @param tensor - The tensor to fill
   * @param mask - The mask to apply to the tensor
   * @param value - The value to fill the tensor with
   * @returns The tensor with the mask applied
   */
  abstract applyMask(
    tensor: TensorType,
    mask: TensorType,
    value: any
  ): TensorType;

  /**
   * Return the indices that would sort the tensor in descending order
   * along axis -1.
   *
   * @param tensor - The tensor to sort
   * @returns The indices that would sort the tensor in descending order along
   *          axis -1
   */
  abstract argsortDescending(tensor: TensorType): TensorType;
}
