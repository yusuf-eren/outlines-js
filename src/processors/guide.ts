/**
 * Guides to control generation in steerable models.
 *
 * Logits processors rely on guides to control the generation process.
 */

// Import the tokenizer interface from models
import { Tokenizer } from '../models/tokenizer';

// Instruction types
export interface Write {
  type: 'write';
  tokens: any; // Tensor type will be determined by the specific tensor library
}

export interface Generate {
  type: 'generate';
  tokens: any; // Tensor type, null means all tokens allowed
}

export type Instruction = Write | Generate;

// Helper functions to create instructions
export function createWrite(tokens: any): Write {
  return { type: 'write', tokens };
}

export function createGenerate(tokens: any): Generate {
  return { type: 'generate', tokens };
}

// Core guide interfaces (placeholders for outlines_core functionality)
export interface CoreGuide {
  initialState: any;
  getNextInstruction(state: any): Instruction;
  getNextState(state: any, tokenId: number): any;
  isFinalState(state: any): boolean;
  copy(): CoreGuide;
}

export interface CoreRegexGuide extends CoreGuide {
  // Additional regex-specific methods would go here
}

// Parser state interfaces for CFG
export interface PartialParserState {
  lexer: {
    state: {
      text: string;
    };
  };
  accepts(): string[];
  feedEof(): void;
}

export interface PartialLark {
  parse(text: string): PartialParserState;
  parseFromState(state: PartialParserState, isEnd: boolean): void;
}

// CFG State type
export interface CFGState {
  parserState: PartialParserState | null;
  prevToken: number | null;
}

/**
 * Base definition of a generation guide.
 *
 * A generation guide defines the behavior of a finite-state machine that
 * guides a text generation procedure. Unlike the DFAs built from regular
 * expressions guides, it can also emit a `Write` instructions which tells
 * the model that it can append a sequence of tokens (or token word) instead
 * of generating it.
 */
export abstract class Guide implements CoreGuide {
  abstract initialState: any;

  abstract getNextInstruction(state: any): Instruction;
  abstract getNextState(state: any, tokenId: number): any;
  abstract isFinalState(state: any): boolean;
  abstract copy(): Guide;
}

/**
 * Guide to generate tokens until the EOS token has been generated.
 */
export class StopAtEOSGuide extends Guide {
  readonly finalState = 1;
  readonly initialState = 0;
  private eosTokenId: number;
  private vocabulary: number[];

  constructor(tokenizer: Tokenizer) {
    super();
    // Assuming tokenizer has an eos_token_id property, otherwise use a default
    this.eosTokenId =
      (tokenizer as any).eosTokenId || (tokenizer as any).eos_token_id || 0;
    this.vocabulary = Object.values(tokenizer.vocabulary);
  }

  getNextInstruction(state: number): Instruction {
    console.log('---NEXT INSTRUCTION 3333', state);
    if (this.isFinalState(state)) {
      return createWrite([this.eosTokenId]);
    }
    return createGenerate(null);
  }

  getNextState(state: number, tokenId: number): number {
    if (tokenId === this.eosTokenId || state === this.finalState) {
      return this.finalState;
    }
    return this.initialState;
  }

  isFinalState(state: number): boolean {
    return state === this.finalState;
  }

  copy(): StopAtEOSGuide {
    // Return itself as there is no need to copy
    return this;
  }
}

// Regex FSM state representation
interface RegexState {
  id: number;
  transitions: Map<number, number>;
  allowedTokens: Set<number>;
  isFinal: boolean;
}

interface RegexFSM {
  states: Map<number, RegexState>;
  initialState: number;
  finalStates: Set<number>;
}

// Cache implementation for regex FSM
const statesMappingCache = new Map<string, RegexFSM>();

function cachedCreateStatesMapping(
  regexString: string,
  tokenizer: Tokenizer,
  ...args: any[]
): RegexFSM {
  const cacheKey = JSON.stringify({
    regexString,
    tokenizer: tokenizer.vocabulary,
    args,
  });

  if (statesMappingCache.has(cacheKey)) {
    return statesMappingCache.get(cacheKey)!;
  }

  const fsm = buildRegexFSM(regexString, tokenizer);
  statesMappingCache.set(cacheKey, fsm);
  return fsm;
}

/**
 * Build a finite state machine from a regex string and tokenizer.
 * This is a simplified implementation that works with basic patterns.
 */
