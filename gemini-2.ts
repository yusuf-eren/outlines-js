import { AutoTokenizer, AutoModelForCausalLM } from '@huggingface/transformers';

// -- Outlines Logit Processor Mantığı Başlangıcı --

// JSON Şeması
const jsonSchema = {
    "name": "string",
    "age": "number"
};

// JSON FSM Durumları
enum JsonFSMState {
    EXPECT_OPEN_BRACE = "EXPECT_OPEN_BRACE",
    EXPECT_FIRST_KEY_START_QUOTE = "EXPECT_FIRST_KEY_START_QUOTE", // " bekleniyor
    EXPECT_KEY_NAME_CHARS = "EXPECT_KEY_NAME_CHARS", // key karakterleri
    EXPECT_KEY_NAME_END_QUOTE = "EXPECT_KEY_NAME_END_QUOTE", // " bekleniyor
    EXPECT_COLON = "EXPECT_COLON", // : bekleniyor
    EXPECT_STRING_VALUE_START_QUOTE = "EXPECT_STRING_VALUE_START_QUOTE", // " işareti
    EXPECT_STRING_VALUE_CHARS = "EXPECT_STRING_VALUE_CHARS", // string karakterleri
    EXPECT_STRING_VALUE_END_QUOTE = "EXPECT_STRING_VALUE_END_QUOTE", // " bekleniyor
    EXPECT_NUMBER_VALUE_CHARS = "EXPECT_NUMBER_VALUE_CHARS", // sayı karakterleri
    EXPECT_COMMA_OR_CLOSE_BRACE = "EXPECT_COMMA_OR_CLOSE_BRACE", // , veya } bekleniyor
    EXPECT_NEXT_KEY_START_QUOTE = "EXPECT_NEXT_KEY_START_QUOTE", // " bekleniyor (virgülden sonra)
    FINAL = "FINAL", // JSON tamamlandı
    ERROR = "ERROR", // Hata durumu
}

class ManualJsonFSMGuide {
    public currentState: JsonFSMState = JsonFSMState.EXPECT_OPEN_BRACE;
    public parsedJsonText: string = "";
    private keyOrder: string[];
    private currentKeyIndex: number = 0;
    private currentKeyBeingParsed: string = "";
    private currentNumberValue: string = "";

    constructor(schema: any) {
        this.keyOrder = Object.keys(schema);
    }

