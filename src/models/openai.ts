// src/models/openai.ts

// Current imports from your `my ts` snippet
import { ModelTypeAdapter, AsyncModel, Model } from './base'; // Adjusted to include AsyncModel
import {
  OpenAI as OpenAIClient,
  AzureOpenAI as AzureOpenAIClient,
} from 'openai';
import {
  APIError,
  APIConnectionTimeoutError,
  RateLimitError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  PermissionDeniedError,
  NotFoundError,
  UnprocessableEntityError,
} from 'openai/error';
import { Regex, CFG, JsonSchema } from '../types/dsl';
import { isZodBaseModel } from '../types/utils';

// Placeholder for outlines.templates.Vision
export interface Vision {
  prompt: string;
  image_format: string; // e.g., 'image/jpeg'
  image_str: string; // Base64 encoded image string
}

// Placeholder for pydantic's BaseModel. In a real scenario, you'd use a TS schema library.
// We're simulating the static `model_json_schema` method.
export class BaseModel {
  static model_json_schema(): Record<string, any> {
    // console.warn("BaseModel.model_json_schema() is a placeholder.");
    return {}; // Placeholder for generating JSON schema from Pydantic model
  }
}

// Placeholder for TypeAdapter (similar to pydantic's TypeAdapter for dataclasses/TypedDicts).
// This is a complex area for direct Python-to-TypeScript mapping.
class TypeAdapter {
  constructor(private type: any) {}
  json_schema(): Record<string, any> {
    // console.warn("TypeAdapter.json_schema() is a placeholder.");
    return {};
  }
}

// Placeholder for dataclasses.asdict and dataclasses.replace.
// In TypeScript, these are usually handled by object spread syntax.
function asdict(obj: any): Record<string, any> {
  return { ...obj };
}

function replace<T extends Record<string, any>>(
  obj: T,
  replacements: Partial<T>
): T {
  return { ...obj, ...replacements };
}

// Placeholder for outlines.caching.cache
// This requires a decorator implementation. For now, it's a no-op decorator.
function cache(): MethodDecorator {
  return function (
    _target: any,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    // No-op cache decorator for now.
    return descriptor;
  };
}

function isGensonSchemaBuilder(obj: any): boolean {
  // Check for the expected method name.
  return obj && typeof obj.toJson === 'function';
}

function isNativeDict(obj: any): boolean {
  // In TypeScript/JavaScript, a native dict is a plain object.
  return obj && typeof obj === 'object' && obj.constructor === Object;
}

// Placeholder for outlines.v0_legacy.base.vectorize
// This is highly Python-specific (numpy, functools.partial).
// Its functionality (applying a function to each element of an array)
// would need to be re-implemented manually or with a JS numerical library (e.g., ndarray, math.js).
// For simplicity, `generateChat` will not be vectorized for now.
// const vectorize = <T extends (...args: any[]) => any>(fn: T, signature: string) => {
//   // This is a complex placeholder. Actual vectorization needs a separate implementation.
//   return fn;
// };

// Placeholder for error_handler decorator/function.
// We'll make it a simple function that wraps the async call and re-throws specific errors.
function errorHandler<T extends (...args: any[]) => Promise<any>>(
  apiCallFn: T
): T {
  return (async (...args: any[]): Promise<any> => {
    try {
      return await apiCallFn(...args);
    } catch (e: any) {
      if (e instanceof BadRequestError) {
        if (e.message && e.message.startsWith('Invalid schema')) {
          throw new TypeError(
            `OpenAI does not support your schema: ${e.message}. ` +
              'Try a local model or dottxt instead.'
          );
        } else {
          throw e;
        }
      } else if (
        e instanceof APIConnectionTimeoutError ||
        e instanceof APIError ||
        e instanceof RateLimitError
      ) {
        throw new Error(`Could not connect to the OpenAI API: ${e.message}`);
      } else if (
        e instanceof AuthenticationError ||
        e instanceof ConflictError ||
        e instanceof PermissionDeniedError ||
        e instanceof NotFoundError ||
        e instanceof UnprocessableEntityError
      ) {
        throw e; // Re-throw specific OpenAI client errors directly
      } else {
        throw e; // Re-throw any other unexpected errors
      }
    }
  }) as T;
}

