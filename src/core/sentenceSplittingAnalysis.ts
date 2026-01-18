import type { Grammar } from '../dictionary/grammar.js';
import type { Lexicon } from '../dictionary/lexicon.js';
import {
	type NonBreakChecker,
	SentenceDetector,
} from '../sentdetect/sentenceDetector.js';
import type { InputText } from './inputText.js';
import type { MorphemeList } from './morphemeList.js';
import type { SplitMode } from './tokenizer.js';
import { UTF8InputTextBuilder } from './utf8InputText.js';

export class SentenceSplittingAnalysis implements NonBreakChecker {
	private readonly detector = new SentenceDetector();
	private readonly mode: SplitMode;
	private readonly grammar: Grammar;
	private readonly lexicon: Lexicon;
	private readonly tokenizeSentence: (
		mode: SplitMode,
		input: InputText,
	) => MorphemeList;
	readonly result: MorphemeList[] = [];

	input: InputText | null = null;
	private bos = 0;

	constructor(
		mode: SplitMode,
		grammar: Grammar,
		lexicon: Lexicon,
		tokenizeSentence: (mode: SplitMode, input: InputText) => MorphemeList,
	) {
		this.mode = mode;
		this.grammar = grammar;
		this.lexicon = lexicon;
		this.tokenizeSentence = tokenizeSentence;
	}

	tokenizeBuffer(buffer: string): number {
		const builder = new UTF8InputTextBuilder(buffer, this.grammar);
		const input = builder.build();
		this.input = input;

		let normalized = input.getText();
		this.bos = 0;

		let length = this.detector.getEos(normalized, this);
		while (length > 0) {
			let eos = this.bos + length;
			if (eos < normalized.length) {
				eos = input.getNextInOriginal(eos - 1);
				length = eos - this.bos;
			}
			const sentence = input.slice(this.bos, eos);
			this.result.push(this.tokenizeSentence(this.mode, sentence));
			this.bos = eos;
			normalized = normalized.slice(length);
			length = this.detector.getEos(normalized, this);
		}

		if (length < 0 && buffer.length === -length) {
			this.result.push(this.tokenizeSentence(this.mode, input));
			return -length;
		}

		return length;
	}

	bosPosition(): number {
		if (this.input === null) {
			return 0;
		}
		return this.input.textIndexToOriginalTextIndex(this.bos);
	}

	hasNonBreakWord(length: number): boolean {
		const inp = this.input;
		if (inp === null) {
			return false;
		}
		const byteEOS = inp.getCodePointsOffsetLength(0, this.bos + length);
		const bytes = inp.getByteText();

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