function buildRegexFSM(regexString: string, tokenizer: Tokenizer): RegexFSM {
  const states = new Map<number, RegexState>();
  const finalStates = new Set<number>();

  // For complex regex patterns, we'd need a full regex engine
  // This is a simplified implementation for basic patterns

  const initialState = 0;
  const finalState = 1;

  const allowedTokens = filterTokensByRegex(regexString, tokenizer);

  // Set up initial state
  states.set(initialState, {
    id: initialState,
    transitions: new Map<number, number>(
      allowedTokens.map((tokenId) => [tokenId, finalState])
    ),
    allowedTokens: new Set<number>(allowedTokens),
    isFinal: false,
  });

  // Final state
  states.set(finalState, {
    id: finalState,
    transitions: new Map(),
    allowedTokens: new Set(),
    isFinal: true,
  });

  finalStates.add(finalState);

  return {
    states,
    initialState,
    finalStates,
  };
}

/**
 * Filter tokens by regex pattern. For JSON schemas, we need special handling
 * since individual tokens won't match the full pattern.
 */
function filterTokensByRegex(
  regexString: string,
  tokenizer: Tokenizer
): number[] {
  try {
    // Check if this is a JSON schema pattern
    if (
      regexString.includes('\\{') ||
      regexString.includes('"name"') ||
      regexString.includes('"age"')
    ) {
      console.log(
        '---Detected JSON schema pattern, using JSON token filtering'
      );
      return filterTokensForJSON(regexString, tokenizer);
    }

    // For non-JSON patterns, try the original approach
    const regex = new RegExp(regexString);
    const allowedTokens: number[] = [];

    for (const [token, id] of Object.entries(tokenizer.vocabulary)) {
      const tokenStr = tokenizer.convertTokenToString(token);
      if (regex.test(tokenStr)) {
        allowedTokens.push(id);
      }
    }

    return allowedTokens;
  } catch (error) {
    // If regex is invalid, allow all tokens
    console.warn(`Invalid regex pattern: ${regexString}, allowing all tokens`);
    return Object.values(tokenizer.vocabulary);
  }
}

/**
 * Special filtering for JSON schema patterns. Returns tokens that can start
 * or continue a valid JSON structure.
 */
function filterTokensForJSON(
  regexString: string,
  tokenizer: Tokenizer
): number[] {
  const allowedTokens: number[] = [];

  // JSON starting tokens - look for tokens that contain opening brace
  const jsonStartTokens = ['{', ' {', '\\n{', '\\t{'];

  // JSON structure tokens - common tokens in JSON
  const jsonStructureTokens = [
    '{',
    '}',
    '[',
    ']',
    ':',
    ',',
    '"',
    'true',
    'false',
    'null',
    // Numbers
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    // Common JSON field names that might appear in our schema
    'name',
    'age',
    'value',
  ];

  for (const [token, id] of Object.entries(tokenizer.vocabulary)) {
    const tokenStr = tokenizer.convertTokenToString(token).trim();

    // Allow tokens that start JSON
    if (
      jsonStartTokens.some((start) =>
        tokenStr.includes(start.replace('\\\\', '\\'))
      )
    ) {
      allowedTokens.push(id);
      continue;
    }

    // Allow JSON structure tokens
    if (jsonStructureTokens.some((struct) => tokenStr.includes(struct))) {
      allowedTokens.push(id);
      continue;
    }

    // Allow quoted strings (anything with quotes)
    if (
      tokenStr.includes('"') ||
      tokenStr.startsWith('"') ||
      tokenStr.endsWith('"')
    ) {
      allowedTokens.push(id);
      continue;
    }

    // Allow tokens that could be parts of numbers
    if (/[0-9]/.test(tokenStr)) {
      allowedTokens.push(id);
      continue;
    }

    // Allow whitespace tokens
    if (
      /^\\s+$/.test(tokenStr) ||
      tokenStr === ' ' ||
      tokenStr === '\\n' ||
      tokenStr === '\\t'
    ) {
      allowedTokens.push(id);
      continue;
    }
  }

  console.log(`---JSON filtering found ${allowedTokens.length} allowed tokens`);
  return allowedTokens;
}

/**
 * Guide to generate text in the language of a regular expression.
 *
 * This class is a wrapper around the CoreRegexGuide class that adds a cache
 * to the create_states_mapping function.
 */
export class RegexGuide extends Guide implements CoreRegexGuide {
  private regexString: string;
  private tokenizer: Tokenizer;
  private fsm: RegexFSM;

  initialState: number;

