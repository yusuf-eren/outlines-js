/**
 * Tensor adapter for the `torch` library.
 */

import { torch } from 'js-pytorch';
import { TensorAdapter, TorchTensor } from './base';
import { Tensor } from '@huggingface/transformers';

// Type alias for js-pytorch Tensor
type JSTensor = InstanceType<typeof torch.Tensor>;

/**
 * Torch tensor adapter implementation.
 *
 * This adapter provides PyTorch-specific implementations for tensor
 * operations using the js-pytorch package.
 */
export class TorchTensorAdapter extends TensorAdapter<JSTensor> {
  /**
   * The name of the tensor library this adapter supports.
   */
  readonly libraryName = 'torch';

  /**
   * Get the shape of the tensor.
   *
   * @param tensor - The tensor to get the shape of
   * @returns The shape of the tensor as an array of numbers
   */
  shape(tensor: JSTensor): number[] {

    // Handle ONNX Runtime tensors with ort_tensor.dims
    if (tensor && typeof tensor === 'object' && 'ort_tensor' in tensor) {
      const ortTensor = (tensor as any).ort_tensor;
      if (ortTensor && 'dims' in ortTensor) {
        return Array.from(ortTensor.dims);
      }
    }

    // Calculate shape manually for JavaScript arrays
    if (Array.isArray(tensor)) {
      const shape: number[] = [];
      let current = tensor;

      while (Array.isArray(current)) {
        shape.push(current.length);
        current = current[0];
      }

      return shape;
    }

    // Fallback: try to access .shape if it exists
    if (tensor && typeof tensor === 'object' && 'shape' in tensor) {
      return Array.from(tensor.shape as number[]);
    }

    // If it's a scalar, return empty shape
    return [];
  }

  /**
   * Add a dimension to the tensor at axis 0.
   *
   * @param tensor - The tensor to add a dimension to
   * @returns The tensor with an additional dimension
   */
  unsqueeze(tensor: JSTensor): JSTensor {
    // js-pytorch doesn't have unsqueeze, implement using reshape
    const currentShape = this.shape(tensor);
    const newShape = [1, ...currentShape];
    return tensor.reshape(newShape);
  }

  /**
   * Remove a dimension from the tensor at axis 0.
   *
   * @param tensor - The tensor to remove a dimension from
   * @returns The tensor with one less dimension
   */
  squeeze(tensor: JSTensor): JSTensor {
    // js-pytorch doesn't have squeeze, implement using reshape
    const currentShape = this.shape(tensor);
    if (currentShape[0] === 1) {
      const newShape = currentShape.slice(1);
      return tensor.reshape(newShape);
    }
    return tensor; // No change if first dimension is not 1
  }

  /**
   * Convert the tensor to a list.
   *
   * @param tensor - The tensor to convert to a list
   * @returns The tensor as a nested array
   */
  toList(tensor: JSTensor): any[] {
    // Handle ONNX Runtime tensors
    if (tensor && typeof tensor === 'object' && 'ort_tensor' in tensor) {
      const ortTensor = (tensor as any).ort_tensor;
      if (ortTensor && 'cpuData' in ortTensor && 'dims' in ortTensor) {
        const data = Array.from(ortTensor.cpuData);
        const dims = ortTensor.dims;
        
        // Reshape flat array to nested array based on dimensions
        function reshapeArray(flatArray: any[], dimensions: number[]): any[] {
          if (dimensions.length === 1) {
            return flatArray.slice(0, dimensions[0]);
          }
          
          const result = [];
          const size = dimensions.slice(1).reduce((a, b) => a * b, 1);
          
          for (let i = 0; i < dimensions[0]; i++) {
            const start = i * size;
            const end = start + size;
            result.push(reshapeArray(flatArray.slice(start, end), dimensions.slice(1)));
          }
          
          return result;
        }
        
        return reshapeArray(data, dims);
      }
    }
    
    // Handle JavaScript arrays (already in list format)
    if (Array.isArray(tensor)) {
      return tensor;
    }
    
    // Fallback: try to call tolist if it exists
    if (tensor && typeof tensor === 'object' && 'tolist' in tensor) {
      return (tensor as any).tolist();
    }
    
    // If it's a scalar, wrap in array
    return [tensor];
  }

