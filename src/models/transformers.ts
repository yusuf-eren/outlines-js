/**
 * Integration with the `transformers` library.
 */

import { Model, ModelTypeAdapter } from './base';
import { Tokenizer, TokenizerEncodingResult } from './tokenizer';
import { OutlinesLogitsProcessor } from '../processors/index';
import {
  Tensor,
  PreTrainedTokenizer,
  LogitsProcessorList,
  PreTrainedModel,
} from '@huggingface/transformers';

// // Type definitions for transformers library types
// export interface PreTrainedTokenizer {
//   eos_token_id: number | null;
//   eos_token: string | null;
//   pad_token_id: number | null;
//   pad_token: string | null;
//   all_special_tokens: string[];
//   padding_side: string;
//   model?: {
//     vocab: string[];
//     config?: any;
//   };
//   encode(text: string | string[], options?: any): any;
//   decode(token_ids: any, options?: any): string[];
//   batch_decode(token_ids: any, options?: any): string[];
//   (prompt: string | string[], ...args: any[]): any;
// }

export interface ProcessorMixin {
  tokenizer: PreTrainedTokenizer;
  padding_side: string;
  pad_token: string;
  model?: {
    vocab: string[];
    config?: any;
  };
  (input: any, options?: any): any;
}

export interface TorchTensor {
  to(device: any): TorchTensor;
  squeeze(dim?: number): TorchTensor;
  size(dim: number): number;
  view(...dims: number[]): TorchTensor;
  shape: number[];
  dims: number[]; // HuggingFace tensors use dims instead of shape
}

export interface TorchLongTensor extends TorchTensor {}

// Tokenizer type classes for Llama variants
interface LlamaTokenizerType {
  new (...args: any[]): any;
}

/**
 * Get all the Llama tokenizer types/classes that need work-arounds.
 * When they can't be imported, a dummy class is created.
 */
function getLlamaTokenizerTypes(): LlamaTokenizerType[] {
  const dummyTypes: LlamaTokenizerType[] = [];

  try {
    // In a real implementation, these would be imported from transformers
    // For now, we'll create dummy classes
    class LlamaTokenizer {}
    class LlamaTokenizerFast {}
    class CodeLlamaTokenizer {}
    class CodeLlamaTokenizerFast {}

    dummyTypes.push(
      LlamaTokenizer as any,
      LlamaTokenizerFast as any,
      CodeLlamaTokenizer as any,
      CodeLlamaTokenizerFast as any
    );
  } catch (error) {
    // If imports fail, return empty array
    console.warn('Could not import Llama tokenizer types:', error);
  }

  return dummyTypes;
}

/**
 * Represents a tokenizer for models in the `transformers` library.
 */
export class TransformerTokenizer implements Tokenizer {
  public readonly eosToken: string;
  public readonly eosTokenId: number;
  public readonly padTokenId: number;
  public readonly vocabulary: Record<string, number>;
  public readonly specialTokens: Set<string>;
  public readonly padToken: string;

  private tokenizer: PreTrainedTokenizer;
  private isLlama: boolean;
  private modelName?: string;
  private kwargs?: any;

  constructor(tokenizer: PreTrainedTokenizer, kwargs?: any) {
    this.tokenizer = tokenizer;
    this.eosTokenId = tokenizer.eos_token_id;
    this.eosToken = tokenizer.eos_token;

    if (
      tokenizer.pad_token_id === null ||
      tokenizer.pad_token_id === undefined
    ) {
      tokenizer.pad_token_id = tokenizer.eos_token_id;
      this.padTokenId = this.eosTokenId;
    } else {
      this.padTokenId = tokenizer.pad_token_id;
      this.padToken = tokenizer.pad_token;
    }

    this.specialTokens = new Set(tokenizer.special_tokens || []);

    // Use tokenizer.model.config.vocab if it exists, otherwise use the vocabulary array
    // tokenizer.model.vocab is a string[] where each index is the token_id and the value is the token string.
    // Convert to a vocabulary object mapping: { token_string: token_id }
    this.vocabulary =
      tokenizer.model?.config?.vocab ||
      this.#getVocabulary(tokenizer.model.vocab);

    const llamaTypes = getLlamaTokenizerTypes();
    this.isLlama = llamaTypes.some((type) => tokenizer instanceof type);

    if (kwargs) {
      this.kwargs = kwargs;
    }
  }