    // FSM'i tek bir karakterle ilerletmeyi dener
    private _tryAdvanceChar(char: string): boolean {
        const isWhitespace = /\s/.test(char);

        if (isWhitespace) {
            return true; // Boşluklar her zaman geçerli, durumu değiştirmez
        }

        switch (this.currentState) {
            case JsonFSMState.EXPECT_OPEN_BRACE:
                if (char === '{') {
                    this.currentState = JsonFSMState.EXPECT_FIRST_KEY_START_QUOTE;
                    this.parsedJsonText += char;
                    return true;
                }
                break;
            case JsonFSMState.EXPECT_FIRST_KEY_START_QUOTE:
            case JsonFSMState.EXPECT_NEXT_KEY_START_QUOTE:
                if (char === '"') {
                    this.currentState = JsonFSMState.EXPECT_KEY_NAME_CHARS;
                    this.currentKeyBeingParsed = "";
                    this.parsedJsonText += char;
                    return true;
                }
                break;
            case JsonFSMState.EXPECT_KEY_NAME_CHARS:
                if (char === '"') {
                    const expectedKey = this.keyOrder[this.currentKeyIndex];
                    if (this.currentKeyBeingParsed === expectedKey) {
                        this.currentState = JsonFSMState.EXPECT_KEY_NAME_END_QUOTE;
                        this.parsedJsonText += char;
                        return true;
                    } else {
                        console.error(`FSM ERROR: Beklenmeyen anahtar adı: "${this.currentKeyBeingParsed}", beklenen: "${expectedKey}"`);
                    }
                } else {
                    if (/[a-zA-Z0-9_]/.test(char)) { // Anahtar karakterleri
                        this.currentKeyBeingParsed += char;
                        this.parsedJsonText += char;
                        return true;
                    }
                }
                break;
            case JsonFSMState.EXPECT_KEY_NAME_END_QUOTE:
                if (char === ':') {
                    this.currentState = JsonFSMState.EXPECT_COLON;
                    this.parsedJsonText += char;
                    return true;
                }
                break;
            case JsonFSMState.EXPECT_COLON:
                const currentKeyType = jsonSchema[this.keyOrder[this.currentKeyIndex]];
                if (currentKeyType === "string") {
                    if (char === '"') {
                        this.currentState = JsonFSMState.EXPECT_STRING_VALUE_CHARS;
                        this.parsedJsonText += char;
                        return true;
                    }
                } else if (currentKeyType === "number") {
                    if (/[0-9+\-.eE]/.test(char)) {
                        this.currentNumberValue = char;
                        this.currentState = JsonFSMState.EXPECT_NUMBER_VALUE_CHARS;
                        this.parsedJsonText += char;
                        return true;
                    }
                }
                break;
            case JsonFSMState.EXPECT_STRING_VALUE_CHARS:
                if (char === '"') {
                    this.currentState = JsonFSMState.EXPECT_STRING_VALUE_END_QUOTE;
                    this.parsedJsonText += char;
                    return true;
                } else {
                    this.parsedJsonText += char;
                    return true;
                }
            case JsonFSMState.EXPECT_STRING_VALUE_END_QUOTE:
                this.currentKeyIndex++; // String değer bitti, sonraki anahtara geç
                this.currentState = JsonFSMState.EXPECT_COMMA_OR_CLOSE_BRACE;
                // Gelen karakteri (_tryAdvanceChar içinde) yeniden işlemeliyiz.
                return this._tryAdvanceChar(char);
            case JsonFSMState.EXPECT_NUMBER_VALUE_CHARS:
                if (/[0-9+\-.eE]/.test(char)) {
                    this.currentNumberValue += char;
                    this.parsedJsonText += char;
                    return true;
                } else {
                    // Sayı karakteri değil. Sayı bitti mi?
                    if (this.currentNumberValue !== "" && !isNaN(parseFloat(this.currentNumberValue))) {
                         this.currentKeyIndex++; // Sayı değeri bitti
                         this.currentState = JsonFSMState.EXPECT_COMMA_OR_CLOSE_BRACE;
                         return this._tryAdvanceChar(char); 
                    } else {
                        console.error(`FSM ERROR: Geçersiz sayı karakteri veya eksik sayı: '${char}'`);
                    }
                }
                break;
            case JsonFSMState.EXPECT_COMMA_OR_CLOSE_BRACE:
                if (char === ',') {
                    // Virgül geldi, daha fazla anahtar varsa sonraki anahtarı bekle
                    if (this.currentKeyIndex < this.keyOrder.length) {
                        this.currentState = JsonFSMState.EXPECT_NEXT_KEY_START_QUOTE;
                        this.parsedJsonText += char;
                        return true;
                    } else {
                        console.error("FSM ERROR: Tüm anahtarlar işlendi, ancak fazladan virgul geldi.");
                    }
                } else if (char === '}') {
                    // Kapanış süslü parantez geldi
                    if (this.currentKeyIndex === this.keyOrder.length) { // Tüm anahtarlar işlendi mi?
                        this.currentState = JsonFSMState.FINAL;
                        this.parsedJsonText += char;
                        return true;
                    } else {
                        console.error("FSM ERROR: Tüm anahtarlar işlenmeden obje kapandı.");
                    }
                }
                break;
            case JsonFSMState.FINAL:
                if (isWhitespace) {
                    return true;
                }
                break;
        }
        this.currentState = JsonFSMState.ERROR;
        return false;
    }

    updateState(newTokenText: string): void {
        for (const char of newTokenText) {
            if (!this._tryAdvanceChar(char)) {
                this.currentState = JsonFSMState.ERROR;
                // console.error(`FSM ERROR: Token "${newTokenText}" içindeki karakter '${char}' durum ${this.currentState} için geçersiz.`);
                break; 
            }
        }
    }