  /**
   * Return the only element of the tensor.
   *
   * @param tensor - The tensor to return the only element of
   * @returns The only element of the tensor
   */
  toScalar(tensor: JSTensor): any {
    // js-pytorch doesn't have item(), extract from data
    const data = tensor.tolist();
    if (Array.isArray(data)) {
      // Flatten nested arrays to get scalar
      let result = data;
      while (Array.isArray(result)) {
        result = result[0];
      }
      return result;
    }
    return data;
  }

  /**
   * Create a tensor with the same shape as the input tensor filled
   * with a scalar value.
   *
   * @param tensor - The tensor to create a new tensor with the same shape
   * @param fillValue - The value to fill the new tensor with
   * @returns A tensor with the same shape filled with the specified value
   */
  fullLike(tensor: TorchTensor, fillValue: any): JSTensor {
    // js-pytorch doesn't have full_like, implement using ones and multiplication
    const shape = this.shape(tensor as any);
    const size = shape.reduce((acc, dim) => acc * dim, 1);
    const data = new Array(size).fill(fillValue);
    return torch.tensor(data).reshape(shape);
  }

  /**
   * Create a tensor from a JavaScript array
   *
   * @param array - The JavaScript array to convert
   * @returns A JSTensor
   */
  fromArray(array: number[]): JSTensor {
    return torch.tensor(array);
  }

  /**
   * Concatenate a list of tensors along axis 0.
   *
   * @param tensors - The list of tensors to concatenate
   * @returns The concatenated tensor
   */
  concatenate(tensors: (TorchTensor | JSTensor)[]): JSTensor {
    // js-pytorch doesn't have cat, implement manually
    if (tensors.length === 0) {
      throw new Error('Cannot concatenate empty list of tensors');
    }

    // Convert all tensors to JS tensors
    const jsTensors = tensors.map((tensor) => {
      if (!tensor) {
        throw new Error('Cannot concatenate undefined tensor');
      }
      
      // Check if it's a HuggingFace tensor with ort_tensor
      if (typeof tensor === 'object' && 'ort_tensor' in tensor) {
        const ortTensor = (tensor as any).ort_tensor;
        const data = Array.from(ortTensor.cpuData);
        return torch.tensor(data).reshape(ortTensor.dims);
      }
      
      // Check if it's already a js-pytorch tensor
      if ('tolist' in tensor) {
        return tensor as JSTensor;
      } else {
        // Convert TorchTensor to JSTensor
        const data = Array.isArray(tensor) ? tensor : [tensor];
        if (data.length === 0 || data[0] === undefined) {
          throw new Error('Cannot create tensor from undefined data');
        }
        return torch.tensor(data).reshape(this.shape(tensor as any));
      }
    });

    // Get all data arrays and concatenate
    const allData: any[] = [];
    const firstShape = this.shape(jsTensors[0]);

    for (const tensor of jsTensors) {
      const data = tensor.tolist();
      if (Array.isArray(data)) {
        allData.push(...data);
      } else {
        allData.push(data);
      }
    }

    // Calculate new shape
    const newShape = [...firstShape];
    newShape[0] = jsTensors.length * firstShape[0];

    return torch.tensor(allData).reshape(newShape);
  }

  /**
   * Get the name of the tensor's device.
   *
   * @param tensor - The tensor to get the device of
   * @returns The name of the tensor's device
   */
  getDevice(tensor: JSTensor): string {
    return tensor.device || 'cpu';
  }

  /**
   * Move the tensor to a specified device.
   *
   * @param tensor - The tensor to move to a specified device
   * @param device - The name of the device to move the tensor to
   * @returns The tensor moved to the specified device
   */
  toDevice(tensor: JSTensor, device: string): JSTensor {
    // js-pytorch's to() method might mutate in place or return void
    // For now, just return the tensor as js-pytorch doesn't really support device movement
    return tensor;
  }

