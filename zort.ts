import { AutoModel, AutoTokenizer } from '@huggingface/transformers';

let tokenizer = await AutoTokenizer.from_pretrained('Xenova/bert-base-uncased');
let model = await AutoModel.from_pretrained('Xenova/bert-base-uncased');

let inputs = await tokenizer('I love transformers!');
let { logits } = await model(inputs);

console.log(logits);
