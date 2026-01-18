import type { Morpheme } from './morpheme.js';
import type { MorphemeList } from './morphemeList.js';

export interface Tokenizer {
	tokenize(mode: SplitMode, text: string): MorphemeList;

	tokenize(text: string): MorphemeList;

	tokenizeSentences(mode: SplitMode, text: string): Iterable<MorphemeList>;

	tokenizeSentences(text: string): Iterable<MorphemeList>;

	lazyTokenizeSentences(
		mode: SplitMode,
		input: ReadableStream<string> | AsyncIterable<string>,
	): AsyncIterable<Morpheme[]>;

	lazyTokenizeSentences(
		input: ReadableStream<string> | AsyncIterable<string>,
	): AsyncIterable<Morpheme[]>;

	setDumpOutput(output: WritableStream<string>): void;

	dumpInternalStructures(text: string): string;
}

export enum SplitMode {
	A,
	B,
	C,
}
