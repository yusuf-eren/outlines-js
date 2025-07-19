import { AutoTokenizer, AutoModelForCausalLM } from '@huggingface/transformers';

// Softmax helper
function softmax(logits: Float32Array): Float32Array {
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return Float32Array.from(exps.map((e) => e / sum));
}

// Argmax selection
function argmax(probs: Float32Array): number {
  return probs.reduce((maxIdx, x, i) => (x > probs[maxIdx] ? i : maxIdx), 0);
}

async function main() {
  const tokenizer = await AutoTokenizer.from_pretrained(
    'Xenova/TinyLlama-1.1B-Chat-v1.0'
  );
  const model = await AutoModelForCausalLM.from_pretrained(
    'Xenova/TinyLlama-1.1B-Chat-v1.0'
  );

  // 💡 Alpaca-style prompt
  let inputText = `### Instruction:
Translate the following English sentence to German:

I love transformers!

### Response:
`;

  const maxTokens = 50;

  for (let i = 0; i < maxTokens; i++) {
    const input = await tokenizer(inputText, { return_tensors: 'np' });
    const output = await model(input);

    const logits = output.logits;
    const [_, seqLen, vocabSize] = logits.dims;
    const flat = logits.data;

    const lastLogits = flat.slice((seqLen - 1) * vocabSize, seqLen * vocabSize);
    const probs = softmax(lastLogits);
    const nextTokenId = argmax(probs);

    const nextToken = await tokenizer.decode([nextTokenId], {
      skip_special_tokens: true,
    });

    // bazen boşluk, newline geliyor → ama devam etmeli
    if (nextTokenId === tokenizer.eos_token_id) break;

    inputText += nextToken;
  }

  console.log('\n🧠 Final output:\n' + inputText);
}

main();