    // Mevcut duruma göre hangi token ID'lerinin geçerli olduğunu belirle
    getValidTokenIds(tokenizer: AutoTokenizer, vocabSize: number): Set<number> {
        const validTokenIds = new Set<number>();
        const allowedChars = new Set<string>(); // O an için geçerli tek karakterler
        
        // 1. Duruma göre anlamlı karakterleri belirle
        switch (this.currentState) {
            case JsonFSMState.EXPECT_OPEN_BRACE: allowedChars.add('{'); break;
            case JsonFSMState.EXPECT_FIRST_KEY_START_QUOTE:
            case JsonFSMState.EXPECT_NEXT_KEY_START_QUOTE: allowedChars.add('"'); break;
            case JsonFSMState.EXPECT_KEY_NAME_CHARS:
                const expectedKey = this.keyOrder[this.currentKeyIndex];
                if (expectedKey) {
                    if (this.currentKeyBeingParsed.length < expectedKey.length) {
                        allowedChars.add(expectedKey[this.currentKeyBeingParsed.length]);
                    }
                    if (this.currentKeyBeingParsed.length === expectedKey.length) {
                         allowedChars.add('"'); 
                    }
                } else {
                     allowedChars.add('"'); // Bu durum aslında keyOrder dışına çıktığımızı gösterir, hata
                }
                break;
            case JsonFSMState.EXPECT_KEY_NAME_END_QUOTE: allowedChars.add(':'); break;
            case JsonFSMState.EXPECT_COLON: 
                const currentKeyType = jsonSchema[this.keyOrder[this.currentKeyIndex]];
                if (currentKeyType === "string") { allowedChars.add('"'); } 
                else if (currentKeyType === "number") {
                    for (let i = 0; i <= 9; i++) allowedChars.add(String(i));
                    allowedChars.add('+'); allowedChars.add('-'); allowedChars.add('.'); allowedChars.add('e'); allowedChars.add('E');
                }
                break;
            case JsonFSMState.EXPECT_STRING_VALUE_CHARS:
                for (let charCode = 32; charCode <= 126; charCode++) {
                    if (String.fromCharCode(charCode) !== '"') allowedChars.add(String.fromCharCode(charCode));
                }
                allowedChars.add('"'); break; 
            case JsonFSMState.EXPECT_STRING_VALUE_END_QUOTE: 
                allowedChars.add(','); allowedChars.add('}'); break;
            case JsonFSMState.EXPECT_NUMBER_VALUE_CHARS:
                for (let i = 0; i <= 9; i++) allowedChars.add(String(i));
                allowedChars.add('+'); allowedChars.add('-'); allowedChars.add('.'); allowedChars.add('e'); allowedChars.add('E');
                allowedChars.add(','); allowedChars.add('}'); break;
            case JsonFSMState.EXPECT_COMMA_OR_CLOSE_BRACE:
                if (this.currentKeyIndex < this.keyOrder.length) { allowedChars.add(','); }
                allowedChars.add('}');
                break;
            case JsonFSMState.FINAL:
            case JsonFSMState.ERROR:
                validTokenIds.add(tokenizer.eos_token_id);
                return validTokenIds;
        }

        // 2. Vokabüleri dolaşarak, FSM'yi ilerletebilecek tokenları bul (anlamlı tokenlar)
        const tempValidIdsForMeaningfulTokens: Set<number> = new Set();
        for (let i = 0; i < vocabSize; i++) {
            const tokenText = tokenizer.decode([i], { skip_special_tokens: false });
            if (tokenText.length === 0) continue;
            
            // Eğer token boşluk değilse VE FSM'yi ileri götürebiliyorsa
            if (!/\s/.test(tokenText) || tokenText.trim() === '') { // Boşluk tokenleri ve anlamlı tokenler
                 let tempTestGuide = new ManualJsonFSMGuide(jsonSchema);
                 Object.assign(tempTestGuide, this); // Mevcut guide'ın tüm durumunu kopyala

                 let success = true;
                 for (const char of tokenText) {
                     if (!tempTestGuide._tryAdvanceChar(char)) {
                         success = false;
                         break;
                     }
                 }
                 if (success && tempTestGuide.currentState !== JsonFSMState.ERROR) {
                     tempValidIdsForMeaningfulTokens.add(i);
                 }
            }
        }

        // 3. Geçerli boşluk tokenlerini ekle (her zaman geçerli)
        const spaceTokens: Set<number> = new Set();
        for (let i = 0; i < vocabSize; i++) {
            const decoded = tokenizer.decode([i], { skip_special_tokens: false });
            if (decoded.length > 0 && /\s/.test(decoded) && decoded.trim() === '') {
                spaceTokens.add(i);
            }
        }
        spaceTokens.forEach(id => validTokenIds.add(id)); // Boşlukları geçerli kıl

        // 4. Anlamlı tokenları ekle
        tempValidIdsForMeaningfulTokens.forEach(id => validTokenIds.add(id));

        if (validTokenIds.size === 0) {
            console.warn("WARN: FSM Hiçbir geçerli token bulamadı. Bu bir çıkmaz olabilir.");
            validTokenIds.add(tokenizer.eos_token_id);
        }

        return validTokenIds;
    }

