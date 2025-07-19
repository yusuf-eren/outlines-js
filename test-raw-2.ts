// json-logits-processor.ts
//
// A corrected, self-contained, single-file proof-of-concept for implementing
// Outlines-style JSON-constrained generation using `transformers.js`.
//
// Author: Gemini (Corrected Version 2)
// Date: July 14, 2025
//
// This version FIXES the type signature of the `_call` method in JsonLogitsProcessor
// to correctly match the interface required by `@huggingface/transformers`.

import {
  AutoTokenizer,
  AutoModelForCausalLM,
  LogitsProcessor,
  PreTrainedTokenizer,
  Tensor,
} from '@huggingface/transformers';

// =================================================================================================
// STEP 1: JSON Schema to Regex Converter (Unchanged)
// =================================================================================================

function buildRegexFromJsonSchema(schema: any, definitions: any = {}): string {
  if (schema.$ref) {
    const refName = schema.$ref.replace('#/$defs/', '');
    return buildRegexFromJsonSchema(definitions[refName] || {}, definitions);
  }

  const type = schema.type;
  switch (type) {
    case 'string':
      return '"([^"\\\\]|\\\\.)*"';
    case 'number':
    case 'integer':
      return '[-+]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)';
    case 'boolean':
      return '(true|false)';
    case 'null':
      return 'null';
    case 'object':
      let properties = schema.properties || {};
      let required = schema.required || [];
      let propRegexes: string[] = [];

      // A more robust way to handle object properties in any order
      const optionalKeys = Object.keys(properties).filter(
        (k) => !required.includes(k)
      );

      const requiredRegexes = required.map((key) => {
        const valueRegex = buildRegexFromJsonSchema(
          properties[key],
          schema.$defs || definitions
        );
        return `"${key}"\\s*:\\s*${valueRegex}`;
      });

      const optionalRegexes = optionalKeys.map((key) => {
        const valueRegex = buildRegexFromJsonSchema(
          properties[key],
          schema.$defs || definitions
        );
        return `"${key}"\\s*:\\s*${valueRegex}`;
      });

      // This is still a simplification. True "any order" requires more complex lookaheads
      // or a different FSM generation approach. This joins them with optional commas.
      const allProps = [
        ...requiredRegexes,
        ...optionalRegexes.map((r) => `(?:\\s*,\\s*${r})?`),
      ];

      return `\\{\\s*${allProps.join('')}\\s*\\}`;

    case 'array':
      const itemSchema = schema.items || {};
      const itemRegex = buildRegexFromJsonSchema(
        itemSchema,
        schema.$defs || definitions
      );
      return `\\[\\s*(?:${itemRegex}(?:\\s*,\\s*${itemRegex})*)?\\s*\\]`;

    default:
      // Allows for flexibility with anyOf, etc. by returning a generic pattern.
      return '.*';
  }
}

// =================================================================================================
// STEP 2: The FSM Simulator (Unchanged)
// =================================================================================================
class RegexFsmSimulator {
  private readonly schemaRegex: RegExp;
  private tokenizer: PreTrainedTokenizer;
  private tokenValidationCache: Map<string, boolean[]> = new Map();

  constructor(schema: object, tokenizer: PreTrainedTokenizer) {
    const regexString = buildRegexFromJsonSchema(schema, (schema as any).$defs);
    this.schemaRegex = new RegExp(`^${regexString}`);
    this.tokenizer = tokenizer;
  }

  public getAllowedTokenIds(currentText: string): boolean[] {
    const cacheKey = currentText;
    if (this.tokenValidationCache.has(cacheKey)) {
      return this.tokenValidationCache.get(cacheKey)!;
    }

    const vocabSize = this.tokenizer.vocab.length;
    const allowedTokenMask = new Array(vocabSize).fill(false);

    // This is a simplified FSM simulation. It checks which tokens can be appended
    // while keeping the string as a valid prefix of the target regex.
    for (const [tokenStr, tokenId] of Object.entries(this.tokenizer.vocab)) {
      const potentialNext = currentText + tokenStr;
      const prefixRegex = new RegExp(
        '^' + potentialNext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      );

      // Test if the path is "alive" by checking if our generated prefix can be found
      // at the beginning of any string matched by the full regex.
      if (this.schemaRegex.source.match(prefixRegex)) {
        allowedTokenMask[tokenId] = true;
      }
    }

    // Always allow the EOS token if the current text is a complete, valid match.
    const fullMatchRegex = new RegExp(`^${this.schemaRegex.source.slice(1)}$`); // remove leading ^
    if (fullMatchRegex.test(currentText)) {
      allowedTokenMask[this.tokenizer.eos_token_id] = true;
    }

    this.tokenValidationCache.set(cacheKey, allowedTokenMask);
    return allowedTokenMask;
  }
}