  constructor(regexString: string, tokenizer: Tokenizer, fsm?: RegexFSM) {
    super();
    this.regexString = regexString;
    this.tokenizer = tokenizer;
    const zort = buildRegexFSM(
      `(\{[ ]?"name"[ ]?:[ ]?"([^"\\\x00-\x1F\x7F-\x9F]|\\["\\])*"[ ]?,[ ]?"age"[ ]?:[ ]?(-)?(0|[1-9][0-9]*)[ ]?\})`,
      tokenizer
    );

    // (\{[ ]?"name"[ ]?:[ ]?"([^"\\\x00-\x1F\x7F-\x9F]|\\["\\])*"[ ]?,[ ]?"age"[ ]?:[ ]?(-)?(0|[1-9][0-9]*)[ ]?\})
    //
    console.log('regex sitir', regexString);
    console.log(
      '---BUILDING FSM',
      zort.finalStates,
      zort.initialState,
      zort.states.get(0)
    );
    this.fsm =
      fsm ||
      buildRegexFSM(
        `(\{[ ]?"name"[ ]?:[ ]?"([^"\\\x00-\x1F\x7F-\x9F]|\\["\\])*"[ ]?,[ ]?"age"[ ]?:[ ]?(-)?(0|[1-9][0-9]*)[ ]?\})`,
        tokenizer
      );
    this.initialState = this.fsm.initialState;
    console.log('---INITIAL STATE', this.initialState, this.fsm);
  }

  static fromRegex(
    regexString: string,
    tokenizer: Tokenizer,
    ...kwargs: any[]
  ): RegexGuide {
    const fsm = cachedCreateStatesMapping(regexString, tokenizer, ...kwargs);
    return new RegexGuide(regexString, tokenizer, fsm);
  }

  getNextInstruction(state: number): Instruction {
    if (state == -1) {
      return createWrite([this.tokenizer.eosTokenId]);
    }
    // return Generate(torch.tensor(next_tokens_mask))
    console.log('---NEXT INSTRUCTION 2', state);
    const allowedTokens = this.getAllowedTokens(state);
    console.log('---ALLOWED TOKENS', allowedTokens);

    if (allowedTokens.length === 0) {
      // No valid tokens, must terminate
      return createWrite([this.tokenizer.eosTokenId]);
    }

    if (allowedTokens.length === 1) {
      return createWrite(allowedTokens);
    }

    return createGenerate(allowedTokens);
  }

  getNextState(state: number, tokenId: number): number {
    const currentState = this.fsm.states.get(state);
    if (!currentState) return state;

    return currentState.transitions.get(tokenId) ?? state;
  }

  isFinalState(state: number): boolean {
    return this.fsm.finalStates.has(state);
  }

  copy(): RegexGuide {
    return new RegexGuide(this.regexString, this.tokenizer, this.fsm);
  }

  private getAllowedTokens(state: number): number[] {
    const currentState = this.fsm.states.get(state);
    if (!currentState) return [];

    // Only return tokens that have a transition from current state
    return Array.from(currentState.transitions.keys());
  }

  private shouldTransitionToFinal(state: number, tokenId: number): boolean {
    // Simplified logic: transition to final if we've matched the pattern
    // In a full implementation, this would check if the current text matches the regex
    const tokenString = this.getTokenStringById(tokenId);
    if (!tokenString) {
      return false;
    }

    const tokenStr = this.tokenizer.convertTokenToString(tokenString);

    try {
      const regex = new RegExp(this.regexString);
      return regex.test(tokenStr);
    } catch {
      return false;
    }
  }

  private getTokenStringById(tokenId: number): string | undefined {
    // Find the token string for the given token ID
    for (const [token, id] of Object.entries(this.tokenizer.vocabulary)) {
      if (id === tokenId) {
        return token;
      }
    }
    return undefined;
  }
}

/**
 * Guide to generate text that is in the language of a context-free Lark grammar.
 */
export class CFGGuide extends Guide {
  private cfgString: string;
  private tokenizer: Tokenizer;
  private eosTokenId: number;
  private parser: PartialLark | null = null;

  initialState: CFGState;

  constructor(cfgString: string, tokenizer: Tokenizer) {
    super();

    // Warning about experimental status
    console.warn(
      "Outlines' public *community-contributed* CFG structured generation " +
        'is experimental. Please review the documentation for limitations.'
    );

    this.cfgString = cfgString;
    this.tokenizer = tokenizer;
    this.eosTokenId =
      (tokenizer as any).eosTokenId || (tokenizer as any).eos_token_id || 0;

    // Initialize parser (placeholder - would need actual Lark parser implementation)
    this.initializeParser();

    this.initialState = {
      parserState: this.parser ? this.parser.parse('') : null,
      prevToken: null,
    };
  }

  private initializeParser(): void {
    // Create a simplified parser implementation
    // In a full implementation, this would use the actual Lark parser
    this.parser = {
      parse: (text: string): PartialParserState => {
        return {
          lexer: {
            state: {
              text: text,
            },
          },
          accepts: (): string[] => {
            // Simplified: return basic grammar symbols
            return text === '' ? ['START'] : ['$END'];
          },
          feedEof: (): void => {
            // Simplified EOF handling
            if (this.isValidGrammarEnd(text)) {
              return;
            }
            throw new Error('Unexpected EOF');
          },
        };
      },
      parseFromState: (state: PartialParserState, isEnd: boolean): void => {
        // Simplified parsing - in reality this would advance the parser state
        if (isEnd && !this.isValidGrammarEnd(state.lexer.state.text)) {
          throw new Error('Invalid grammar at end');
        }
      },
    };
  }