// --- End of Placeholders ---

/**
 * Type adapter for the `OpenAI` model.
 *
 * `OpenAITypeAdapter` is responsible for preparing the arguments to OpenAI's
 * `completions.create` methods: the input (prompt and possibly image), as
 * well as the output type (only JSON).
 */
export class OpenAITypeAdapter implements ModelTypeAdapter {
  public formatInput(modelInput: string | Vision): Record<string, any> {
    /**
     * Generate the `messages` argument to pass to the client.
     *
     * @param modelInput The input provided by the user.
     * @returns The formatted input to be passed to the client.
     */
    if (typeof modelInput === 'string') {
      return this.formatStrModelInput(modelInput);
    } else if (this.isVision(modelInput)) {
      return this.formatVisionModelInput(modelInput);
    }
    throw new TypeError(
      `The input type ${typeof modelInput} is not available with OpenAI. ` +
        'The only available types are `string` and `Vision`.'
    );
  }

  // Type guard to check if an object conforms to the Vision interface
  private isVision(input: any): input is Vision {
    return (
      typeof input === 'object' &&
      input !== null &&
      'prompt' in input &&
      'image_format' in input &&
      'image_str' in input
    );
  }

  private formatStrModelInput(modelInput: string): Record<string, any> {
    /**
     * Generate the `messages` argument to pass to the client when the user
     * only passes a prompt.
     */
    return {
      messages: [
        {
          role: 'user',
          content: modelInput,
        },
      ],
    };
  }

  private formatVisionModelInput(modelInput: Vision): Record<string, any> {
    /**
     * Generate the `messages` argument to pass to the client when the user
     * passes a prompt and an image.
     */
    return {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: modelInput.prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${modelInput.image_format};base64,${modelInput.image_str}`,
              },
            },
          ],
        },
      ],
    };
  }

  public formatOutputType(outputType?: any): Record<string, any> {
    /**
     * Generate the `response_format` argument to the client based on the
     * output type specified by the user.
     *
     * @param outputType The output type provided by the user.
     * @returns The formatted output type to be passed to the client.
     */
    // Unsupported languages
    if (outputType instanceof Regex) {
      throw new TypeError(
        `Neither regex-based structured outputs nor the \`pattern\` keyword in Json Schema are available with OpenAI. Use an open source model or dottxt instead.`
      );
    } else if (outputType instanceof CFG) {
      throw new TypeError(
        `ÏCFG-based structured outputs are not available with OpenAI. Use an open source model or dottxt instead.`
      );
    }

    if (outputType === undefined || outputType === null) {
      return {};
    } else if (isNativeDict(outputType)) {
      return this.formatJsonModeType();
    } else if (isZodBaseModel(outputType)) {
      return this.formatJsonOutputType(outputType.jsonSchema());
    } else if (outputType instanceof JsonSchema) {
      return this.formatJsonOutputType(JSON.parse(outputType.schema));
    } else {
      const typeName =
        typeof outputType === 'function' ? outputType.name : String(outputType);
      throw new TypeError(
        `The type \`${typeName}\` is not available with OpenAI. ` +
          'Use an open source model or dottxt instead.'
      );
    }
  }

  private formatJsonOutputType(
    schema: Record<string, any>
  ): Record<string, any> {
    /**
     * Generate the `response_format` argument to the client when the user
     * specified a `Json` output type.
     */
    // OpenAI requires `additionalProperties` to be set
    if (!('additionalProperties' in schema)) {
      schema['additionalProperties'] = false;
    }

    return {
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'default',
          strict: true,
          schema: schema,
        },
      },
    };
  }

  private formatJsonModeType(): Record<string, any> {
    /**
     * Generate the `response_format` argument to the client when the user
     * specified the output type should be a JSON but without specifying the
     * schema (also called "JSON mode").
     */
    return { response_format: { type: 'json_object' } };
  }
}