    isFinal(): boolean {
        return this.currentState === JsonFSMState.FINAL;
    }
}

// ManualLogitsProcessor (aynı kaldı, `parsedJsonText` kullanacak)
class ManualLogitsProcessor {
    private guide: ManualJsonFSMGuide;
    private tokenizer: AutoTokenizer;
    private initialInputLength: number = 0;

    constructor(guide: ManualJsonFSMGuide, tokenizer: AutoTokenizer) {
        this.guide = guide;
        this.tokenizer = tokenizer;
    }

    processLogits(inputTokens: number[], logits: Float32Array): Float32Array {
        if (this.initialInputLength === 0) {
            this.initialInputLength = inputTokens.length;
        }

        let tempGuide = new ManualJsonFSMGuide(jsonSchema);
        Object.assign(tempGuide, this.guide); 
        
        const generatedTokensOnly = inputTokens.slice(this.initialInputLength);

        // FSM'nin durumunu baştan başlat ve inputTokens'ın tümünü işle
        tempGuide.parsedJsonText = ""; // FSM'nin işlediği metni sıfırla
        for (const tokenId of generatedTokensOnly) {
            const tokenText = this.tokenizer.decode([tokenId], { skip_special_tokens: false });
            tempGuide.updateState(tokenText);
            if (tempGuide.currentState === JsonFSMState.ERROR) {
                break;
            }
        }
        // Ana rehberin durumunu ve diğer özelliklerini eşitle
        Object.assign(this.guide, tempGuide); 
    
        console.log(`>>> JSON_LOGITS_PROCESSOR: Mevcut üretilen metin güncellendi: "${this.guide.parsedJsonText.replace(/\n/g, '\\n')}"`);
        console.log(`>>> JSON_LOGITS_PROCESSOR: FSM Güncel Durum: ${this.guide.currentState}`);

        const validTokenIds = this.guide.getValidTokenIds(this.tokenizer, logits.length);
        
        console.log(`>>> JSON_LOGITS_PROCESSOR: FSM tarafından belirlenen geçerli token ID'leri: [${Array.from(validTokenIds).join(', ')}]`);
        
        const modifiedLogits = new Float32Array(logits);

        for (let i = 0; i < logits.length; i++) {
            if (!validTokenIds.has(i)) {
                modifiedLogits[i] = -Infinity;
            }
        }
        
        console.log(`>>> JSON_LOGITS_PROCESSOR: Logitler maskelendi.`);
        return modifiedLogits;
    }
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

// Modelin tokenizer'ı ve prompt formatına uygun template
function template(userInput: string): string {
  return (
    '<|im_start|>system\n' +
    'You are a helpful assistant.<|im_end|>\n' +
    `<|im_start|>user\n${userInput}<|im_end|>\n` +
    '<|im_start|>assistant\n'
  );
}

async function main() {
  const tokenizer = await AutoTokenizer.from_pretrained(modelName);
  const model = await AutoModelForCausalLM.from_pretrained(modelName);

  let inputText = template('Give me a person with a name and an age. Respond with JSON.') + '{\n  "'; 


  const maxTokens = 100; 

  const guide = new ManualJsonFSMGuide(jsonSchema);
  const logitsProcessor = new ManualLogitsProcessor(guide, tokenizer);


  console.log(
    "--- Başlangıç Prompt'u ---\n" + inputText + '\n-------------------------\n'
  );

  for (let i = 0; i < maxTokens; i++) {
    const input = await tokenizer(inputText);
    const output = await model(input);

    const logits = output.logits;
    const [_, seqLen, vocabSize] = logits.dims;
    const flat = logits.data;

    let lastLogits = flat.slice((seqLen - 1) * vocabSize, seqLen * vocabSize);

    console.log(`\n--- TOKEN ÜRETİMİ ADIM ${i + 1} ---`);
    console.log(
      `Mevcut Input Text (Modelin Göreceği Kısım): "${inputText.replace(
        /\n/g,
        '\\n'
      )}"`
    );

    const currentInputTokens = Array.from(input.input_ids.data);
    
    // >>> BURADA OUTLINES GİRİŞİMİ BAŞLIYOR! <<<
    lastLogits = logitsProcessor.processLogits(currentInputTokens as number[], lastLogits);
    // >>> OUTLINES GİRİŞİMİ SONA ERDİ! <<<

    // Eğer FSM hata durumundaysa, üretimi durdur
    if (guide.currentState === JsonFSMState.ERROR) {
        console.log("\n--- FSM Hata Durumuna Girdi, Üretim Durduruluyor ---");
        break;
    }

    console.log(`** Filtrelenmiş Next Token Logitleri (ilk 10 adet)**:`);
    const sortedLogits = Array.from(lastLogits)
      .map((value, index) => ({ value, index }))
      .sort((a, b) => b.value - a.value); 

    for (let j = 0; j < Math.min(10, sortedLogits.length); j++) {
      const { value, index } = sortedLogits[j];
      const tokenValue =
        tokenizer.decode([index], { skip_special_tokens: false }) || `[UNKNOWN TOKEN ID: ${index}]`; 
      console.log(
        `  Token ID: ${index}, Token: "${tokenValue.replace(
          /\n/g,
          '\\n'
        )}", Logit: ${value.toFixed(4)}`
      );
    }

    const probs = softmax(lastLogits);
    const nextTokenId = argmax(probs);

    const nextTokenRaw = tokenizer.decode([nextTokenId], { skip_special_tokens: false });
    
    let addedSpace = '';
    const lastCharOfInput = inputText.length > 0 ? inputText[inputText.length - 1] : '';
    const isPunctuation = (char: string) => /[.,!?;:]/.test(char);

    const firstCharOfNextToken = nextTokenRaw.length > 0 ? nextTokenRaw[0] : '';
    if (
        !nextTokenRaw.startsWith(' ') &&
        !lastCharOfInput.endsWith(' ') &&
        !isPunctuation(firstCharOfNextToken) && 
        !isPunctuation(lastCharOfInput)
    ) {
        addedSpace = ' ';
    } else if (
        !lastCharOfInput.endsWith(' ') &&
        !isPunctuation(lastCharOfInput) && 
        isPunctuation(firstCharOfNextToken)
    ) {
        addedSpace = '';
    }
    
    const nextTokenFinal = addedSpace + nextTokenRaw;


    console.log(`\n** Seçilen Token (Argmax):**`);
    console.log(
      `  Token ID: ${nextTokenId}, Token: "${nextTokenFinal.replace(/\n/g, '\\n')}"`
    );

    if (tokenizer.eos_token_id !== undefined && nextTokenId === tokenizer.eos_token_id || guide.isFinal()) {
      console.log("\n--- Üretim Tamamlandı veya EOS Token'ı Tespit Edildi ---");
      break;
    }

    inputText += nextTokenFinal;
  }

  console.log('\n🧠 Nihai Çıktı:\n' + inputText);
}

main();