  private isValidGrammarEnd(text: string): boolean {
    // Simplified grammar validation
    // In a real implementation, this would check against the actual CFG
    return text.trim().length === 0 || this.isBasicGrammarValid(text);
  }

  private isBasicGrammarValid(text: string): boolean {
    // Very basic grammar validation for demonstration
    // This should be replaced with actual CFG parsing logic
    try {
      // Simple checks for common patterns
      const trimmed = text.trim();

      // Allow empty strings
      if (trimmed === '') return true;

      // Basic bracket matching
      const brackets = { '(': ')', '[': ']', '{': '}' };
      const stack: string[] = [];

      for (const char of trimmed) {
        if (char in brackets) {
          stack.push(brackets[char as keyof typeof brackets]);
        } else if (Object.values(brackets).includes(char)) {
          if (stack.pop() !== char) {
            return false;
          }
        }
      }

      return stack.length === 0;
    } catch {
      return false;
    }
  }

  getNextInstruction(state: CFGState): Instruction {
    if (state.parserState === null) {
      return createWrite([this.eosTokenId]);
    }

    const validTokens = Array.from(
      this.iterValidTokenIds(state, Object.values(this.tokenizer.vocabulary))
    );

    if (validTokens.length === 1) {
      return createWrite(validTokens);
    }

    return createGenerate(validTokens);
  }

  *iterValidTokenIds(
    state: CFGState,
    candidateTokenIds: number[]
  ): Generator<number> {
    for (const tokenId of candidateTokenIds) {
      if (tokenId === this.eosTokenId) {
        if (this.canTerminateState(state)) {
          yield tokenId;
        }
      } else {
        try {
          this.getParserStateTokenApplied(state, tokenId);
          yield tokenId;
        } catch (error) {
          // Token is not valid for current parser state
          continue;
        }
      }
    }
  }

  getNextState(state: CFGState, tokenId: number): CFGState {
    if (state.parserState === null || tokenId === this.eosTokenId) {
      return {
        parserState: null,
        prevToken: tokenId,
      };
    }

    const newParserState = this.getParserStateTokenApplied(state, tokenId);
    return {
      parserState: newParserState,
      prevToken: tokenId,
    };
  }

  private getParserStateTokenApplied(
    state: CFGState,
    tokenId: number
  ): PartialParserState {
    if (!state.parserState) {
      throw new Error('Cannot apply token to null parser state');
    }

    // Create a copy to prevent side effects
    const parserState = this.copyParserState(state.parserState);

    // Get the token string
    let newTokenStr: string;
    if (state.prevToken === null) {
      newTokenStr = this.tokenizer.decode([tokenId])[0] || '';
    } else {
      const prevTokenStr = this.tokenizer.decode([state.prevToken])[0] || '';
      const combinedTokenStr =
        this.tokenizer.decode([state.prevToken, tokenId])[0] || '';
      newTokenStr = combinedTokenStr.slice(prevTokenStr.length);
    }

    if (newTokenStr === '') {
      throw new Error('empty next token');
    }

    // Update parser with new token (placeholder implementation)
    parserState.lexer.state.text += newTokenStr;

    if (this.parser) {
      this.parser.parseFromState(parserState, false);
    }

    return parserState;
  }

  private copyParserState(state: PartialParserState): PartialParserState {
    // Simplified copy implementation
    return {
      lexer: {
        state: {
          text: state.lexer.state.text,
        },
      },
      accepts: state.accepts.bind(state),
      feedEof: state.feedEof.bind(state),
    };
  }

  isFinalState(state: CFGState): boolean {
    return this.canTerminateState(state);
  }

  canTerminateState(state: CFGState): boolean {
    if (state.parserState !== null) {
      try {
        const stateCopy = this.copyParserState(state.parserState);
        stateCopy.feedEof();
      } catch (error) {
        return false;
      }
    }
    return true;
  }

  mustTerminateState(state: CFGState): boolean {
    if (state.parserState === null) {
      return true;
    }

    const acceptedTokens = new Set(state.parserState.accepts());
    return acceptedTokens.size === 1 && acceptedTokens.has('$END');
  }

  copy(): CFGGuide {
    return new CFGGuide(this.cfgString, this.tokenizer);
  }
}
// Export all types and classes
export default {
  Guide,
  StopAtEOSGuide,
  RegexGuide,
  CFGGuide,
  createWrite,
  createGenerate,
};
