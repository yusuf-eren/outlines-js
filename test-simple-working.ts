import { AutoTokenizer, AutoModelForCausalLM } from '@huggingface/transformers';
import { jsonSchema, number, string } from './src';

// Simple working version following gemini-2.ts pattern
function template(userInput: string): string {
  return (
    '<|im_start|>system\n' +
    'You are a helpful assistant.<|im_end|>\n' +
    `<|im_start|>user\n${userInput}<|im_end|>\n` +
    '<|im_start|>assistant\n'
  );
}

const modelName = 'HuggingFaceTB/SmolLM2-135M-Instruct';

// Simple logits processor that constrains to JSON tokens
class SimpleJsonProcessor {
  private allowedTokens: Set<number>;
  private vocabulary: string[];
  
  constructor(tokenizer: any) {
    this.vocabulary = tokenizer.model?.vocab || [];
    this.allowedTokens = new Set();
    this.updateAllowedTokens();
    
    console.log(`Simple JSON processor allows ${this.allowedTokens.size} tokens`);
  }
  
  private updateAllowedTokens() {
    // Be much more restrictive - only allow tokens that are actually useful for JSON
    const coreJsonTokens = [
      '{', '}', ':', ',', '"'
    ];
    
    // Specific tokens for our exact schema
    const exactSchemaTokens = [
      'name', 'age',  // exact field names
      '"name"', '"age"', // quoted field names if they exist as single tokens
    ];
    
    // Numbers (but be restrictive)
    const numberTokens = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    
    // Very limited set of common name characters and short words
    const limitedNameTokens = [
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      'John', 'Jane', 'Alice', 'Bob', 'Mary', 'Mike', 'Sarah', 'Tom'  // common names
    ];
    
    const allTargetTokens = [...coreJsonTokens, ...exactSchemaTokens, ...numberTokens, ...limitedNameTokens];
    
    // Only allow exact matches or very close matches
    for (let i = 0; i < this.vocabulary.length; i++) {
      const token = this.vocabulary[i];
      if (token && typeof token === 'string') {
        const cleanToken = token.trim();
        
        // Exact matches for core JSON tokens
        if (coreJsonTokens.includes(cleanToken)) {
          this.allowedTokens.add(i);
          continue;
        }
        
        // Exact matches for schema tokens
        if (exactSchemaTokens.includes(cleanToken)) {
          this.allowedTokens.add(i);
          continue;
        }
        
        // Single digit numbers
        if (numberTokens.includes(cleanToken)) {
          this.allowedTokens.add(i);
          continue;
        }
        
        // Two digit numbers (for ages)
        if (/^[0-9]{1,2}$/.test(cleanToken)) {
          this.allowedTokens.add(i);
          continue;
        }
        
        // Tokens that contain quotes and our field names
        if ((token.includes('"name"') || token.includes('"age"'))) {
          this.allowedTokens.add(i);
          continue;
        }
        
        // Single letters for building names
        if (/^[a-zA-Z]$/.test(cleanToken)) {
          this.allowedTokens.add(i);
          continue;
        }
        
        // Short common words (length 2-6) that might be names
        if (/^[a-zA-Z]{2,6}$/.test(cleanToken)) {
          this.allowedTokens.add(i);
          continue;
        }
        
        // Whitespace tokens (but be specific)
        if (cleanToken === ' ' || cleanToken === '\n' || cleanToken === '\t') {
          this.allowedTokens.add(i);
          continue;
        }
      }
    }
  }
  