  /**
   * Create a boolean ones tensor with the same shape as the input tensor.
   *
   * @param tensor - The tensor to create a boolean ones tensor with the same shape
   * @returns A boolean ones tensor with the same shape as the input tensor
   */
  booleanOnesLike(tensor: JSTensor): JSTensor {
    // js-pytorch doesn't have ones_like, implement using ones
    // Use 1s instead of true since js-pytorch has trouble with boolean arrays
    const shape = this.shape(tensor);
    const size = shape.reduce((acc, dim) => acc * dim, 1);
    const data = new Array(size).fill(1); // Use 1 instead of true
    
    try {
      return torch.tensor(data).reshape(shape);
    } catch (error) {
      // Fallback: return a simple JavaScript array if torch fails
      console.warn('js-pytorch failed, falling back to JavaScript array:', error);
      
      // Create nested array structure manually
      function createNestedArray(dims: number[], fillValue: number): any {
        if (dims.length === 1) {
          return new Array(dims[0]).fill(fillValue);
        }
        const result = [];
        for (let i = 0; i < dims[0]; i++) {
          result.push(createNestedArray(dims.slice(1), fillValue));
        }
        return result;
      }
      
      return createNestedArray(shape, 1) as any;
    }
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
  applyMask(tensor: JSTensor, mask: JSTensor, value: any): JSTensor {
    // Implement manually since js-pytorch's masked_fill has issues
    const tensorData = this.toList(tensor);
    const maskData = this.toList(mask);

    // Apply mask manually
    const applyMaskToData = (tData: any, mData: any): any => {
      if (Array.isArray(tData) && Array.isArray(mData)) {
        return tData.map((item, i) => applyMaskToData(item, mData[i]));
      }
      return mData ? value : tData;
    };

    const maskedData = applyMaskToData(tensorData, maskData);

    // Check if this is an ONNX Runtime tensor (from transformers.js)
    if (tensor && typeof tensor === 'object' && 'ort_tensor' in tensor) {
      const ortTensor = (tensor as any).ort_tensor;
      const dims = ortTensor.dims;
      const flatData = maskedData.flat(dims.length - 1);
      
      console.log('---Processing ONNX tensor with dims:', dims);
      console.log('---Flat data length:', flatData.length);
      
      // Create a proper HuggingFace Tensor object with modified data
      // The Tensor constructor expects [DataType, DataArray, number[]]
      const newTensor = new Tensor(
        ortTensor.type,           // Keep original data type
        new Float32Array(flatData), // Convert to Float32Array
        dims                     // Keep original dimensions
      );
      
      console.log('---Created new HuggingFace Tensor');
      console.log('---New tensor has ort_tensor:', 'ort_tensor' in newTensor);
      console.log('---New tensor dims:', newTensor.dims);
      console.log('---New tensor data type:', typeof newTensor.data);
      console.log('---New tensor data length:', newTensor.data.length);
      
      return newTensor as any;
    }

    // Fallback for js-pytorch tensors
    return torch.tensor(maskedData) as any;
  }
  
  /**
   * Return the indices that would sort the tensor in descending order
   * along axis -1.
   *
   * @param tensor - The tensor to sort
   * @returns The indices that would sort the tensor in descending order along axis -1
   */
  argsortDescending(tensor: JSTensor): JSTensor {
    // js-pytorch doesn't have argsort, implement a basic version
    // This is a simplified implementation for 1D or 2D tensors
    const data = tensor.tolist();

    if (!Array.isArray(data)) {
      // Scalar case
      return torch.tensor([0]);
    }

    if (!Array.isArray(data[0])) {
      // 1D tensor
      const indices = Array.from({ length: data.length }, (_, i) => i);
      indices.sort((a, b) => (data as number[])[b] - (data as number[])[a]);
      return torch.tensor(indices);
    }

    // 2D tensor - sort each row
    const result: number[][] = [];
    for (const row of data as number[][]) {
      const indices = Array.from({ length: row.length }, (_, i) => i);
      indices.sort((a, b) => row[b] - row[a]);
      result.push(indices);
    }

    return torch.tensor(result);
  }
}
