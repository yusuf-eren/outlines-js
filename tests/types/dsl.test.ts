/**
 * Tests for the DSL module - TypeScript version
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  // Core DSL classes
  Term,
  StringTerm,
  Regex,
  JsonSchema,
  CFG,
  FSM,
  KleeneStar,
  KleenePlus,
  Optional,
  Alternatives,
  Sequence,
  QuantifyExact,
  QuantifyMinimum,
  QuantifyMaximum,
  QuantifyBetween,
  
  // Factory functions
  either,
  optional,
  exactly,
  atLeast,
  atMost,
  between,
  zeroOrMore,
  oneOrMore,
  regex,
  jsonSchema,
  
  // Deprecated functions
  repeat,
  times,
  
  // Type conversion
  typescriptTypesToTerms,
  handleLiteral,
  handleUnion,
  handleList,
  handleTuple,
  handleDict,
} from '../../src/types/dsl';

// Built-in types
import {
  integer,
  number,
  boolean,
  string,
  time,
  date,
  datetime,
} from '../../src/types/index';

// Mock interegular functionality for FSM tests
const mockFsm = {
  __repr__: () => 'MockFSM()',
  toString: () => 'MockFSM()',
};

function createMockFsm() {
  return mockFsm;
}

describe('DSL Initialization Tests', () => {
  test('test_dsl_init', () => {
    const stringTerm = new StringTerm('test');
    expect(stringTerm.value).toBe('test');
    expect(stringTerm.toString()).toBe("StringTerm(value='test')");
    expect(stringTerm.displayAsciiTree()).toBe("└── StringTerm('test')\n");

    const regexTerm = new Regex('[0-9]');
    expect(regexTerm.pattern).toBe('[0-9]');
    expect(regexTerm.toString()).toBe("Regex(pattern='[0-9]')");
    expect(regexTerm.displayAsciiTree()).toBe("└── Regex('[0-9]')\n");

    const schema = new JsonSchema('{ "type": "string" }');
    expect(schema.schema).toBe('{ "type": "string" }');
    expect(schema.toString()).toBe('JsonSchema(schema=\'{ "type": "string" }\')');
    expect(schema.displayAsciiTree()).toBe('└── JsonSchema(\'{ "type": "string" }\')\n');

    const kleeneStar = new KleeneStar(stringTerm);
    expect(kleeneStar.term).toBe(stringTerm);
    expect(kleeneStar.toString()).toBe("KleeneStar(term=StringTerm(value='test'))");
    expect(kleeneStar.displayAsciiTree()).toBe("└── KleeneStar(*)\n    └── StringTerm('test')\n");

    const kleenePlus = new KleenePlus(stringTerm);
    expect(kleenePlus.term).toBe(stringTerm);
    expect(kleenePlus.toString()).toBe("KleenePlus(term=StringTerm(value='test'))");
    expect(kleenePlus.displayAsciiTree()).toBe("└── KleenePlus(+)\n    └── StringTerm('test')\n");

    const optionalTerm = new Optional(stringTerm);
    expect(optionalTerm.term).toBe(stringTerm);
    expect(optionalTerm.toString()).toBe("Optional(term=StringTerm(value='test'))");
    expect(optionalTerm.displayAsciiTree()).toBe("└── Optional(?)\n    └── StringTerm('test')\n");

    const alternatives = new Alternatives([stringTerm, regexTerm]);
    expect(alternatives.terms[0]).toBe(stringTerm);
    expect(alternatives.terms[1]).toBe(regexTerm);
    expect(alternatives.toString()).toBe("Alternatives(terms=[StringTerm(value='test'), Regex(pattern='[0-9]')])");
    expect(alternatives.displayAsciiTree()).toBe("└── Alternatives(|)\n    ├── StringTerm('test')\n    └── Regex('[0-9]')\n");

    const sequence = new Sequence([stringTerm, regexTerm]);
    expect(sequence.terms[0]).toBe(stringTerm);
    expect(sequence.terms[1]).toBe(regexTerm);
    expect(sequence.toString()).toBe("Sequence(terms=[StringTerm(value='test'), Regex(pattern='[0-9]')])");
    expect(sequence.displayAsciiTree()).toBe("└── Sequence\n    ├── StringTerm('test')\n    └── Regex('[0-9]')\n");

    const exact = new QuantifyExact(stringTerm, 3);
    expect(exact.term).toBe(stringTerm);
    expect(exact.count).toBe(3);
    expect(exact.toString()).toBe("QuantifyExact(term=StringTerm(value='test'), count=3)");
    expect(exact.displayAsciiTree()).toBe("└── Quantify({3})\n    └── StringTerm('test')\n");

    const minimum = new QuantifyMinimum(stringTerm, 3);
    expect(minimum.term).toBe(stringTerm);
    expect(minimum.minCount).toBe(3);
    expect(minimum.toString()).toBe("QuantifyMinimum(term=StringTerm(value='test'), minCount=3)");
    expect(minimum.displayAsciiTree()).toBe("└── Quantify({3,})\n    └── StringTerm('test')\n");

    const maximum = new QuantifyMaximum(stringTerm, 3);
    expect(maximum.term).toBe(stringTerm);
    expect(maximum.maxCount).toBe(3);
    expect(maximum.toString()).toBe("QuantifyMaximum(term=StringTerm(value='test'), maxCount=3)");
    expect(maximum.displayAsciiTree()).toBe("└── Quantify({,3})\n    └── StringTerm('test')\n");

    const betweenTerm = new QuantifyBetween(stringTerm, 1, 3);
    expect(betweenTerm.term).toBe(stringTerm);
    expect(betweenTerm.minCount).toBe(1);
    expect(betweenTerm.maxCount).toBe(3);
    expect(betweenTerm.toString()).toBe("QuantifyBetween(term=StringTerm(value='test'), minCount=1, maxCount=3)");
    expect(betweenTerm.displayAsciiTree()).toBe("└── Quantify({1,3})\n    └── StringTerm('test')\n");

    expect(() => new QuantifyBetween(stringTerm, 3, 1)).toThrow('QuantifyBetween: maxCount must be greater than minCount.');
  });
});

describe('DSL Term Methods Tests', () => {
  test('test_dsl_term_methods', () => {
    const a = new StringTerm('a');
    const b = new Regex('[0-9]');
    const c = 'c';

    expect(a.add(b)).toEqual(new Sequence([a, b]));
    expect(a.add(c)).toEqual(new Sequence([a, new StringTerm(c)]));

    expect(a.or(b)).toEqual(new Alternatives([a, b]));
    expect(a.or(c)).toEqual(new Alternatives([a, new StringTerm(c)]));

    expect(a.matches('a')).toBe(true);
    expect(a.matches('b')).toBe(false);

    expect(a.displayAsciiTree()).toBe("└── StringTerm('a')\n");

    // Cannot instantiate abstract class Term directly
    // This test verifies that Term is abstract

    expect((a as any).displayChildren('')).toBe('');

    expect(a.displayAsciiTree()).toBe("└── StringTerm('a')\n");
  });

  test('test_dsl_sequence', () => {
    const a = new StringTerm('a');
    const b = new StringTerm('b');

    const sequence = a.add(b);
    expect(sequence).toBeInstanceOf(Sequence);
    expect(sequence.terms[0]).toBe(a);
    expect(sequence.terms[1]).toBe(b);

    const sequence2 = new StringTerm('a').add(b);
    expect(sequence2).toBeInstanceOf(Sequence);
    expect(sequence2.terms[0]).toBeInstanceOf(StringTerm);
    expect((sequence2.terms[0] as StringTerm).value).toBe('a');
    expect((sequence2.terms[1] as StringTerm).value).toBe('b');

    const sequence3 = a.add('b');
    expect(sequence3).toBeInstanceOf(Sequence);
    expect(sequence3.terms[1]).toBeInstanceOf(StringTerm);
    expect((sequence3.terms[0] as StringTerm).value).toBe('a');
    expect((sequence3.terms[1] as StringTerm).value).toBe('b');
  });

  test('test_dsl_alternatives', () => {
    const a = new StringTerm('a');
    const b = new StringTerm('b');

    const alt = either(a, b);
    expect(alt).toBeInstanceOf(Alternatives);
    expect(alt.terms[0]).toBeInstanceOf(StringTerm);
    expect(alt.terms[1]).toBeInstanceOf(StringTerm);

    const alt2 = either('a', 'b');
    expect(alt2).toBeInstanceOf(Alternatives);
    expect(alt2.terms[0]).toBeInstanceOf(StringTerm);
    expect(alt2.terms[1]).toBeInstanceOf(StringTerm);

    const alt3 = either('a', b);
    expect(alt3).toBeInstanceOf(Alternatives);
    expect(alt3.terms[0]).toBeInstanceOf(StringTerm);
    expect(alt3.terms[1]).toBeInstanceOf(StringTerm);
  });

  test('test_dsl_optional', () => {
    const a = new StringTerm('a');

    const opt = a.optional();
    expect(opt).toBeInstanceOf(Optional);

    const opt2 = optional('a');
    expect(opt2).toBeInstanceOf(Optional);
    expect(opt2.term).toBeInstanceOf(StringTerm);

    const opt3 = a.optional();
    expect(opt3).toBeInstanceOf(Optional);
  });

  test('test_dsl_exactly', () => {
    const a = new StringTerm('a');

    const rep = a.exactly(2);
    expect(rep).toBeInstanceOf(QuantifyExact);
    expect(rep.count).toBe(2);

    const rep2 = exactly(2, 'a');
    expect(rep2).toBeInstanceOf(QuantifyExact);
    expect(rep2.term).toBeInstanceOf(StringTerm);

    const rep3 = a.exactly(2);
    expect(rep3).toBeInstanceOf(QuantifyExact);
  });

  test('test_dsl_at_least', () => {
    const a = new StringTerm('a');

    const rep = a.atLeast(2);
    expect(rep).toBeInstanceOf(QuantifyMinimum);
    expect(rep.minCount).toBe(2);

    const rep2 = atLeast(2, 'a');
    expect(rep2).toBeInstanceOf(QuantifyMinimum);
    expect(rep2.term).toBeInstanceOf(StringTerm);

    const rep3 = a.atLeast(2);
    expect(rep3).toBeInstanceOf(QuantifyMinimum);
  });

  test('test_dsl_at_most', () => {
    const a = new StringTerm('a');

    const rep = a.atMost(2);
    expect(rep).toBeInstanceOf(QuantifyMaximum);
    expect(rep.maxCount).toBe(2);

    const rep2 = atMost(2, 'a');
    expect(rep2).toBeInstanceOf(QuantifyMaximum);
    expect(rep2.term).toBeInstanceOf(StringTerm);

    const rep3 = a.atMost(2);
    expect(rep3).toBeInstanceOf(QuantifyMaximum);
  });

  test('test_between', () => {
    const a = new StringTerm('a');

    const rep = a.between(1, 2);
    expect(rep).toBeInstanceOf(QuantifyBetween);
    expect(rep.minCount).toBe(1);
    expect(rep.maxCount).toBe(2);

    const rep2 = between(1, 2, 'a');
    expect(rep2).toBeInstanceOf(QuantifyBetween);
    expect(rep2.term).toBeInstanceOf(StringTerm);

    const rep3 = a.between(1, 2);
    expect(rep3).toBeInstanceOf(QuantifyBetween);
  });

  test('test_dsl_zero_or_more', () => {
    const a = new StringTerm('a');

    const rep = a.zeroOrMore();
    expect(rep).toBeInstanceOf(KleeneStar);

    const rep2 = zeroOrMore('a');
    expect(rep2).toBeInstanceOf(KleeneStar);
    expect(rep2.term).toBeInstanceOf(StringTerm);

    const rep3 = a.zeroOrMore();
    expect(rep3).toBeInstanceOf(KleeneStar);
  });

  test('test_dsl_one_or_more', () => {
    const a = new StringTerm('a');

    const rep = a.oneOrMore();
    expect(rep).toBeInstanceOf(KleenePlus);

    const rep2 = oneOrMore('a');
    expect(rep2).toBeInstanceOf(KleenePlus);
    expect(rep2.term).toBeInstanceOf(StringTerm);

    const rep3 = a.zeroOrMore();
    expect(rep3).toBeInstanceOf(KleeneStar);
  });

  test('test_dsl_aliases', () => {
    const test1 = regex('[0-9]');
    expect(test1).toBeInstanceOf(Regex);

    const test2 = jsonSchema('{"type": "string"}');
    expect(test2).toBeInstanceOf(JsonSchema);
  });
});

describe('DSL Deprecated Function Tests', () => {
  test('test_dsl_repeat', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    const a = new StringTerm('a');

    // error missing minCount or maxCount
    expect(() => repeat(a, undefined, undefined)).toThrow('You must provide a value for at least minCount or maxCount');

    // atLeast
    expect(repeat(a, 2, undefined)).toEqual(atLeast(2, a));
    expect(repeat(new StringTerm('a'), 2, undefined)).toEqual(atLeast(2, new StringTerm('a')));
    expect(a.repeat(2, undefined)).toEqual(a.atLeast(2));

    // atMost
    expect(repeat(a, undefined, 2)).toEqual(atMost(2, a));
    expect(repeat(new StringTerm('a'), undefined, 2)).toEqual(atMost(2, new StringTerm('a')));
    expect(a.repeat(undefined, 2)).toEqual(a.atMost(2));

    // between
    expect(repeat(a, 1, 2)).toEqual(between(1, 2, a));
    expect(repeat(new StringTerm('a'), 1, 2)).toEqual(between(1, 2, new StringTerm('a')));
    expect(a.repeat(1, 2)).toEqual(a.between(1, 2));

    expect(consoleSpy).toHaveBeenCalledWith('The `repeat` function/method is deprecated. Use `atLeast`, `atMost`, or `between` instead.');
    consoleSpy.mockRestore();
  });

  test('test_dsl_times', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    const a = new StringTerm('a');

    expect(times(a, 2)).toEqual(exactly(2, a));
    expect(times(new StringTerm('a'), 2)).toEqual(exactly(2, new StringTerm('a')));
    expect(a.times(2)).toEqual(a.exactly(2));

    expect(consoleSpy).toHaveBeenCalledWith('The `times` function/method is deprecated. Use `exactly` instead.');
    consoleSpy.mockRestore();
  });
});

describe('DSL Display Tests', () => {
  test('test_dsl_display', () => {
    const a = new StringTerm('a');
    const b = new StringTerm('b');
    const c = new Regex('[0-9]');
    const d = new Sequence([new KleeneStar(new Alternatives([a, b])), c]);

    const tree = d.displayAsciiTree();
    expect(tree).toBe("└── Sequence\n    ├── KleeneStar(*)\n    │   └── Alternatives(|)\n    │       ├── StringTerm('a')\n    │       └── StringTerm('b')\n    └── Regex('[0-9]')\n");
  });
});

describe('CFG Tests', () => {
  test('test_cfg', () => {
    const definition = `
      ?start: expr
      expr: digit+ ("+" digit+)*
      digit: "0"|"1"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"
    `;

    const cfg = new CFG(definition);
    expect(cfg).toBeInstanceOf(CFG);
    expect(cfg.definition).toBe(definition);
  });

  test('test_cfg_from_file', async () => {
    const grammarContent = `
      ?start: expr
      expr: digit+ ("+" digit+)*
      digit: "0"|"1"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"
    `;
    
    const tempFile = path.join(os.tmpdir(), 'test_grammar.txt');
    fs.writeFileSync(tempFile, grammarContent);
    
    try {
      const cfg = await CFG.fromFile(tempFile);
      expect(cfg.equals(new CFG(grammarContent))).toBe(true);
    } finally {
      fs.unlinkSync(tempFile);
    }
  });
});

describe('FSM Tests', () => {
  test('test_fsm', () => {
    const mockFsmInstance = createMockFsm();
    const fsm = new FSM(mockFsmInstance);
    expect(fsm).toBeInstanceOf(FSM);
    expect(fsm.fsm).toBe(mockFsmInstance);
    expect(fsm.toString()).toBe(`FSM(fsm=${mockFsmInstance.__repr__()})`);
  });

  test('test_fsm_constructor', () => {
    const mockFsmInstance = createMockFsm();
    const fsm = new FSM(mockFsmInstance);
    expect(fsm.fsm).toBe(mockFsmInstance);
  });
});

describe('JsonSchema Tests', () => {
  test('test_json_schema', () => {
    const schema1 = new JsonSchema('{"type": "string"}');
    expect(schema1).toBeInstanceOf(JsonSchema);
    expect(schema1.schema).toBe('{"type": "string"}');

    const schema2 = new JsonSchema({ type: 'string' });
    expect(schema2).toBeInstanceOf(JsonSchema);
    expect(schema2.schema).toBe('{"type":"string"}');

    const schema3 = new JsonSchema('{"type": "string"}');
    expect(schema3.toString()).toContain('JsonSchema');
  });

  test('test_json_schema_from_file', async () => {
    const schemaContent = `{
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "age": {"type": "integer"}
        }
    }
    `;
    
    const tempFile = path.join(os.tmpdir(), 'test_schema.json');
    fs.writeFileSync(tempFile, schemaContent);
    
    try {
      const schema = await JsonSchema.fromFile(tempFile);
      expect(schema.equals(new JsonSchema(schemaContent))).toBe(true);
    } finally {
      fs.unlinkSync(tempFile);
    }
  });
});

describe('Type Conversion Tests', () => {
  test('test_dsl_python_types_to_terms', () => {
    // Test recursion limit
    expect(() => typescriptTypesToTerms(null, 11)).toThrow('Maximum recursion depth exceeded');

    // Test integer
    const integer = typescriptTypesToTerms('number');
    expect(integer).toBeInstanceOf(Regex);

    // Test string
    const string = typescriptTypesToTerms('string');
    expect(string).toBeInstanceOf(Regex);

    // Test tuple - returns sequence with multiple terms
    const result = typescriptTypesToTerms(['a', 'number', { type: 'string' }]);
    expect(result).toBeInstanceOf(Sequence);
    const sequenceResult = result as Sequence;
    expect(sequenceResult.terms).toHaveLength(3);
    expect(sequenceResult.terms[0]).toEqual(new StringTerm('a'));
    expect(sequenceResult.terms[1]).toBe(integer);
    expect(sequenceResult.terms[2]).toBeInstanceOf(JsonSchema);

    // Test choices
    const choice1 = typescriptTypesToTerms(['choice1', 'choice2']);
    expect(choice1).toBeInstanceOf(Alternatives);

    // Test choices with duplicates
    const choice2 = typescriptTypesToTerms(['choice1', 'choice2', 'choice1']);
    expect(choice2).toBeInstanceOf(Alternatives);

    // Test choices in a tuple
    const result3 = typescriptTypesToTerms(['choice1', ['a', 'b']]);
    expect(result3).toBeInstanceOf(Sequence);
    const sequenceResult3 = result3 as Sequence;
    expect(sequenceResult3.terms).toHaveLength(2);
    expect(sequenceResult3.terms[0]).toEqual(new StringTerm('choice1'));
    expect(sequenceResult3.terms[1]).toBeInstanceOf(Alternatives);
    const alternativesResult = sequenceResult3.terms[1] as Alternatives;
    expect(alternativesResult.terms).toHaveLength(2);
    expect(alternativesResult.terms[0]).toEqual(new StringTerm('a'));
    expect(alternativesResult.terms[1]).toEqual(new StringTerm('b'));

    // Test special cases
    const integerTuple = typescriptTypesToTerms(['number', '...', 'number']);
    expect(integerTuple).toBeInstanceOf(Sequence);
    const integerTupleSeq = integerTuple as Sequence;
    expect(integerTupleSeq.terms).toHaveLength(3);
    expect(integerTupleSeq.terms[0]).toBe(integer);
    expect(integerTupleSeq.terms[1]).toEqual(new StringTerm(', '));
    expect(integerTupleSeq.terms[2]).toBeInstanceOf(KleeneStar);
    const kleeneStarTerm = integerTupleSeq.terms[2] as KleeneStar;
    expect(kleeneStarTerm.term).toEqual(new Sequence([new StringTerm(', '), integer]));

    // Test more complex case
    const result2 = typescriptTypesToTerms(['number', '...', handleUnion(['number', 'string'], 0)]);
    expect(result2).toBeInstanceOf(Sequence);
    const sequenceResult2 = result2 as Sequence;
    expect(sequenceResult2.terms).toHaveLength(3);
    expect(sequenceResult2.terms[0]).toBe(integer);
    expect(sequenceResult2.terms[1]).toEqual(new StringTerm(', '));
    expect(sequenceResult2.terms[2]).toBeInstanceOf(KleeneStar);
    const kleeneStarTerm2 = sequenceResult2.terms[2] as KleeneStar;
    expect(kleeneStarTerm2.term).toEqual(new Sequence([new StringTerm(', '), handleUnion(['number', 'string'], 0)]));
  });

  test('test_transform_tuples', () => {
    const integer = typescriptTypesToTerms('number');
    const string = typescriptTypesToTerms('string');

    // Test simple tuple with parentheses
    const result2 = transformTuple(['(', 'number', ')']);
    expect(result2).toBeInstanceOf(Sequence);
    const sequenceResult2 = result2 as Sequence;
    expect(sequenceResult2.terms).toHaveLength(4);
    expect(sequenceResult2.terms[0]).toEqual(new StringTerm('('));
    expect(sequenceResult2.terms[1]).toBe(integer);
    expect(sequenceResult2.terms[2]).toBeInstanceOf(KleeneStar);
    const kleeneStarTerm = sequenceResult2.terms[2] as KleeneStar;
    expect(kleeneStarTerm.term).toEqual(new Sequence([new StringTerm(', '), integer]));
    expect(sequenceResult2.terms[3]).toEqual(new StringTerm(')'));

    // Test tuple with two different types
    const result3 = transformTuple(['(', 'number', ', ', 'string', ')']);
    expect(result3).toBeInstanceOf(Sequence);
    const sequenceResult3 = result3 as Sequence;
    expect(sequenceResult3.terms).toHaveLength(5);
    expect(sequenceResult3.terms[0]).toEqual(new StringTerm('('));
    expect(sequenceResult3.terms[1]).toBe(integer);
    expect(sequenceResult3.terms[2]).toEqual(new StringTerm(', '));
    expect(sequenceResult3.terms[3]).toBe(string);
    expect(sequenceResult3.terms[4]).toEqual(new StringTerm(')'));

    // Test tuple with union type
    const result4 = transformTuple(['(', 'number', ', ', handleUnion(['string', 'number'], 0), ')']);
    expect(result4).toBeInstanceOf(Sequence);
    const sequenceResult4 = result4 as Sequence;
    expect(sequenceResult4.terms).toHaveLength(5);
    expect(sequenceResult4.terms[0]).toEqual(new StringTerm('('));
    expect(sequenceResult4.terms[1]).toBe(integer);
    expect(sequenceResult4.terms[2]).toEqual(new StringTerm(', '));
    expect(sequenceResult4.terms[3]).toEqual(handleUnion(['string', 'number'], 0));
    expect(sequenceResult4.terms[4]).toEqual(new StringTerm(')'));
  });

  test('test_transform_tuple_dict', () => {
    const integer = typescriptTypesToTerms('number');
    const string = typescriptTypesToTerms('string');

    // Test tuple with dict-like structure
    const result = transformTupleDict(['tuple_dict', 'number', 'string']);
    expect(result).toBeInstanceOf(Sequence);
    const sequenceResult = result as Sequence;
    expect(sequenceResult.terms).toHaveLength(3);
    expect(sequenceResult.terms[0]).toEqual(new StringTerm('{'));
    expect(sequenceResult.terms[1]).toBeInstanceOf(KleeneStar);
    const kleeneStarTerm = sequenceResult.terms[1] as KleeneStar;
    expect(kleeneStarTerm.term).toBeInstanceOf(Sequence);
    const innerSequence = kleeneStarTerm.term as Sequence;
    expect(innerSequence.terms).toHaveLength(4);
    expect(innerSequence.terms[0]).toBe(integer);
    expect(innerSequence.terms[1]).toEqual(new StringTerm(':'));
    expect(innerSequence.terms[2]).toBe(string);
    expect(innerSequence.terms[3]).toBeInstanceOf(KleeneStar);
    const innerKleeneStar = innerSequence.terms[3] as KleeneStar;
    expect(innerKleeneStar.term).toEqual(new Sequence([new StringTerm(', '), integer, new StringTerm(':'), string]));
    expect(sequenceResult.terms[2]).toEqual(new StringTerm('}'));
  });

  test('test_dsl_handle_literal', () => {
    const literal = ['a', 1];
    const result = handleLiteral(literal);
    expect(result).toBeInstanceOf(Alternatives);
    expect(result.terms).toHaveLength(2);
    expect(result.terms[0]).toEqual(new StringTerm('a'));
    expect(result.terms[1]).toEqual(new Regex('1'));
  });

  test('test_dsl_handle_union', () => {
    // Test simple Union
    const simpleUnion = ['number', 'string'];
    const result = handleUnion(simpleUnion, 0);
    expect(result).toBeInstanceOf(Alternatives);
    expect(result.terms).toHaveLength(2);
    expect(result.terms[0]).toBe(integer);
    expect(result.terms[1]).toBe(string);

    // Test with optional (null)
    const optionalType = ['number', null];
    const result2 = handleUnion(optionalType, 0);
    expect(result2).toBeInstanceOf(Alternatives);
    expect(result2.terms).toHaveLength(2);
    expect(result2.terms[0]).toBe(integer);
    expect(result2.terms[1]).toEqual(new StringTerm('null'));

    // Test with complex types
    const complexUnion = [{ type: 'object', properties: { field: { type: 'string' } } }, ['a', 'b']];
    const result3 = handleUnion(complexUnion, 0);
    expect(result3).toBeInstanceOf(Alternatives);
    expect(result3.terms).toHaveLength(2);
    expect(result3.terms[0]).toBeInstanceOf(JsonSchema);
    expect(result3.terms[1]).toBeInstanceOf(Alternatives);
    expect(result3.terms[1].terms).toHaveLength(2);
    expect(result3.terms[1].terms[0]).toEqual(new StringTerm('a'));
    expect(result3.terms[1].terms[1]).toEqual(new StringTerm('b'));
  });

  test('test_dsl_handle_list', () => {
    expect(() => handleList(['number', 'string'], 0)).toThrow('List type must have exactly one type argument');

    // Simple type
    const listType = ['number'];
    const result = handleList(listType, 0);
    expect(result).toBeInstanceOf(Sequence);
    expect(result.terms).toHaveLength(4);
    expect(result.terms[0]).toEqual(new StringTerm('['));
    expect(result.terms[1]).toBe(integer);
    expect(result.terms[2]).toBeInstanceOf(KleeneStar);
    expect(result.terms[2].term).toEqual(new Sequence([new StringTerm(', '), integer]));
    expect(result.terms[3]).toEqual(new StringTerm(']'));

    // More complex type
    const complexListType = [['number', 'string']];
    const result2 = handleList(complexListType, 0);
    expect(result2).toBeInstanceOf(Sequence);
    expect(result2.terms).toHaveLength(4);
    expect(result2.terms[0]).toEqual(new StringTerm('['));
    expect(result2.terms[1]).toEqual(handleUnion(['number', 'string'], 0));
    expect(result2.terms[2]).toBeInstanceOf(KleeneStar);
    expect(result2.terms[2].term).toEqual(new Sequence([new StringTerm(', '), handleUnion(['number', 'string'], 0)]));
    expect(result2.terms[3]).toEqual(new StringTerm(']'));
  });

  test('test_dsl_handle_tuple', () => {
    // Empty tuple
    const emptyTuple: any[] = [];
    const result = handleTuple(emptyTuple, 0);
    expect(result).toBeInstanceOf(StringTerm);
    expect((result as StringTerm).value).toBe('()');

    // Tuple with ellipsis (variable length)
    const ellipsisTuple = ['number', '...'];
    const result2 = handleTuple(ellipsisTuple, 0);
    expect(result2).toBeInstanceOf(Sequence);
    expect(result2.terms).toHaveLength(4);
    expect(result2.terms[0]).toEqual(new StringTerm('('));
    expect(result2.terms[1]).toBe(integer);
    expect(result2.terms[2]).toBeInstanceOf(KleeneStar);
    expect(result2.terms[2].term).toEqual(new Sequence([new StringTerm(', '), integer]));
    expect(result2.terms[3]).toEqual(new StringTerm(')'));

    // Tuple with fixed length
    const fixedTuple = ['number', 'string'];
    const result3 = handleTuple(fixedTuple, 0);
    expect(result3).toBeInstanceOf(Sequence);
    expect(result3.terms).toHaveLength(5);
    expect(result3.terms[0]).toEqual(new StringTerm('('));
    expect(result3.terms[1]).toBe(integer);
    expect(result3.terms[2]).toEqual(new StringTerm(', '));
    expect(result3.terms[3]).toBe(string);
    expect(result3.terms[4]).toEqual(new StringTerm(')'));

    // Tuple with complex types
    const complexTuple = ['number', ['string', 'number']];
    const result4 = handleTuple(complexTuple, 0);
    expect(result4).toBeInstanceOf(Sequence);
    expect(result4.terms).toHaveLength(5);
    expect(result4.terms[0]).toEqual(new StringTerm('('));
    expect(result4.terms[1]).toBe(integer);
    expect(result4.terms[2]).toEqual(new StringTerm(', '));
    expect(result4.terms[3]).toEqual(handleUnion(['string', 'number'], 0));
    expect(result4.terms[4]).toEqual(new StringTerm(')'));
  });

  test('test_dsl_handle_dict', () => {
    // Args of incorrect length
    expect(() => handleDict(['number', 'string', 'number'], 0)).toThrow('Dict type must have exactly two type arguments');

    // Correct type
    const dictType = ['number', 'string'];
    const result = handleDict(dictType, 0);
    expect(result).toBeInstanceOf(Sequence);
    expect(result.terms).toHaveLength(3);
    expect(result.terms[0]).toEqual(new StringTerm('{'));
    expect(result.terms[1]).toBeInstanceOf(Optional);
    expect(result.terms[1].term).toBeInstanceOf(Sequence);
    expect(result.terms[1].term.terms).toHaveLength(4);
    expect(result.terms[1].term.terms[0]).toBe(integer);
    expect(result.terms[1].term.terms[1]).toEqual(new StringTerm(':'));
    expect(result.terms[1].term.terms[2]).toBe(string);
    expect(result.terms[1].term.terms[3]).toBeInstanceOf(KleeneStar);
    expect(result.terms[1].term.terms[3].term).toEqual(new Sequence([new StringTerm(', '), integer, new StringTerm(':'), string]));
    expect(result.terms[2]).toEqual(new StringTerm('}'));
  });
});
