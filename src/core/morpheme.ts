import type { Grammar } from '../dictionary/grammar.js';
import type { WordInfo } from '../dictionary/wordInfo.js';
import type { SplitMode } from './tokenizer.js';

export interface Morpheme {
	begin(): number;

	end(): number;

	surface(): string;

	partOfSpeech(): string[];

	partOfSpeechId(): number;

	dictionaryForm(): string;

	normalizedForm(): string;

	readingForm(): string;

	split(mode: SplitMode): Morpheme[];

	isOOV(): boolean;

	getWordId(): number;

	getDictionaryId(): number;

	getSynonymGroupIds(): number[];
}

export class MorphemeImpl implements Morpheme {
	private readonly _begin: number;
	private readonly _end: number;
	private readonly _surface: string;
	private readonly _wordInfo: WordInfo;
	private readonly _wordId: number;
	private readonly _dictionaryId: number;
	private readonly _grammar: Grammar | null;
	private _split?: (mode: SplitMode) => Morpheme[];

	constructor(
		begin: number,
		end: number,
		surface: string,
		wordInfo: WordInfo,
		wordId: number,
		dictionaryId: number,
		grammar: Grammar | null = null,
		split?: (mode: SplitMode) => Morpheme[],
	) {
		this._begin = begin;
		this._end = end;
		this._surface = surface;
		this._wordInfo = wordInfo;
		this._wordId = wordId;
		this._dictionaryId = dictionaryId;
		this._grammar = grammar;
		this._split = split;
	}

	begin(): number {
		return this._begin;
	}

	end(): number {
		return this._end;
	}

	surface(): string {
		return this._surface;
	}

	partOfSpeech(): string[] {
		if (this._grammar && this._wordInfo.getPOSId() >= 0) {
			return this._grammar
				.getPartOfSpeechString(this._wordInfo.getPOSId())
				.toList();
		}
		return [];
	}

	partOfSpeechId(): number {
		return this._wordInfo.getPOSId();
	}

	dictionaryForm(): string {
		return this._wordInfo.getDictionaryForm();
	}

	normalizedForm(): string {
		return this._wordInfo.getNormalizedForm();
	}

	readingForm(): string {
		return this._wordInfo.getReadingForm();
	}

	split(mode: SplitMode): Morpheme[] {
		if (this._split) {
			return this._split(mode);
		}
		return [this];
	}

	isOOV(): boolean {
		return this._dictionaryId < 0;
	}

	getWordId(): number {
		return this._wordId;
	}

	getDictionaryId(): number {
		return this._dictionaryId;
	}

	getSynonymGroupIds(): number[] {
		return this._wordInfo.getSynonymGroupIds();
	}

	getWordInfo(): WordInfo {
		return this._wordInfo;
	}
}