  /**
   * Convert vocabulary array to object mapping.
   * Input: vocab array where vocab[token_id] = token_string
   * Output: object where { token_string: token_id }
   */
  #getVocabulary(vocabArray: string[]): Record<string, number> {
    const vocabulary: Record<string, number> = {};

    for (let tokenId = 0; tokenId < vocabArray.length; tokenId++) {
      const tokenString = vocabArray[tokenId];
      if (tokenString !== undefined && tokenString !== null) {
        vocabulary[tokenString] = tokenId;
      }
    }

    return vocabulary;
  }

  async encode(
    prompt: string | string[],
    options: Record<string, any> = {}
  ): Promise<[Tensor, Tensor]> {
    options = {
      padding: true,
      return_tensors: 'pt',
      ...options,
    };

    const output = await this.tokenizer(prompt, options);
    console.log('---MASK VE INPUT IDS');
    return [output.input_ids, output.attention_mask];
  }

  async decode(tokenIds: any): Promise<string[]> {
    console.log('---tokenIds', tokenIds);
    const text = this.tokenizer.batch_decode([tokenIds], {
      skip_special_tokens: true,
    });
    return text;
  }

  convertTokenToString(token: string): string {
    const string = Array.isArray(token) ? token.join(' ') : String(token);

    if (this.isLlama) {
      if (token.startsWith('_') || token == '<0x20>') {
        return ' ' + string;
      }
    }

    return string;
  }

  /**
   * Get token string by token ID using the original vocab array.
   */
  getTokenById(tokenId: number): string | undefined {
    return this.tokenizer.model?.vocab[tokenId];
  }
}

/**
 * Type adapter for the `Transformers` model.
 */
export class TransformersTypeAdapter implements ModelTypeAdapter {
  /**
   * Generate the prompt argument to pass to the model.
   */
  formatInput(modelInput: unknown): string | string[] {
    if (typeof modelInput === 'string') {
      return this.formatStrInput(modelInput);
    } else if (
      Array.isArray(modelInput) &&
      modelInput.every((item) => typeof item === 'string')
    ) {
      return this.formatListInput(modelInput as string[]);
    } else {
      throw new Error(
        `The input type ${typeof modelInput} is not available. Please use a string or a list of strings.`
      );
    }
  }

  private formatStrInput(modelInput: string): string {
    return modelInput;
  }

  private formatListInput(modelInput: string[]): string[] {
    return modelInput;
  }

  /**
   * Generate the logits processor argument to pass to the model.
   */
  formatOutputType(
    outputType?: OutlinesLogitsProcessor
  ): LogitsProcessorList | null {
    if (outputType) {
      const wrappedProcessor = async (
        input_ids: bigint[][],
        logits: Tensor
      ): Promise<Tensor> => {
        return await outputType.__call__(input_ids, logits);
      };

      const processorList = new LogitsProcessorList();
      processorList.push(wrappedProcessor as any);

      return processorList;
    }
    return null;
  }
}

/**
 * Thin wrapper around a `transformers` model and a `transformers` tokenizer.
 *
 * This wrapper is used to convert the input and output types specified by the
 * users at a higher level to arguments to the `transformers` model and tokenizer.
 */
export class Transformers extends Model {
  public model: PreTrainedModel;
  public transformerTokenizer: PreTrainedTokenizer;
  public tokenizer: TransformerTokenizer;
  public typeAdapter: ModelTypeAdapter;

  public tensorLibraryName: 'torch' | 'jax' | 'tensorflow' = 'torch';

  constructor(model: PreTrainedModel, tokenizer: PreTrainedTokenizer) {
    super();

    tokenizer.padding_side = 'left';

    this.model = model;
    this.transformerTokenizer = tokenizer;
    this.tokenizer = new TransformerTokenizer(tokenizer);
    this.typeAdapter = new TransformersTypeAdapter();

    // HuggingFace transformers.js uses ONNX Runtime tensors, not PyTorch
    // For now, we'll use tensorflow as it's more compatible with JavaScript arrays
    this.tensorLibraryName = 'tensorflow';
    // TODO: review here. self note
  }