/**
 * Represents the parameters of the OpenAI API.
 * Corresponds to Python's `OpenAIConfig` dataclass.
 */
export interface OpenAIConfig {
  readonly model?: string;
  readonly frequency_penalty?: number;
  readonly logit_bias?: Record<number, number>;
  readonly max_tokens?: number | null;
  readonly n?: number;
  readonly presence_penalty?: number;
  readonly response_format?: Record<string, string> | null;
  readonly seed?: number | null;
  readonly stop?: string | string[] | null;
  readonly temperature?: number;
  readonly top_p?: number;
  readonly user?: string;
}

// This class handles the deprecated legacy behavior from Outlines v0
export class OpenAILegacy {
  public client: OpenAIClient | AzureOpenAIClient;
  public config: OpenAIConfig;
  public systemPrompt: string | undefined | null;
  public promptTokens: number = 0;
  public completionTokens: number = 0;
  private formatSequence: (x: any) => any;

  constructor(
    client: OpenAIClient | AzureOpenAIClient,
    config: OpenAIConfig,
    systemPrompt: string | null = null
  ) {
    this.client = client;
    this.config = config;
    this.systemPrompt = systemPrompt;
    this.formatSequence = (x) => x; // Equivalent to Python's lambda x: x
  }

  // Simplified generateChat, without vectorize or numpy, for legacy mode.
  // This would need a full re-implementation for robust parallel processing.
  // @errorHandler
  // @cache() // Applying cache decorator from placeholder
  private async generateChat(
    prompt: string | string[],
    systemPrompt: string | null | undefined,
    client: OpenAIClient | AzureOpenAIClient,
    config: OpenAIConfig
  ): Promise<[any, number, number]> {
    const systemMessage = systemPrompt
      ? [{ role: 'system', content: systemPrompt }]
      : [];
    const userMessage = [
      { role: 'user', content: Array.isArray(prompt) ? prompt[0] : prompt },
    ]; // Taking first prompt if array

    // Simulate API call for legacy behavior
    // In a real scenario, this would call `client.chat.completions.create`
    // with the adapted messages and config.
    const responses = await client.chat.completions.create({
      messages: [...systemMessage, ...userMessage],
      ...asdict(config), // Using placeholder asdict
      // OpenAI client has a `model` property, ensure it's set if not in config
      model: config.model || 'gpt-3.5-turbo', // Fallback model for type safety
    });

    const results = responses.choices.map(
      (choice: any) => choice.message?.content
    );
    const usage = responses.usage;

    const promptTokens = usage?.prompt_tokens || 0;
    const completionTokens = usage?.completion_tokens || 0;

    // The original Python `generate_chat` returned `numpy.array`.
    // We return a simple array or string.
    return [
      results.length === 1 ? results[0] : results,
      promptTokens,
      completionTokens,
    ];
  }

  public async generate(
    prompt: string | string[],
    maxTokens?: number | null,
    stopAt?: string | string[] | null,
    options?: {
      systemPrompt?: string | null;
      temperature?: number | null;
      samples?: number | null;
    }
  ): Promise<any> {
    const effectiveMaxTokens = maxTokens ?? this.config.max_tokens;
    const effectiveStopAt = stopAt ?? this.config.stop;
    const effectiveTemperature =
      options?.temperature ?? this.config.temperature;
    const effectiveSamples = options?.samples ?? this.config.n;
    const effectiveSystemPrompt = options?.systemPrompt ?? this.systemPrompt;

    const newConfig: OpenAIConfig = replace(this.config, {
      max_tokens: effectiveMaxTokens,
      temperature: effectiveTemperature,
      n: effectiveSamples,
      stop: effectiveStopAt,
    });

    const [response, promptTokens, completionTokens] = await this.generateChat(
      prompt,
      effectiveSystemPrompt,
      this.client,
      newConfig
    );
    this.promptTokens += promptTokens;
    this.completionTokens += completionTokens;

    return this.formatSequence(response);
  }

