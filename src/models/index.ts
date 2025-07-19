// src/models/index.ts

// import OpenAI from 'openai';
import { Transformers } from './transformers';

/**
 * Module that contains all the models integrated in outlines-js.
 *
 * We group the models in submodules by provider instead of theme (completion, chat
 * completion, diffusers, etc.) and use routing functions everywhere else in the
 * codebase.
 */

// Re-exporting from base.ts (assuming it's in the same models directory)
// IMPORTANT: Added AsyncModel here
export { Model, AsyncModel } from './base';

// Re-exporting from individual model files.
// Each of these files (e.g., anthropic.ts, gemini.ts) will need to be created
// and contain the respective class and function exports.
// export { Anthropic, fromAnthropic } from './anthropic';
// export { Dottxt, fromDottxt } from './dottxt';
// export { Gemini, fromGemini } from './gemini';
// export { LlamaCpp, fromLlamaCpp } from './llamacpp';
// export { MLXLM, fromMLXLM } from './mlxlm';
// export { Ollama, fromOllama } from './ollama';
// export { OpenAI, fromOpenAI } from './openai';
// export { AsyncSGLang, SGLang, fromSGLang } from './sglang';
// export { AsyncTGI, TGI, fromTGI } from './tgi';
export {
  Transformers,
  TransformerTokenizer,
  TransformersMultiModal,
  fromTransformers,
} from './transformers';
// export { VLLMOffline, fromVLLMOffline } from './vllm_offline';
// export { AsyncVLLM, VLLM, fromVLLM } from './vllm';

/**
 * Type alias for steerable models.
 * These models typically allow direct control over the generation process,
 * often via logits manipulation or FSMs.
 */
// export type SteerableModel = LlamaCpp | MLXLM | Transformers;
export type SteerableModel = Transformers;

/**
 * Type alias for "black-box" models.
 * These are typically API-based models where the generation process is opaque
 * and controlled by the provider.
 */
// export type BlackBoxModel =
//   | Anthropic
//   | Dottxt
//   | Gemini
//   | Ollama
//   | OpenAI
//   | SGLang
//   | TGI
//   | VLLM
//   | VLLMOffline;
// export type BlackBoxModel = OpenAI;

/**
 * Type alias for asynchronous "black-box" models.
 * These are the asynchronous variants of the API-based models.
 */
// export type AsyncBlackBoxModel = AsyncTGI | AsyncSGLang | AsyncVLLM;