  /**
   * Turn the user input into arguments to pass to the model
   */
  async #prepareModelInputs(
    modelInput: string | string[] | Record<string, any>,
    outputType?: OutlinesLogitsProcessor
  ): Promise<[any, { input_ids: Tensor; attention_mask: Tensor }]> {
    const prompts = this.typeAdapter.formatInput(modelInput);
    const [inputIds, attentionMask] = await this.tokenizer.encode(prompts);

    const inputs = {
      input_ids: inputIds,
      attention_mask: attentionMask,
    };

    return [prompts, inputs];
  }

  /**
   * Generate text using `transformers`.
   */
  async generate(
    modelInput: string | string[] | Record<string, any>,
    outputType?: OutlinesLogitsProcessor,
    ...inferenceKwargs: any[]
  ): Promise<string | string[]> {
    const [prompts, inputs] = await this.#prepareModelInputs(
      modelInput,
      outputType
    );
    const logitsProcessor = this.typeAdapter.formatOutputType(outputType);

    console.log(
      '---inputs',
      inputs.attention_mask.ort_tensor.dims,
      inputs.input_ids.ort_tensor.dims
    );
    let generatedIds = await this.#generateOutputSeq({
      prompts,
      inputs,
      logitsProcessor,
      inferenceKwargs,
    });

    console.log('_pirompt', prompts);
    if (typeof prompts === 'string') {
      generatedIds = generatedIds.squeeze(0);
    }
    return this.decodeGeneration(generatedIds);
  }

  /**
   * Not available for `transformers` models.
   * TODO: implement following completion of https://github.com/huggingface/transformers/issues/30810
   */
  generateStream(
    modelInput: any,
    outputType: any,
    ...inferenceKwargs: any[]
  ): never {
    throw new Error('Streaming is not implemented for Transformers models.');
  }

  async #generateOutputSeq({
    prompts,
    inputs,
    logitsProcessor,
    inferenceKwargs,
  }: {
    prompts: string | string[];
    inputs: { input_ids: Tensor; attention_mask: Tensor };
    logitsProcessor: LogitsProcessorList;
    inferenceKwargs?: Record<string, any>;
  }): Promise<TorchTensor> {
    const inputIds = inputs.input_ids;
    const outputIds = await this.model.generate({
      ...inputs,
      logits_processor: logitsProcessor,
      generation_config: {
        max_new_tokens: 100,
      },
    });

    console.log(
      '---outputIds from model.generate:',
      outputIds,
      inferenceKwargs,
      prompts,
      inputs.attention_mask
    );

    let generatedIds = outputIds;
    console.log('squeeze brah', generatedIds.squeeze(0));
    if (!this.model.config.is_encoder_decoder) {
      const promptLen = inputs.input_ids.dims[1];
      console.log('---inputsD', inputs.input_ids, outputIds.data, promptLen);
      generatedIds = new Tensor('int64', outputIds.data.slice(promptLen), [
        outputIds.data.slice(promptLen).length,
      ]);
    }

    // INSERT_YOUR_CODE
    const numSamples = inferenceKwargs?.[0]?.num_return_sequences || 1;
    // TODO: FIX THIS. GENERATED IDS IS NOT A TENSOR.
    // if (
    //   numSamples > 1 &&
    //   Array.isArray(prompts) &&
    //   inputs.input_ids &&
    //   inputs.input_ids.dims &&
    //   typeof generatedIds.view === 'function'
    // ) {
    //   const batchSize = inputs.input_ids.dims[0];
    //   generatedIds = generatedIds.view(batchSize, numSamples, -1);
    // }

    return generatedIds;

    // Handle encoder-decoder vs decoder-only models like the original
    // encoder-decoder returns output_ids only, decoder-only returns full seq ids
    // let generatedIds;
    // if (this.model.config.is_encoder_decoder) {
    //   generatedIds = outputIds;
    // } else {
    //   // Need to be tested. self note.
    //   const inputLength = Array.isArray(inputIds)
    //     ? inputIds[0].dims[1]
    //     : inputIds.dims[1];
    //   // This would need proper tensor slicing in practice
    //   generatedIds = outputIds; // Simplified for now
    // }

    // const numSamples = inferenceKwargs?.['num_return_sequences'] ?? 1;

    // console.log('----numSamples', numSamples);

    // // TODO: TEST FROM HERE. AI GENERATED CODE.
    // if (numSamples > 1 && Array.isArray(prompts)) {
    //   // Try to get batch size from inputIds
    //   let batchSize: number;
    //   if (inputIds && inputIds.dims && inputIds.dims.length > 0) {
    //     batchSize = inputIds.dims[0];
    //   } else if (Array.isArray(inputIds) && inputIds[0]?.dims) {
    //     batchSize = inputIds[0].dims[0];
    //   } else {
    //     batchSize = prompts.length;
    //   }
    //   // Reshape generatedIds to [batch_size, numSamples, -1]
    //   if (generatedIds && generatedIds.dims && generatedIds.dims.length === 2) {
    //     // Only reshape if dims are [batch_size * numSamples, seqLen]
    //     const [flatBatch, seqLen] = generatedIds.dims;
    //     if (flatBatch === batchSize * numSamples) {
    //       generatedIds = generatedIds.view([batchSize, numSamples, seqLen]);
    //     }
    //   }
    // }

    // return generatedIds;
  }

  private getHuggingFaceTensorShape(tensor: any): number[] {
    if (tensor && tensor.ort_tensor && tensor.ort_tensor.dims) {
      return Array.from(tensor.ort_tensor.dims);
    } else if (tensor && tensor.dims) {
      return Array.from(tensor.dims);
    } else if (tensor && tensor.shape) {
      return Array.from(tensor.shape);
    } else if (Array.isArray(tensor)) {
      if (Array.isArray(tensor[0])) {
        return [tensor.length, tensor[0].length];
      } else {
        return [tensor.length];
      }
    } else {
      return [1];
    }
  }

  private sampleFromLogits(logits: any): number {
    // Extract logits data
    let logitsData: number[];
    if (logits && logits.ort_tensor && logits.ort_tensor.cpuData) {
      logitsData = Array.from(logits.ort_tensor.cpuData);
    } else if (logits && logits.data) {
      logitsData = Array.from(logits.data);
    } else if (Array.isArray(logits)) {
      logitsData = logits;
    } else {
      throw new Error('Cannot extract logits data for sampling');
    }

    // Get the shape to determine vocab size
    const shape = this.getHuggingFaceTensorShape(logits);
    const vocabSize = shape[shape.length - 1];

    // For batched logits, take the last sequence's logits
    const lastSeqLogits =
      shape.length === 2 ? logitsData.slice(-vocabSize) : logitsData;

    // Find the token with the highest probability (argmax)
    let maxIndex = 0;
    let maxValue = lastSeqLogits[0];
    for (let i = 1; i < lastSeqLogits.length; i++) {
      if (lastSeqLogits[i] > maxValue) {
        maxValue = lastSeqLogits[i];
        maxIndex = i;
      }
    }

    return maxIndex;
  }

  private appendToken(tensor: any, tokenId: number): any {
    // Extract current token IDs
    const currentTokenIds = Array.from(
      tensor.ort_tensor?.cpuData || tensor.data || []
    ).map((id: any) => Number(id));

    // Append the new token
    const newTokenIds = [...currentTokenIds, tokenId];

    // Create a new BigInt64Array for the updated input_ids
    const newCpuData = new BigInt64Array(newTokenIds.map((x) => BigInt(x)));
    const newDims = [1, newCpuData.length];

    // Create a new Tensor object
    return new Tensor('int64', newCpuData, newDims);
  }

  private decodeGeneration(generatedIds: TorchTensor): string | string[] {
    // Extract token IDs from the tensor
    let tokenIds: number[];

    if (
      generatedIds &&
      typeof generatedIds === 'object' &&
      'ort_tensor' in generatedIds
    ) {
      const ortTensor = (generatedIds as any).ort_tensor;
      tokenIds = Array.from(ortTensor.cpuData).map((x) => Number(x));
    } else if (
      generatedIds &&
      typeof generatedIds === 'object' &&
      'data' in generatedIds
    ) {
      tokenIds = Array.from((generatedIds as any).data).map((x) => Number(x));
    } else if (Array.isArray(generatedIds)) {
      tokenIds = generatedIds;
    } else {
      tokenIds = [generatedIds as any];
    }

    console.log('---Decoding token IDs:', tokenIds);

    // Use the tokenizer's decode method
    try {
      const decoded = this.tokenizer.decode(tokenIds);
      return Array.isArray(decoded) ? decoded[0] : decoded;
    } catch (error) {
      console.warn('Decode failed:', error);
      // Fallback: try to get token strings manually
      const tokens = tokenIds.map(
        (id) => this.tokenizer.getTokenById(id) || `<unk_${id}>`
      );
      return tokens.join('');
    }
  }
}

