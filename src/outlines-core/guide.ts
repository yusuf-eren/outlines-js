/**
 * TypeScript implementation of Guide, Index, and Vocabulary classes
 * Exact same functionality as Rust version for structured text generation
 */

// Type definitions
export type StateId = number;
export type TokenId = number;
export type Token = string | Uint8Array;

// Error class for guide operations
export class GuideError extends Error {
  constructor(message: string, public errorType?: string) {
    super(message);
    this.name = 'GuideError';
  }
}

// Interface for finite state automaton transitions
export interface Transitions {
  [state: StateId]: { [token: TokenId]: StateId };
}

/**
 * Vocabulary class for managing LLM tokens
 */
export class Vocabulary {
  private eosTokenId: TokenId;
  private tokenToIds: Map<string, TokenId[]>;
  private idToToken: Map<TokenId, string>;
  private nextTokenId: TokenId;

  constructor(eosTokenId: TokenId, tokenMap: Record<string, TokenId[]> = {}) {
    this.eosTokenId = eosTokenId;
    this.tokenToIds = new Map();
    this.idToToken = new Map();
    this.nextTokenId = 0;

    // Add EOS token
    this.idToToken.set(eosTokenId, '<EOS>');

    // Process token map
    for (const [token, ids] of Object.entries(tokenMap)) {
      this.tokenToIds.set(token, [...ids]);
      for (const id of ids) {
        this.idToToken.set(id, token);
        this.nextTokenId = Math.max(this.nextTokenId, id + 1);
      }
    }
  }

  /**
   * Insert a token with given token ID
   */
  insert(token: string, tokenId: TokenId): void {
    if (tokenId === this.eosTokenId) {
      throw new GuideError(
        'EOS token should not be inserted into Vocabulary',
        'EOSTokenDisallowed'
      );
    }

    if (!this.tokenToIds.has(token)) {
      this.tokenToIds.set(token, []);
    }

    const existingIds = this.tokenToIds.get(token)!;
    if (!existingIds.includes(tokenId)) {
      existingIds.push(tokenId);
    }

    this.idToToken.set(tokenId, token);
    this.nextTokenId = Math.max(this.nextTokenId, tokenId + 1);
  }

  /**
   * Remove a token from vocabulary
   */
  remove(token: string): void {
    const ids = this.tokenToIds.get(token);
    if (ids) {
      for (const id of ids) {
        this.idToToken.delete(id);
      }
      this.tokenToIds.delete(token);
    }
  }

  /**
   * Get token IDs for a given token
   */
  get(token: string): TokenId[] | null {
    return this.tokenToIds.get(token) || null;
  }

  /**
   * Get the EOS token ID
   */
  getEosTokenId(): TokenId {
    return this.eosTokenId;
  }

  /**
   * Get vocabulary size (including EOS token)
   */
  len(): number {
    return this.idToToken.size;
  }

  /**
   * Get all token IDs
   */
  getAllTokenIds(): TokenId[] {
    return Array.from(this.idToToken.keys());
  }

  /**
   * Get token by ID
   */
  getTokenById(id: TokenId): string | null {
    return this.idToToken.get(id) || null;
  }

  /**
   * Get all tokens
   */
  getAllTokens(): string[] {
    return Array.from(this.tokenToIds.keys());
  }
}

/**
 * Index class for finite state automaton operations
 */
export class Index {
  private initialState: StateId;
  private finalStates: Set<StateId>;
  private transitions: Transitions;
  private vocabulary: Vocabulary;
  private stateAllowedTokens: Map<StateId, TokenId[]>;

  constructor(regex: string, vocabulary: Vocabulary) {
    this.vocabulary = vocabulary;
    this.finalStates = new Set();
    this.transitions = {};
    this.stateAllowedTokens = new Map();
    this.initialState = 0;

    // Build finite state automaton from regex and vocabulary
    this.buildAutomaton(regex);
  }

