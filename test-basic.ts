import { AutoModelForCausalLM } from '@huggingface/transformers';
import { Regex, fromTransformers, jsonSchema, number, string } from './src';
import { AutoTokenizer } from '@huggingface/transformers';
import { z, toJSONSchema } from 'zod';

function template(user_input: string): string {
  return (
    '<|im_start|>system\n' +
    'You are a helpful assistant.<|im_end|>\n' +
    `<|im_start|>user\n${user_input}<|im_end|>\n` +
    '<|im_start|>assistant\n'
  );
}

// const schema = jsonSchema({
//   name: string,
//   age: number,
// });

// console.log('---raw schema', schema);

// Zod equivelant
const zodSchema = z.object({
  name: z.string(),
  age: z.number().int().positive(),
});

console.log('---raw zodSchema', toJSONSchema(zodSchema));

const modelName = 'HuggingFaceTB/SmolLM2-135M-Instruct';

async function main() {
  const hfModel = await AutoModelForCausalLM.from_pretrained(modelName);
  const hfTokenizer = await AutoTokenizer.from_pretrained(modelName);
  const prompt = template('Give me a person with a name and an age.');

  // const q = hfTokenizer.batch_decode([
  //   [
  //     57, 5248, 22657, 327, 750, 9563, 28, 564, 347, 253, 5356, 11173, 28, 339,
  //     1326, 982, 457, 260, 2470, 288, 1538, 3834, 355, 6399, 30, 339, 5248,
  //     1535, 288, 4237, 351, 2385, 284, 12099, 1694, 30, 1094, 346, 737, 724,
  //     351, 2385, 355, 12099, 28, 1407, 1904, 288, 1998, 17, 2,
  //   ],
  // ]);

  // console.log('q', q);

  const model = fromTransformers(hfModel, hfTokenizer);

  // Generate more tokens to get a complete JSON object using model.call()
  const output = await model.call(prompt, null, {
    max_new_tokens: 10,
    do_sample: false, // Use greedy decoding for consistent results
    temperature: 0.1,
  });
  console.log('output----', output);
}

main();

import ndarray from 'ndarray';
import Int64 from 'node-int64';

const r = new Int64(0x123456789);
console.log(r);

function ndArrayTest() {
  const a = ndarray([1, 2, 3, 4, 0x7fffffffffffffff].map((x) => new Int64(x)));
  console.log('a', a);
  const b = a.pick(0, 1);
  console.log('b', b);
  const c = a.pick(1, 0);
  console.log('c', c);
  const d = a.pick(1, 1);
  console.log('d', d);
}

ndArrayTest();
