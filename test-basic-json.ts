import { jsonSchema, number, string } from './src';
import { toRegex } from './src/types/dsl';

// Test our JSON schema conversion is working
const schema = jsonSchema({
  name: string,
  age: number,
});

console.log('Schema object:', schema);
console.log('Generated regex:', toRegex(schema));

// Test our tokenizer filtering  
import { AutoTokenizer } from '@huggingface/transformers';

async function testTokenFiltering() {
  const tokenizer = await AutoTokenizer.from_pretrained('HuggingFaceTB/SmolLM2-135M-Instruct');
  
  // Mock our filtering function
  const regexString = toRegex(schema);
  console.log('Regex string for filtering:', regexString);
  
  // Check if JSON pattern detection works
  const isJsonPattern = regexString.includes('\\{') || regexString.includes('"name"') || regexString.includes('"age"');
  console.log('Is JSON pattern detected:', isJsonPattern);
  
  if (isJsonPattern) {
    console.log('✅ JSON pattern detection working');
    
    // Test a few specific tokens that should be allowed
    const testTokens = ['{', '"', 'name', 'age', ':', ',', '}', '1', '2', '3'];
    const vocabulary = tokenizer.model?.vocab || [];
    
    console.log('Testing specific JSON tokens in vocabulary:');
    for (const testToken of testTokens) {
      const tokenIndex = vocabulary.indexOf(testToken);
      if (tokenIndex >= 0) {
        console.log(`  ✅ Token "${testToken}" found at index ${tokenIndex}`);
      } else {
        console.log(`  ❌ Token "${testToken}" not found as exact match`);
      }
    }
  }
}

testTokenFiltering().catch(console.error); 