  public stream(...args: any[]): AsyncIterable<any> {
    throw new Error(
      'Streaming is currently not supported for the OpenAI API in legacy mode'
    );
  }

  // This method's logic assumes it's called from the main `OpenAI` instance
  public newWithReplacements(
    modelInstance: OpenAI,
    kwargs: Record<string, any>
  ): OpenAI {
    if (!modelInstance.legacyInstance) {
      throw new Error(
        'Cannot call newWithReplacements on a non-legacy OpenAI instance.'
      );
    }
    const newConfig: OpenAIConfig = replace(
      modelInstance.legacyInstance.config,
      kwargs
    );
    const newLegacyInstance = new OpenAILegacy(
      modelInstance.legacyInstance.client,
      newConfig,
      modelInstance.legacyInstance.systemPrompt
    );
    // Create a new main OpenAI instance, effectively replacing its legacy part
    // We pass the new legacy config's model name to the new OpenAI instance constructor if available,
    // otherwise just null or a default.
    const newMainOpenAI = new OpenAI(
      newLegacyInstance.client,
      newLegacyInstance.config.model || null
    );
    newMainOpenAI.legacyInstance = newLegacyInstance; // Assign the newly created legacy instance
    return newMainOpenAI;
  }

  public toString(): string {
    return this.constructor.name + ' API';
  }

  public toJSON(): string {
    return JSON.stringify(this.config);
  }
}

/**
 * Thin wrapper around the `openai.OpenAI` client.
 *
 * This wrapper is used to convert the input and output types specified by the
 * users at a higher level to arguments to the `openai.OpenAI` client.
 */
export class OpenAI extends Model {
  public legacyInstance?: OpenAILegacy; // Optional, only set in legacy mode
  public client!: OpenAIClient | AzureOpenAIClient; // Will be initialized in constructor
  public modelName?: string | OpenAIConfig | null; // Model name or legacy config
  public typeAdapter!: OpenAITypeAdapter; // Will be initialized in constructor

  constructor(
    // The `client` argument can be the actual OpenAI client or, in legacy, an OpenAILegacy instance itself.
    client: OpenAIClient | AzureOpenAIClient | OpenAILegacy,
    modelName: string | OpenAIConfig | null = null,
    // `systemPrompt` is from Python's `kwargs.get("system_prompt")`
    systemPrompt: string | null = null
    // The original Python has `**kwargs`. For a clean TypeScript API,
    // it's better to explicitly define expected parameters or use a single options object.
    // However, for direct conversion mimicking the Python, `..._kwargs: any[]`
    // catches extra arguments but doesn't easily map them to named parameters.
    // For this case, it seems `system_prompt` was the only relevant kwarg in Python's __init__.
  ) {
    super(); // Call the constructor of AsyncModel

    const isClientLegacyInstance = client instanceof OpenAILegacy;
    const isModelNameConfig = modelName instanceof OpenAIConfig;

    // Determine if we are in legacy mode
    if (isClientLegacyInstance || isModelNameConfig || systemPrompt !== null) {
      console.warn(
        `
The direct instantiation of 'OpenAI' model with an 'OpenAIConfig'
or legacy arguments is deprecated starting from v1.0.0.
Please use 'fromOpenAI(client, "model-name")' instead.
Support for this will be removed in v1.1.0.
For example:
\`\`\`typescript
import { OpenAI as OpenAIClient } from 'openai';
import { fromOpenAI } from 'outlines-js/models/openai';
const client = new OpenAIClient();
const model = fromOpenAI(client, "gpt-4o");
\`\`\`
        `,
        DeprecationWarning // Assuming DeprecationWarning exists globally or imported
      );

      let config: OpenAIConfig;
      let actualClient: OpenAIClient | AzureOpenAIClient;

      if (isClientLegacyInstance) {
        // If client itself is an OpenAILegacy instance (this can happen from `new_with_replacements`)
        this.legacyInstance = client;
        actualClient = this.legacyInstance.client;
        config = this.legacyInstance.config; // Take config from legacy instance
        modelName = this.legacyInstance.config.model || null; // Update modelName based on legacy config
      } else {
        actualClient = client as OpenAIClient | AzureOpenAIClient;
        if (isModelNameConfig) {
          config = modelName as OpenAIConfig;
        } else {
          // If no config object, create a default one (mimics dataclass field defaults)
          config = {
            model: (modelName as string) || '',
            frequency_penalty: 0,
            logit_bias: {},
            n: 1,
            presence_penalty: 0,
            temperature: 1.0,
            top_p: 1,
            user: '',
          };
        }
        this.legacyInstance = new OpenAILegacy(
          actualClient,
          config,
          systemPrompt
        );
      }

      this.client = actualClient; // Set the actual client derived
      this.modelName = modelName;
      this.typeAdapter = new OpenAITypeAdapter(); // Still need the type adapter for legacy
    } else {
      // Regular mode (recommended usage)
      this.client = client as OpenAIClient | AzureOpenAIClient;
      this.modelName = modelName as string | null;
      this.typeAdapter = new OpenAITypeAdapter();
    }
  }

