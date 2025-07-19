import { GuideLogitsProcessor, RegexLogitsProcessor, JSONLogitsProcessor } from './src/processors/structured-processor';
import { Tokenizer } from './src/models/tokenizer';

// Mock tokenizer for testing
class MockTokenizer implements Tokenizer {
  readonly eosToken = '</s>';
  readonly eosTokenId = 2;
  readonly padTokenId = 0;
  readonly vocabulary: Record<string, number> = {
    '<pad>': 0,
    '<unk>': 1,
    '</s>': 2,
    'hello': 3,
    'world': 4,
    '{': 5,
    '}': 6,
    '"': 7,
    'name': 8,
    ':': 9,
    'John': 10,
    ',': 11,
    'age': 12,
    '25': 13
  };
  readonly specialTokens = new Set(['<pad>', '<unk>', '</s>']);

  async encode(prompt: string | string[], options?: Record<string, any>): Promise<[any, any]> {
    const tokens = prompt.toString().split(' ').map(token => this.vocabulary[token] || 1);
    return [tokens, tokens.map(() => 1)] as any;
  }

  async decode(tokenIds: any[] | any): Promise<string[]> {
    const ids = Array.isArray(tokenIds) ? tokenIds : [tokenIds];
    return ids.map(id => {
      for (const [token, tokenId] of Object.entries(this.vocabulary)) {
        if (tokenId === id) return token;
      }
      return '<unk>';
    });
  }

  convertTokenToString(token: string): string {
    return token;
  }
}

async function testProcessors() {
  console.log('Testing refactored processors...');
  
  const tokenizer = new MockTokenizer();
  
  try {
    // Test RegexLogitsProcessor
    console.log('Testing RegexLogitsProcessor...');
    const regexProcessor = new RegexLogitsProcessor(
      'hello world',
      tokenizer,
      'tensorflow'
    );
    console.log('✓ RegexLogitsProcessor created successfully');
    
    // Test JSONLogitsProcessor
    console.log('Testing JSONLogitsProcessor...');
    const jsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' }
      }
    };
    const jsonProcessor = new JSONLogitsProcessor(
      jsonSchema,
      tokenizer,
      'tensorflow'
    );
    console.log('✓ JSONLogitsProcessor created successfully');
    
    // Test GuideLogitsProcessor
    console.log('Testing GuideLogitsProcessor...');
    const guideProcessor = new GuideLogitsProcessor(
      tokenizer,
      regexProcessor as any,
      'tensorflow'
    );
    console.log('✓ GuideLogitsProcessor created successfully');
    
    console.log('All processors created successfully!');
    
  } catch (error) {
    console.error('Error testing processors:', error);
  }
}

testProcessors(); 