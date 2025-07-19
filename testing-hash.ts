function strongTupleHash(arr: number[]): bigint {
  const PRIME1 = BigInt('0x9e3779b185ebca87'); // from xxHash / Knuth constant
  const PRIME2 = BigInt('0xc2b2ae3d27d4eb4f'); // another strong prime
  let hash = BigInt(0xcbf29ce484222325); // FNV offset basis

  for (let i = 0; i < arr.length; i++) {
    let val = BigInt(arr[i]);
    val = (val ^ (val >> BigInt(33))) * PRIME1;
    val = (val ^ (val >> BigInt(29))) * PRIME2;
    val = val ^ (val >> BigInt(32));

    hash ^= val;
    hash = (hash * PRIME1) % BigInt('0x10000000000000000'); // 2^64
  }

  if (arr.length === 0) {
    return BigInt('0x43fdfd1db8e1a5b'); // fixed value for []
  }

  return hash;
}

console.log(strongTupleHash([]).toString());