  public async generate(
    modelInput: string | Vision,
    outputType?: any, // Can be type of BaseModel, string, etc.
    inferenceKwargs: Record<string, any> = {}
  ): Promise<string | string[] | null> {
    /**
     * Generate text using OpenAI.
     */
    if (this.legacyInstance) {
      // If in legacy mode, delegate to legacy instance's generate
      // The signature for legacy generate is slightly different (named args vs **kwargs).
      const {
        max_tokens,
        stop, // In legacy, it's `stop_at`
        temperature,
        n, // In legacy, it's `samples`
        system_prompt, // In legacy, it's `systemPrompt` option
        ...restKwargs // Catch any other extra kwargs
      } = inferenceKwargs;

      return this.legacyInstance.generate(
        modelInput as string | string[], // Legacy expects string or list of strings
        max_tokens,
        stop,
        { systemPrompt: system_prompt, temperature, samples: n }
      );
    }

    const messages = this.typeAdapter.formatInput(modelInput);
    const responseFormat = this.typeAdapter.formatOutputType(outputType);

    if (
      !('model' in inferenceKwargs) &&
      this.modelName !== undefined &&
      this.modelName !== null
    ) {
      inferenceKwargs['model'] = this.modelName;
    }

    try {
      const result = await this.client.chat.completions.create({
        ...messages,
        ...responseFormat,
        ...inferenceKwargs,
      });

      const contents: (string | null)[] = result.choices.map(
        (choice: any) => choice.message?.content
      );

      // Check for refusal (assuming message.refusal exists in OpenAI API response types)
      for (const choice of result.choices) {
        if (
          choice.message &&
          (choice.message as any).refusal !== undefined &&
          (choice.message as any).refusal !== null
        ) {
          throw new Error(
            `OpenAI refused to answer the request: ${
              (choice.message as any).refusal
            }`
          );
        }
      }

      if (contents.length === 1) {
        return contents[0];
      } else {
        return contents;
      }
    } catch (e: any) {
      // Re-apply error handling
      throw errorHandler(async () => {
        throw e;
      })(); // Call errorHandler with a function that re-throws
    }
  }

