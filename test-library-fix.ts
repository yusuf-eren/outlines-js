import { AutoModelForCausalLM, AutoTokenizer } from '@huggingface/transformers';
import { fromTransformers } from './src/models/transformers';
import { JSONLogitsProcessor } from './src/processors/structured-processor';

function template(userInput: string): string {
  return (
    '<|im_start|>system\n' +
    'You are a helpful assistant.<|im_end|>\n' +
    `<|im_start|>user\n${userInput}<|im_end|>\n` +
    '<|im_start|>assistant\n'
  );
}

async function main() {
  try {
    console.log('=== TESTING OUTLINES LIBRARY ===');
    
    // Initialize model
    const modelName = 'HuggingFaceTB/SmolLM2-135M-Instruct';
    console.log('1. Loading model and tokenizer...');
    
    const hfModel = await AutoModelForCausalLM.from_pretrained(modelName);
    const hfTokenizer = await AutoTokenizer.from_pretrained(modelName);
    
    // Add missing properties to make the model compatible
    // (hfModel as any).device = 'cpu';
    
    console.log('2. Creating outlines model...');
    const model = fromTransformers(hfModel as any, hfTokenizer as any);
    
    console.log('3. Testing basic generation without constraints...');
    const basicPrompt = template('What is your name?');
    
    try {
      const basicResult = await model.generate(basicPrompt);
      console.log('✓ Basic generation works:', basicResult);
    } catch (error) {
      console.log('✗ Basic generation failed:', error.message);
      return;
    }
    
    console.log('4. Testing JSON schema constraint...');
    const jsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' }
      },
      required: ['name', 'age']
    };
    
    try {
      const processor = new JSONLogitsProcessor(
        jsonSchema,
        model.tokenizer,
        model.tensorLibraryName
      );
      console.log('✓ JSON processor created successfully');
      
      const jsonPrompt = template('Give me a person with a name and an age. Respond with JSON.');
      const jsonResult = await model.generate(jsonPrompt, processor);
      console.log('✓ JSON constrained generation works:', jsonResult);
      
    } catch (error) {
      console.log('✗ JSON constrained generation failed:', error.message);
      console.log('Stack trace:', error.stack);
    }
    
  } catch (error) {
    console.log('✗ Setup failed:', error.message);
    console.log('Stack trace:', error.stack);
  }
}

main()
  .then(() => {
    console.log('=== TEST COMPLETE ===');
    process.exit(0);
  })
  .catch((err) => {
    console.error('=== TEST FAILED ===');
    console.error(err);
    process.exit(1);
  }); 