import { AutoModelForCausalLM } from '@huggingface/transformers';
import { fromTransformers, jsonSchema, number, string } from './src';
import { AutoTokenizer } from '@huggingface/transformers';

function template(user_input: string): string {
  return (
    '<|im_start|>system\n' +
    'You are a helpful assistant.<|im_end|>\n' +
    `<|im_start|>user\n${user_input}<|im_end|>\n` +
    '<|im_start|>assistant\n'
  );
}

const schema = jsonSchema({
  name: string,
  age: number,
});

console.log(schema);

const modelName = 'HuggingFaceTB/SmolLM2-135M-Instruct';

async function main() {
  const hfModel = await AutoModelForCausalLM.from_pretrained(modelName);
  const hfTokenizer = await AutoTokenizer.from_pretrained(modelName);
  const prompt = template('Give me a person with a name and an age.');

  // Add the missing device property to match our interface
  const modelWithDevice = {
    ...hfModel,
    device: 'cpu', // Default device for HuggingFace transformers.js
  };

  const model = fromTransformers(hfModel, hfTokenizer as any);

  // Generate more tokens to get a complete JSON object using model.call()
  const output = await model.call(prompt, schema, {
    max_new_tokens: 50,
    do_sample: false, // Use greedy decoding for consistent results
    temperature: 0.1,
  });
  console.log('output----', output);
}

main();