/**
 * Type adapter for `TransformersMultiModal` model.
 */
export class TransformersMultiModalTypeAdapter implements ModelTypeAdapter {
  /**
   * Generate the prompt arguments to pass to the model.
   */
  formatInput(modelInput: unknown): Record<string, any> {
    if (
      typeof modelInput === 'object' &&
      modelInput !== null &&
      !Array.isArray(modelInput)
    ) {
      return this.formatDictInput(modelInput as Record<string, any>);
    } else {
      throw new Error(
        `The input type ${typeof modelInput} is not available. Please provide a ` +
          "dictionary containing at least the 'text' key with a value " +
          'of type Union[str, List[str]]. You should also include the ' +
          "other keys required by your processor (for instance, 'images' " +
          "or 'audios'). " +
          'Make sure that the text is correctly formatted for the model ' +
          '(e.g. include <image> or <|AUDIO|> tags) and that the number ' +
          'of text tags match the number of additional assets provided.'
      );
    }
  }

  private formatDictInput(
    modelInput: Record<string, any>
  ): Record<string, any> {
    if (!('text' in modelInput)) {
      throw new Error(
        "The input must contain the 'text' key along with the other " +
          'keys required by your processor.'
      );
    }
    return modelInput;
  }

  /**
   * Generate the logits processor argument to pass to the model.
   */
  formatOutputType(
    outputType?: OutlinesLogitsProcessor
  ): LogitsProcessorList | null {
    if (outputType) {
      const wrappedProcessor = async (
        input_ids: bigint[][],
        logits: Tensor
      ): Promise<Tensor> => {
        return await outputType.__call__(input_ids, logits);
      };

      const processorList = new LogitsProcessorList();
      processorList.push(wrappedProcessor as any);

      return processorList;

      // In practice, this would import LogitsProcessorList from transformers
      // const logitsProcessorList = new LogitsProcessorList();
      // const boundCall = outputType.__call__.bind(outputType);
      // logitsProcessorList.processors.push(boundCall);
      // return logitsProcessorList;
    }
    return null;
  }
}

