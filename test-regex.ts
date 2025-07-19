import {
  regex,
  either,
  exactly,
  Sequence,
  toRegex,
  between,
} from './src/types/dsl';

// Create complex patterns
const phoneNumber = regex('\\d{3}-\\d{3}-\\d{4}');
const choice = either('yes', 'no', 'maybe');
const repeated = exactly(5, 'A');

// Method chaining
const pattern = regex('\\d+').atLeast(2).optional();

// Convert to regex
const regexString = toRegex(pattern);

// Validation
const isValid = pattern.matches('123');

// Console all :

console.log('---phoneNumber---', phoneNumber);
console.log('---choice---', choice);
console.log('---repeated---', repeated);
console.log('---pattern---', pattern);
console.log('---regexString---', regexString);
console.log('---isValid---', isValid);

const pattern2 = either('hello', 'world').oneOrMore();
console.log('---pattern2---', pattern2.toString());
// →
// └── KleenePlus(+)
//     └── Alternatives(|)
//         ├── String('hello')
//         └── String('world')