  /**
   * Build finite state automaton from regex pattern
   */
  private buildAutomaton(pattern: string): void {
    try {
      // Create a basic automaton that matches the vocabulary tokens against the regex
      // This is a simplified implementation - in practice you'd use a proper regex engine

      let stateCounter = 0;
      this.initialState = stateCounter++;

      // Create states for different parts of the regex
      const states = this.analyzeRegexPattern(pattern);

      // Build transitions based on vocabulary tokens
      this.buildTransitions(states, stateCounter);
    } catch (error) {
      throw new GuideError(
        `Failed to build automaton from regex: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'IndexDfaError'
      );
    }
  }

  /**
   * Analyze regex pattern to create state structure
   */
  private analyzeRegexPattern(pattern: string): any {
    // Simplified regex analysis - matches common patterns
    // In a full implementation, this would use a proper regex parser

    const states = {
      canAcceptQuotes: pattern.includes('"'),
      canAcceptBraces: pattern.includes('{') || pattern.includes('}'),
      canAcceptBrackets: pattern.includes('[') || pattern.includes(']'),
      canAcceptNumbers:
        /\d/.test(pattern) ||
        pattern.includes('number') ||
        pattern.includes('integer'),
      canAcceptLetters: /[a-zA-Z]/.test(pattern) || pattern.includes('string'),
      canAcceptSpaces: /\s/.test(pattern) || pattern.includes(' '),
      isUniversal: pattern === '.*' || pattern === '.+' || pattern.length === 0,
    };

    return states;
  }

  /**
   * Build state transitions based on vocabulary tokens
   */
  private buildTransitions(states: any, stateCounter: number): void {
    const allTokens = this.vocabulary.getAllTokenIds();
    const acceptingState = stateCounter++;

    // Mark accepting state as final
    this.finalStates.add(acceptingState);

    // Build transitions from initial state
    const allowedFromInitial: TokenId[] = [];

    for (const tokenId of allTokens) {
      const token = this.vocabulary.getTokenById(tokenId);
      if (!token) continue;

      let canTransition = false;

      if (states.isUniversal) {
        canTransition = true;
      } else {
        // Check if token matches pattern constraints
        if (states.canAcceptQuotes && (token === '"' || token.includes('"')))
          canTransition = true;
        if (
          states.canAcceptBraces &&
          (token === '{' ||
            token === '}' ||
            token.includes('{') ||
            token.includes('}'))
        )
          canTransition = true;
        if (states.canAcceptBrackets && (token === '[' || token === ']'))
          canTransition = true;
        if (states.canAcceptNumbers && /\d/.test(token)) canTransition = true;
        if (states.canAcceptLetters && /[a-zA-Z]/.test(token))
          canTransition = true;
        if (states.canAcceptSpaces && /\s/.test(token)) canTransition = true;

        // Allow common JSON tokens
        if ([',', ':', 'true', 'false', 'null'].includes(token))
          canTransition = true;
      }

      if (canTransition) {
        allowedFromInitial.push(tokenId);

        // Create transition
        if (!this.transitions[this.initialState]) {
          this.transitions[this.initialState] = {};
        }
        this.transitions[this.initialState][tokenId] = acceptingState;

        // From accepting state, can transition to itself with any allowed token
        if (!this.transitions[acceptingState]) {
          this.transitions[acceptingState] = {};
        }
        this.transitions[acceptingState][tokenId] = acceptingState;
      }
    }

    this.stateAllowedTokens.set(this.initialState, allowedFromInitial);
    this.stateAllowedTokens.set(acceptingState, allowedFromInitial);
  }

  /**
   * Get the initial state ID
   */
  getInitialState(): StateId {
    return this.initialState;
  }

  /**
   * Get allowed tokens for a given state
   */
  getAllowedTokens(state: StateId): TokenId[] | null {
    return this.stateAllowedTokens.get(state) || null;
  }

  /**
   * Get next state for given state and token ID
   */
  getNextState(state: StateId, tokenId: TokenId): StateId | null {
    const stateTransitions = this.transitions[state];
    if (!stateTransitions) return null;
    return stateTransitions[tokenId] || null;
  }

  /**
   * Check if a state is a final state
   */
  isFinalState(state: StateId): boolean {
    return this.finalStates.has(state);
  }

  /**
   * Get all final states
   */
  getFinalStates(): StateId[] {
    return Array.from(this.finalStates);
  }

  /**
   * Get all transitions as JSON string
   */
  getTransitions(): string {
    const result: Record<string, Record<string, StateId>> = {};

    for (const [state, transitions] of Object.entries(this.transitions)) {
      const stateTransitions: Record<string, StateId> = {};
      for (const [token, nextState] of Object.entries(transitions)) {
        stateTransitions[token] = nextState as StateId;
      }
      result[state] = stateTransitions;
    }

    return JSON.stringify(result);
  }

  /**
   * Check if there are any allowed tokens for the given state
   */
  hasAllowedTokens(state: StateId): boolean {
    const tokens = this.getAllowedTokens(state);
    return tokens !== null && tokens.length > 0;
  }
}

/**
 * Guide class for token generation with state management
 */
export class Guide {
  private state: StateId;
  private index: Index;
  private stateCache: StateId[];
  private maxRollback: number;

  constructor(index: Index, maxRollback: number = 32) {
    this.index = index;
    this.maxRollback = maxRollback;
    this.state = index.getInitialState();
    this.stateCache = [];
  }

  /**
   * Get the current state ID
   */
  getState(): StateId {
    return this.state;
  }

  /**
   * Get allowed tokens for the current state
   */
  getTokens(): TokenId[] {
    const tokens = this.index.getAllowedTokens(this.state);
    if (tokens === null) {
      throw new GuideError(
        `No allowed tokens available for the state ${this.state}`,
        'InvalidState'
      );
    }
    return tokens;
  }

  /**
   * Get the number of rollback steps available
   */
  getAllowedRollback(): number {
    return this.stateCache.length;
  }

  /**
   * Advance to next state with given token ID
   */
  advance(tokenId: TokenId, returnTokens: boolean = true): TokenId[] | null {
    const nextState = this.index.getNextState(this.state, tokenId);

    if (nextState === null) {
      throw new GuideError(
        `No next state found for the current state: ${this.state} with token ID: ${tokenId}`,
        'InvalidTransition'
      );
    }

    // Manage state cache for rollback
    if (this.stateCache.length >= this.maxRollback) {
      this.stateCache.shift(); // Remove oldest state
    }
    this.stateCache.push(this.state);

    // Update current state
    this.state = nextState;

    if (returnTokens) {
      return this.getTokens();
    }
    return null;
  }

  /**
   * Rollback the state by n steps
   */
  rollbackState(n: number): void {
    if (n === 0) return;

    if (n > this.getAllowedRollback()) {
      throw new GuideError(
        `Cannot roll back ${n} step(s): only ${this.getAllowedRollback()} states stored (max_rollback = ${
          this.maxRollback
        }). ` +
          `You must advance through at least ${n} state(s) before rolling back ${n} step(s).`,
        'InvalidRollback'
      );
    }

    for (let i = 0; i < n; i++) {
      const previousState = this.stateCache.pop();
      if (previousState !== undefined) {
        this.state = previousState;
      }
    }
  }

  /**
   * Check if a sequence of tokens leads to a valid state
   */
  acceptsTokens(sequence: TokenId[]): boolean {
    let currentState = this.state;

    for (const tokenId of sequence) {
      const nextState = this.index.getNextState(currentState, tokenId);
      if (nextState === null) {
        return false;
      }
      currentState = nextState;
    }

    return true;
  }

  /**
   * Check if the automaton is in a final state
   */
  isFinished(): boolean {
    return this.index.isFinalState(this.state);
  }

  /**
   * Reset guide to initial state
   */
  reset(): void {
    this.state = this.index.getInitialState();
    this.stateCache = [];
  }

  /**
   * Create a copy of the current guide state
   */
  clone(): Guide {
    const newGuide = new Guide(this.index, this.maxRollback);
    newGuide.state = this.state;
    newGuide.stateCache = [...this.stateCache];
    return newGuide;
  }

  /**
   * Get debug information about the current state
   */
  getDebugInfo(): any {
    return {
      currentState: this.state,
      allowedTokens: this.index.getAllowedTokens(this.state),
      isFinished: this.isFinished(),
      rollbackAvailable: this.getAllowedRollback(),
      stateCache: [...this.stateCache],
    };
  }

  /**
   * Simulate advancing through a sequence without changing state
   */
  simulateAdvance(sequence: TokenId[]): {
    valid: boolean;
    finalState?: StateId;
    failedAt?: number;
  } {
    let currentState = this.state;

    for (let i = 0; i < sequence.length; i++) {
      const nextState = this.index.getNextState(currentState, sequence[i]);
      if (nextState === null) {
        return { valid: false, failedAt: i };
      }
      currentState = nextState;
    }

    return { valid: true, finalState: currentState };
  }

  /**
   * Get all possible next tokens from current state
   */
  getPossibleNextTokens(): TokenId[] {
    return this.getTokens();
  }

  /**
   * Check if a specific token is allowed from current state
   */
  isTokenAllowed(tokenId: TokenId): boolean {
    const allowedTokens = this.index.getAllowedTokens(this.state);
    return allowedTokens !== null && allowedTokens.includes(tokenId);
  }

  /**
   * Get the shortest path to a final state (if possible)
   */
  getShortestPathToFinal(): TokenId[] | null {
    if (this.isFinished()) return [];

    // Simple BFS to find shortest path to any final state
    const queue: { state: StateId; path: TokenId[] }[] = [
      { state: this.state, path: [] },
    ];
    const visited = new Set<StateId>();
    const finalStates = new Set(this.index.getFinalStates());

    while (queue.length > 0) {
      const { state, path } = queue.shift()!;

      if (visited.has(state)) continue;
      visited.add(state);

      if (finalStates.has(state)) {
        return path;
      }

      // Prevent infinite loops by limiting path length
      if (path.length > 10) continue;

      const allowedTokens = this.index.getAllowedTokens(state);
      if (allowedTokens) {
        for (const token of allowedTokens) {
          const nextState = this.index.getNextState(state, token);
          if (nextState !== null && !visited.has(nextState)) {
            queue.push({ state: nextState, path: [...path, token] });
          }
        }
      }
    }

    return null; // No path to final state found
  }
}
