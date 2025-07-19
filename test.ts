// Types and function imports (pseudo-code, assuming outlines-like interface exists)
import {
  PreTrainedTokenizer,
  fromTransformers,
} from './src/models/transformers';
import { Regex } from './src/types/dsl'; // Placeholder type
import { AutoModelForCausalLM, AutoTokenizer } from '@huggingface/transformers'; // Assume bindings exist

function template(userInput: string): string {
  return (
    '<|im_start|>system\n' +
    'You are a helpful assistant.<|im_end|>\n' +
    `<|im_start|>user\n${userInput}<|im_end|>\n` +
    '<|im_start|>assistant\n'
  );
}
async function main() {
  // Initialize model
  const hfModelName = 'HuggingFaceTB/SmolLM2-135M-Instruct';
  // console.log('--zooorr 1', hfModelName);
  const hfModel = await AutoModelForCausalLM.from_pretrained(hfModelName);
  // console.log('--zooorr 2', hfModel);
  const hfTokenizer = await AutoTokenizer.from_pretrained(hfModelName);
  (hfTokenizer as any)['get_vocab'] = () => {
    console.log('---hfTokenizer.model.vocab', hfTokenizer.model.vocab);
    return hfTokenizer.model.vocab;
  };

  // console.log('--zooorr 3', hfTokenizer);

  const model = fromTransformers(
    { generate: hfModel.generate, config: hfModel.config, device: 'cpu' },
    hfTokenizer as any
  );

  console.log('--zooorr 4', model);
  // Email regex pattern for extraction
  const emailRegex: Regex = new Regex(
    '[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,10}'
  );
  console.log('--zooorr 5', emailRegex);
  // Prompt template
  const emailPrompt = template(
    'Hi John,Thanks for reaching out. You can email me at erenyusuf170@gmail.com anytime.Best,Yusuf.'
  );

  // Run model with regex constraint
  const result = await model.call(emailPrompt, emailRegex);

  console.log('Result:', result);
  // Result: erenyusuf170@gmail.com
}
main()
  .then(() => {
    console.log('done');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