  processLogits(inputTokens: number[], logits: Float32Array): Float32Array {
    const result = new Float32Array(logits.length);
    result.fill(-Infinity);
    
    // Get current context to make smarter decisions
    const currentText = this.getCurrentText(inputTokens);
    
    // Boost specific tokens based on context
    for (const tokenId of this.allowedTokens) {
      if (tokenId < logits.length) {
        let boost = 0;
        const token = this.vocabulary[tokenId] || '';
        
        // Context-aware boosting - much more precise
        if (currentText.length === 0) {
          // Start with opening brace
          if (token === '{') boost = 50;
          else boost = -20;
        } else if (currentText === '{') {
          // After {, we want exactly "name"
          if (token === '"') boost = 40; // Quote to start field name
          else boost = -15;
        } else if (currentText === '{"') {
          // After {", we want 'name'
          if (token === 'name') boost = 50;
          else boost = -15;
        } else if (currentText === '{"name') {
          // After {"name, we want closing quote
          if (token === '"') boost = 50;
          else boost = -15;
        } else if (currentText === '{"name"') {
          // After {"name", we want colon
          if (token === ':') boost = 50;
          else boost = -15;
        } else if (currentText === '{"name":') {
          // After {"name":, we want opening quote for value
          if (token === '"') boost = 40;
          else boost = -15;
        } else if (currentText.startsWith('{"name":"') && !currentText.includes('",')) {
          // We're building the name value
          if (/^[a-zA-Z]/.test(token)) boost = 30; // Letters for name
          if (token === '"' && currentText.length > 9) boost = 40; // Closing quote
          else if (token === '"') boost = -10; // Don't close too early
        } else if (currentText.match(/\{"name":"[^"]+"\s*$/) && !currentText.includes(',')) {
          // After name value is properly closed, we want comma
          if (token === ',') boost = 50;
          else boost = -15;
        } else if (currentText.includes(',') && !currentText.includes('"age"')) {
          // After comma, we want "age"
          if (token === '"') boost = 40; // Quote to start age field
          else boost = -15;
        } else if (currentText.includes(',"') && !currentText.includes('age')) {
          // After ,", we want 'age'
          if (token === 'age') boost = 50;
          else boost = -15;
        } else if (currentText.includes(',"age') && !currentText.includes(',"age"')) {
          // After ,"age, we want closing quote
          if (token === '"') boost = 50;
          else boost = -15;
        } else if (currentText.includes(',"age"') && !currentText.includes(',"age":')) {
          // After ,"age", we want colon
          if (token === ':') boost = 50;
          else boost = -15;
        } else if (currentText.includes(',"age":') && !currentText.includes('}')) {
          // After ,"age":, we want a number
          if (/^\d+$/.test(token)) boost = 40;
          if (token === '}' && /\d$/.test(currentText)) boost = 50; // Close with }
          else boost = -15;
        }
        
        result[tokenId] = logits[tokenId] + boost;
      }
    }
    
    return result;
  }
  
  private getCurrentText(inputTokens: number[]): string {
    // Convert all tokens to text first
    const fullText = inputTokens.map(id => this.vocabulary[id] || '').join('');
    
    // Find the assistant marker - handle different newline encodings
    const assistantMarkers = [
      '<|im_start|>assistant\n',
      '<|im_start|>assistantĊ',  // Encoded newline
      '<|im_start|>assistant',   // Without newline
    ];
    
    let assistantIndex = -1;
    let usedMarker = '';
    
    for (const marker of assistantMarkers) {
      assistantIndex = fullText.lastIndexOf(marker);
      if (assistantIndex !== -1) {
        usedMarker = marker;
        break;
      }
    }
    
    if (assistantIndex === -1) {
      return '';
    }
    
    // Extract everything after the assistant marker
    const assistantText = fullText.slice(assistantIndex + usedMarker.length);
    
    return assistantText.trim();
  }
}

async function main() {
  const tokenizer = await AutoTokenizer.from_pretrained(modelName);
  const model = await AutoModelForCausalLM.from_pretrained(modelName);
  
  let inputText = template('Give me a person with a name and an age.');
  const maxTokens = 50;
  
  const processor = new SimpleJsonProcessor(tokenizer);
  
  console.log('Starting generation...');
  console.log('Initial prompt:', inputText);
  
  for (let i = 0; i < maxTokens; i++) {
    // Tokenize current input
    const input = await tokenizer(inputText);
    
    // Call model directly (following gemini-2.ts pattern)
    const output = await model(input);
    
    const logits = output.logits;
    const [_, seqLen, vocabSize] = logits.dims;
    const flat = logits.data;
    
    // Get last token logits
    let lastLogits = flat.slice((seqLen - 1) * vocabSize, seqLen * vocabSize);
    
    // Apply JSON constraints
    const constrainedLogits = processor.processLogits(
      Array.from(input.input_ids.data), 
      lastLogits
    );
    
    // Simple greedy sampling
    let nextTokenId = 0;
    let maxLogit = -Infinity;
    for (let j = 0; j < constrainedLogits.length; j++) {
      if (constrainedLogits[j] > maxLogit) {
        maxLogit = constrainedLogits[j];
        nextTokenId = j;
      }
    }
    
    // Decode the token
    const nextToken = tokenizer.decode([nextTokenId], { skip_special_tokens: false });
    
    // Add to input
    inputText += nextToken;
    
    // Show current output
    const assistantPart = inputText.split('<|im_start|>assistant\n')[1] || '';
    console.log(`Step ${i + 1}: Generated "${nextToken}" -> Current: "${assistantPart}"`);
    
    // Check for EOS
    if (nextTokenId === tokenizer.eos_token_id) {
      console.log('EOS token generated, stopping.');
      break;
    }
    
    // Basic JSON completion check
    if (assistantPart.includes('}') && assistantPart.includes('"name"') && assistantPart.includes('"age"')) {
      console.log('JSON appears complete, stopping.');
      break;
    }
  }
  
  // Extract final result
  const finalOutput = inputText.split('<|im_start|>assistant\n')[1] || '';
  console.log('\n=== FINAL RESULT ===');
  console.log(finalOutput);
}

main().catch(console.error); 