// =================================================================================================
// STEP 3: THE CUSTOM LOGITS PROCESSOR (CORRECTED)
//
// The signature of `_call` now correctly matches the base class.
// The logic is adapted to handle `bigint[][]` for `input_ids`.
// =================================================================================================
class JsonLogitsProcessor extends LogitsProcessor {
  private fsmSimulator: RegexFsmSimulator;
  private tokenizer: PreTrainedTokenizer;

  constructor(schema: object, tokenizer: PreTrainedTokenizer) {
    super();
    this.tokenizer = tokenizer;
    this.fsmSimulator = new RegexFsmSimulator(schema, tokenizer);
  }

  // CORRECTED: The method signature now matches the `LogitsProcessor` interface.
  // - `input_ids` is `bigint[][]`
  // - `logits` is the correct parameter name
  // - The method should return the modified `logits` tensor
  _call(input_ids: bigint[][], logits: Tensor): Tensor {
    // Assume a batch size of 1 for simplicity.
    const sequence_ids = input_ids[0];

    // The tokenizer expects `number[]`, not `bigint[]`, so we must convert.
    const sequence_ids_as_numbers = Array.from(sequence_ids, (big) =>
      Number(big)
    );

    const decodedSoFar = this.tokenizer.decode(sequence_ids_as_numbers, {
      skipSpecialTokens: true,
    });

    const allowedTokenMask = this.fsmSimulator.getAllowedTokenIds(decodedSoFar);

    // Modify the logits tensor in-place for efficiency.
    const logitsData = logits.data as Float32Array;
    for (let tokenId = 0; tokenId < logitsData.length; ++tokenId) {
      if (!allowedTokenMask[tokenId]) {
        logitsData[tokenId] = -Infinity;
      }
    }

    return logits; // Return the modified tensor.
  }
}

// =================================================================================================
// STEP 4: EXAMPLE USAGE (Unchanged)
// =================================================================================================

async function main() {
  console.log('Starting JSON constrained generation demo...');

  const userSchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'integer' },
    },
    required: ['name', 'age'],
  };

  console.log('Loading model and tokenizer...');
  const modelName = 'Xenova/distilgpt2';
  const tokenizer = await AutoTokenizer.from_pretrained(modelName);
  const model = await AutoModelForCausalLM.from_pretrained(modelName);
  console.log('Model and tokenizer loaded.');

  if (tokenizer.pad_token === null) {
    tokenizer.pad_token = tokenizer.eos_token;
  }

  const jsonProcessor = new JsonLogitsProcessor(userSchema, tokenizer);

  const prompt = 'User profile:';

  console.log('\nPrompt:', prompt);
  console.log('\nRunning generation with constraints...');
  console.log('Target Schema:', JSON.stringify(userSchema, null, 2));

  const outputs = await model.generate(
    tokenizer(prompt, { return_tensors: 'pt' }).input_ids,
    {
      max_new_tokens: 60,
      logits_processor: [jsonProcessor],
      pad_token_id: tokenizer.pad_token_id,
      do_sample: true,
      temperature: 0.7,
      top_k: 20,
    }
  );

  const result = tokenizer.decode(outputs[0], { skipSpecialTokens: true });

  console.log('\n--- Generation Complete ---');
  console.log('Full Output:', result);

  const generatedPart = result.substring(prompt.length).trim();

  try {
    const jsonMatch = generatedPart.match(/\{.*\}/s);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('\nSuccessfully parsed JSON object:', parsed);
    } else {
      console.error('\nCould not find a valid JSON object in the output.');
    }
  } catch (e) {
    console.error('\nFailed to parse generated JSON:', e);
  }
}

main().catch(console.error);