  public async generateStream(
    modelInput: string | Vision,
    outputType?: any,
    inferenceKwargs: Record<string, any> = {}
  ): Promise<AsyncIterable<string>> {
    /**
     * Stream text using OpenAI.
     */
    if (this.legacyInstance) {
      throw new Error('Streaming is not supported for OpenAI in legacy mode.');
    }

    const messages = this.typeAdapter.formatInput(modelInput);
    const responseFormat = this.typeAdapter.formatOutputType(outputType);

    if (
      !('model' in inferenceKwargs) &&
      this.modelName !== undefined &&
      this.modelName !== null
    ) {
      inferenceKwargs['model'] = this.modelName;
    }

    try {
      const stream = await this.client.chat.completions.create({
        stream: true,
        ...messages,
        ...responseFormat,
        ...inferenceKwargs,
      });

      // Async generator function to yield chunks
      async function* streamGenerator(): AsyncGenerator<string> {
        for await (const chunk of stream) {
          if (
            chunk.choices &&
            chunk.choices[0] &&
            chunk.choices[0].delta.content !== undefined &&
            chunk.choices[0].delta.content !== null
          ) {
            yield chunk.choices[0].delta.content;
          }
        }
      }
      return streamGenerator();
    } catch (e: any) {
      throw errorHandler(async () => {
        throw e;
      })();
    }
  }

  // --- Legacy method overrides for the main OpenAI class ---
  // These delegate to the legacyInstance if it exists, otherwise call super methods.

  public async call(
    modelInput: any,
    outputType?: any,
    inferenceKwargs: Record<string, any> = {}
  ): Promise<any> {
    if (this.legacyInstance) {
      // Map generic call arguments to legacy generate's specific arguments
      const {
        max_tokens,
        stop_at,
        system_prompt,
        temperature,
        samples,
        ...rest
      } = inferenceKwargs;
      return await this.legacyInstance.generate(
        modelInput,
        max_tokens,
        stop_at,
        { systemPrompt: system_prompt, temperature, samples }
      );
    } else {
      // Call the `call` method of AsyncModel, which in turn uses our `generate`
      return await super.call(modelInput, outputType, inferenceKwargs);
    }
  }

  public async *stream(
    modelInput: any,
    outputType?: any,
    inferenceKwargs: Record<string, any> = {}
  ): AsyncIterable<any> {
    if (this.legacyInstance) {
      throw new Error('Streaming is not supported for OpenAI in legacy mode.');
    } else {
      // Call the `stream` method of AsyncModel, which in turn uses our `generateStream`
      const result = await super.stream(
        modelInput,
        outputType,
        inferenceKwargs
      );
      for await (const chunk of result) {
        yield chunk;
      }
    }
  }

  public newWithReplacements(kwargs: Record<string, any>): OpenAI {
    if (this.legacyInstance) {
      // The `model` parameter here refers to the `OpenAI` instance itself,
      // which `OpenAILegacy.newWithReplacements` expects as its first argument.
      return this.legacyInstance.newWithReplacements(this, kwargs);
    }
    throw new Error('This method is only available in legacy mode');
  }

  public toString(): string {
    if (this.legacyInstance) {
      return this.legacyInstance.toString();
    }
    return super.toString();
  }

  // Python's __repr__ is often for developer-friendly string representation.
  // In TS, we often use `toString()` or a dedicated `toRepresentationString()`.
  // If `repr` is truly needed to match Python's `str(self.config)`, then use `JSON.stringify`.
  // I'll keep the `toJSON` method for `repr` equivalence if needed for debugging.
  public toJSON(): string {
    if (this.legacyInstance) {
      return this.legacyInstance.toJSON();
    }
    // Default JSON representation for non-legacy OpenAI
    return JSON.stringify({
      client: 'OpenAIClient', // Placeholder, actual client isn't serializable
      modelName: this.modelName,
      typeAdapter: 'OpenAITypeAdapter',
    });
  }
}

/**
 * Custom DeprecationWarning class for consistency, similar to Python's.
 */
class DeprecationWarning extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeprecationWarning';
    Object.setPrototypeOf(this, DeprecationWarning.prototype);
  }
}

/**
 * Create an Outlines `OpenAI` model instance from an `openai.OpenAI`
 * client.
 *
 * @param client An `openai.OpenAI` client instance.
 * @param modelName The name of the model to use.
 * @returns An Outlines `OpenAI` model instance.
 */
export function fromOpenAI(
  client: OpenAIClient | AzureOpenAIClient,
  modelName: string | null = null
): OpenAI {
  return new OpenAI(client, modelName);
}