/**
 * Thin wrapper around a `transformers` model and a `transformers` processor.
 *
 * This wrapper is used to convert the input and output types specified by the
 * users at a higher level to arguments to the `transformers` model and processor.
 */
export class TransformersMultiModal extends Transformers {
  public processor: ProcessorMixin;

  constructor(model: PreTrainedModel, processor: ProcessorMixin) {
    const tokenizer = processor.tokenizer;
    super(model, tokenizer);

    this.processor = processor;
    this.processor.padding_side = 'left';
    this.processor.pad_token = '[PAD]';

    this.typeAdapter = new TransformersMultiModalTypeAdapter();
  }

  /**
   * Turn the user input into arguments to pass to the model
   */
  async #prepareModelInputs(
    modelInput: string | string[] | Record<string, any>,
    outputType?: OutlinesLogitsProcessor
  ): Promise<[string | string[], Record<string, any>]> {
    const formattedInput = this.typeAdapter.formatInput(modelInput) as Record<
      string,
      any
    >;
    const inputs = await this.processor({
      ...formattedInput,
      padding: true,
      return_tensors: 'pt',
    });
    // Note: Device movement is not needed in transformers.js like in PyTorch

    return [formattedInput.text, inputs];
  }
}

/**
 * Create an Outlines `Transformers` or `TransformersMultiModal` model
 * instance from a `PreTrainedModel` instance and a `PreTrainedTokenizer` or
 * `ProcessorMixin` instance.
 */
export function fromTransformers(
  model: PreTrainedModel,
  tokenizerOrProcessor: PreTrainedTokenizer | ProcessorMixin
): Transformers | TransformersMultiModal {
  // Type checking - in practice, you'd import these from transformers
  (tokenizerOrProcessor as any)['tokenizer'] = (tokenizerOrProcessor as any)[
    'tokenize'
  ];
  const isTokenizer = 'model' in tokenizerOrProcessor;
  const isProcessor = 'tokenize' in tokenizerOrProcessor;

  if (isTokenizer) {
    (tokenizerOrProcessor as any)['tokenizer'] = (tokenizerOrProcessor as any)[
      'tokenize'
    ];
    const tokenizer = tokenizerOrProcessor as PreTrainedTokenizer;
    return new Transformers(model, tokenizer);
  } else if (isProcessor) {
    const processor = tokenizerOrProcessor as ProcessorMixin;
    return new TransformersMultiModal(model, processor);
  } else {
    throw new Error(
      'We could determine whether the model passed to `fromTransformers` ' +
        'is a text-2-text or a multi-modal model. Please provide a ' +
        'a transformers tokenizer or processor.'
    );
  }
}
