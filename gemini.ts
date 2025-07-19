import { AutoTokenizer, AutoModelForCausalLM } from '@huggingface/transformers';

function template(userInput: string): string {
  return (
    '<|im_start|>system\n' +
    'You are a helpful assistant.<|im_end|>\n' +
    `<|im_start|>user\n${userInput}<|im_end|>\n` +
    '<|im_start|>assistant\n'
  );
}

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

const modelName = 'HuggingFaceTB/SmolLM2-135M-Instruct';
async function main() {
  const tokenizer = await AutoTokenizer.from_pretrained(modelName);
  const model = await AutoModelForCausalLM.from_pretrained(modelName);

  // 💡 Alpaca-style prompt
  let inputText = template('Give me a person with a name and an age');

  const maxTokens = 50;

  console.log(
    "--- Başlangıç Prompt'u ---\n" + inputText + '\n-------------------------\n'
  );

  for (let i = 0; i < maxTokens; i++) {
    const input = await tokenizer(inputText);
    const output = await model(input);

    const logits = output.logits;
    const [_, seqLen, vocabSize] = logits.dims;
    const flat = logits.data;

    // Her next token generation'dan önce buradayız.
    // next token için logitler:
    const lastLogits = flat.slice((seqLen - 1) * vocabSize, seqLen * vocabSize);

    console.log(`\n--- TOKEN ÜRETİMİ ADIM ${i + 1} ---`);
    console.log(
      `Mevcut Input Text (Tokenleştirilecek): "${inputText.replace(
        /\n/g,
        '\\n'
      )}"`
    ); // Yeni satırları göster

    // Logitleri ve karşılık gelen tokenleri yazdıralım
    console.log(`** Tüm Olası Next Token Logitleri (ilk 10 adet)**:`);
    const sortedLogits = Array.from(lastLogits)
      .map((value, index) => ({ value, index }))
      .sort((a, b) => b.value - a.value); // Logitleri büyükten küçüğe sırala

    for (let j = 0; j < Math.min(10, sortedLogits.length); j++) {
      const { value, index } = sortedLogits[j];
      const tokenValue =
        tokenizer.model.vocab[index] || `[UNKNOWN TOKEN ID: ${index}]`; // Vokabülde yoksa UNKNOWN yaz
      console.log(
        `  Token ID: ${index}, Token: "${tokenValue.replace(
          /\n/g,
          '\\n'
        )}", Logit: ${value.toFixed(4)}`
      );
    }

    const probs = softmax(lastLogits);
    console.log('---probs', probs);
    const nextTokenId = argmax(probs);
    console.log('---nextTokenId', nextTokenId);

    const nextToken = await tokenizer.decode([nextTokenId], {
      skip_special_tokens: true,
    });

    console.log(`\n** Seçilen Token (Argmax):**`);
    console.log(
      `  Token ID: ${nextTokenId}, Token: "${nextToken.replace(/\n/g, '\\n')}"`
    );

    if (nextTokenId === tokenizer.eos_token_id) {
      console.log("\n--- EOS Token'ı Tespit Edildi, Üretim Durduruluyor ---");
      break;
    }

    inputText += nextToken;
  }

  console.log('\n🧠 Nihai Çıktı:\n' + inputText);
}

main();
