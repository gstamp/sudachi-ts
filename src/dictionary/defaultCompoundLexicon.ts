import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { userBuilder } from '../dictionary-build/dicBuilder.js';
import { BinaryDictionary } from './binaryDictionary.js';
import type { Grammar } from './grammar.js';
import type { Lexicon } from './lexicon.js';

const DEFAULT_COMPOUND_CSV_PATH = fileURLToPath(
	new URL('../resources/defaultCompoundParticles.csv', import.meta.url),
);

const DEFAULT_COMPOUND_CSV_FALLBACK = `かも,0,0,1200,かも,助詞,終助詞,*,*,*,*,かも,かも,*,A,*,*,*,*
のか,0,0,1200,のか,助詞,終助詞,*,*,*,*,のか,のか,*,A,*,*,*,*
かな,0,0,1200,かな,助詞,終助詞,*,*,*,*,かな,かな,*,A,*,*,*,*
のかな,0,0,1200,のかな,助詞,終助詞,*,*,*,*,のかな,のかな,*,A,*,*,*,*
かしら,0,0,1200,かしら,助詞,終助詞,*,*,*,*,かしら,かしら,*,A,*,*,*,*
のかしら,0,0,1200,のかしら,助詞,終助詞,*,*,*,*,のかしら,のかしら,*,A,*,*,*,*
のに,0,0,1200,のに,助詞,接続助詞,*,*,*,*,のに,のに,*,A,*,*,*,*
ても,0,0,1200,ても,助詞,接続助詞,*,*,*,*,ても,ても,*,A,*,*,*,*
でも,0,0,1200,でも,助詞,接続助詞,*,*,*,*,でも,でも,*,A,*,*,*,*
とも,0,0,1200,とも,助詞,接続助詞,*,*,*,*,とも,とも,*,A,*,*,*,*
とは,0,0,1200,とは,助詞,格助詞,*,*,*,*,とは,とは,*,A,*,*,*,*
だから,0,0,1200,だから,接続詞,*,*,*,*,*,だから,だから,*,A,*,*,*,*
`;

interface SystemDictionaryLike {
	getGrammar(): Grammar;
	getLexicon(): Lexicon;
}

const cacheByGrammar = new Map<string, Uint8Array>();

export async function loadDefaultCompoundLexicon(
	systemDict: SystemDictionaryLike,
): Promise<BinaryDictionary> {
	const grammar = systemDict.getGrammar();
	const cacheKey = createGrammarCacheKey(grammar);
	let buffer = cacheByGrammar.get(cacheKey);
	if (!buffer) {
		const csv = await loadDefaultCompoundCsv();
		const builder = userBuilder(systemDict);
		await builder.lexicon(csv, 'defaultCompoundParticles.csv');
		const built = await builder.build();
		buffer = built.buffer;
		cacheByGrammar.set(cacheKey, buffer);
	}
	return new BinaryDictionary(buffer);
}

async function loadDefaultCompoundCsv(): Promise<string> {
	try {
		return await readFile(DEFAULT_COMPOUND_CSV_PATH, 'utf-8');
	} catch {
		return DEFAULT_COMPOUND_CSV_FALLBACK;
	}
}

function createGrammarCacheKey(grammar: Grammar): string {
	const connection = grammar.getConnection();
	const parts: string[] = [
		String(connection.getLeftSize()),
		String(connection.getRightSize()),
	];

	const posSize = grammar.getPartOfSpeechSize();
	parts.push(String(posSize));
	for (let i = 0; i < posSize; i++) {
		parts.push(grammar.getPartOfSpeechString(i).toString());
	}
	return parts.join('\u0001');
}
