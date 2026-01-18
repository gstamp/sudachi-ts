import type { Grammar } from '../dictionary/grammar.js';
import type { Lexicon } from '../dictionary/lexicon.js';
import {
	type NonBreakChecker,
	SentenceDetector,
} from '../sentdetect/sentenceDetector.js';
import type { InputText } from './inputText.js';
import type { Morpheme } from './morpheme.js';
import type { MorphemeList } from './morphemeList.js';
import type { SplitMode } from './tokenizer.js';
import { UTF8InputTextBuilder } from './utf8InputText.js';

const BUFFER_SIZE = 4096; // SentenceDetector.DEFAULT_LIMIT

export class SentenceSplittingLazyAnalysis
	implements NonBreakChecker, AsyncIterable<Morpheme[]>
{
	private readonly mode: SplitMode;
	private readonly grammar: Grammar;
	private readonly lexicon: Lexicon;
	private readonly tokenizeSentence: (
		mode: SplitMode,
		input: InputText,
	) => MorphemeList;
	private readonly inputStream: ReadableStream<string>;

	private buffer: string;
	private input: InputText;
	private bos: number;
	private normalized: string;

	constructor(
		mode: SplitMode,
		grammar: Grammar,
		lexicon: Lexicon,
		inputStream: ReadableStream<string>,
		tokenizeSentence: (mode: SplitMode, input: InputText) => MorphemeList,
	) {
		this.mode = mode;
		this.grammar = grammar;
		this.lexicon = lexicon;
		this.inputStream = inputStream;
		this.tokenizeSentence = tokenizeSentence;
		this.buffer = '';
		this.input = new UTF8InputTextBuilder('', grammar).build();
		this.bos = 0;
		this.normalized = '';
	}

	async *[Symbol.asyncIterator](): AsyncIterator<Morpheme[]> {
		let reader: ReadableStreamDefaultReader<string> | null = null;
		try {
			reader =
				this.inputStream.getReader() as ReadableStreamDefaultReader<string>;

			while (true) {
				if (this.normalized.length > 0) {
					const morphemeList = this.processNextSentence();
					if (morphemeList) {
						yield [...morphemeList];
						continue;
					}
				}

				if (reader === null) break;
				const nread = await this.reloadBuffer(reader);
				if (nread < 0 && this.buffer.length === 0) {
					break;
				}
			}
		} finally {
			reader?.releaseLock();
		}
	}

	private async reloadBuffer(
		reader: ReadableStreamDefaultReader<string>,
	): Promise<number> {
		// Compact buffer by removing processed text
		if (this.bos > 0) {
			this.buffer = this.buffer.slice(this.bos);
			this.bos = 0;
		}

		if (this.buffer.length < BUFFER_SIZE) {
			const { value, done } = await (reader as any).read();
			if (value !== undefined && !done) {
				this.buffer += value;
			}
			if (done && !value) {
				return -1;
			}
		}

		// Rebuild input text with new buffer
		const builder = new UTF8InputTextBuilder(this.buffer, this.grammar);
		this.input = builder.build();
		this.bos = 0;
		this.normalized = this.input.getText();

		return this.buffer.length;
	}

	private processNextSentence(): MorphemeList | null {
		const detector = new SentenceDetector();
		const eosLength = detector.getEos(this.normalized, this);

		if (eosLength > 0) {
			let eos = this.bos + eosLength;
			if (eos < this.normalized.length) {
				eos = this.input.getNextInOriginal(eos - 1);
			}
			const sentence = this.input.slice(this.bos, eos);
			this.bos = eos;
			this.normalized = this.normalized.slice(eosLength);
			return this.tokenizeSentence(this.mode, sentence);
		}

		// Buffer is just after reload but no (safe) eos found.
		// Tokenize all text in buffer if bos is 0
		if (this.bos === 0 && eosLength < 0) {
			this.bos = this.normalized.length;
			this.normalized = '';
			return this.tokenizeSentence(this.mode, this.input);
		}

		return null;
	}

	hasNonBreakWord(length: number): boolean {
		const inp = this.input;
		const byteEOS = inp.getCodePointsOffsetLength(0, this.bos + length);
		const bytes = inp.getByteText();

		// Check the last 64 bytes before the potential boundary
		const startIdx = Math.max(0, byteEOS - 64);
		for (let i = startIdx; i < byteEOS; i++) {
			const results = this.lexicon.lookup(bytes, i);
			for (const result of results) {
				const [_wordId, wordLength] = result;
				if (
					wordLength > byteEOS ||
					(wordLength === byteEOS &&
						this.bos + length - inp.modifiedOffset(i) > 1)
				) {
					return true;
				}
			}
		}
		return false;
	}
}
