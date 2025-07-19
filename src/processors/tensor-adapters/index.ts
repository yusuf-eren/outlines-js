import { TensorAdapter } from './base';
import { TorchTensorAdapter } from './torch';
import { TensorFlowTensorAdapter } from './tensorflow';
import { OutlinesLogitsProcessor } from '../base-logit-processor';

export {
  TensorAdapter,
  TorchTensorAdapter,
  TensorFlowTensorAdapter,
  OutlinesLogitsProcessor,
};

// Type for tensor adapter implementations
export type TensorAdapterImplementation = TensorAdapter<any>;

// Registry of tensor adapters by library name
export const tensorAdapters: Record<
  string,
  new () => TensorAdapterImplementation
> = {
  torch: TorchTensorAdapter,
  tensorflow: TensorFlowTensorAdapter,
};

/**
 * Get a tensor adapter class by library name.
 *
 * @param libraryName - The name of the tensor library
 * @returns The tensor adapter class or undefined if not found
 */
export function getTensorAdapter(
  libraryName: string
): (new () => TensorAdapterImplementation) | undefined {
  return tensorAdapters[libraryName];
}
