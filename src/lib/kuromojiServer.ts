import path from 'node:path';
import kuromoji, { type IpadicFeatures, type Tokenizer } from 'kuromoji';

let tokenizer: Promise<Tokenizer<IpadicFeatures>> | undefined;

export function getTokenizer() {
  tokenizer ??= new Promise((resolve, reject) => kuromoji
    .builder({ dicPath: path.join(process.cwd(), 'node_modules/kuromoji/dict') })
    .build((error, built) => error ? reject(error) : resolve(built)));
  tokenizer.catch(() => { tokenizer = undefined; });
  return tokenizer;
}
