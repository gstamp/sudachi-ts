import type { InputText } from '../../core/inputText.js';
import type { LatticeNodeImpl } from '../../core/lattice.js';
import type { Grammar } from '../../dictionary/grammar.js';
import type { Lexicon } from '../../dictionary/lexicon.js';
import { WordInfo } from '../../dictionary/wordInfo.js';
import {
	COUNTER_SPECS,
	type CounterAlias,
	type CounterSpec,
} from '../counter/counterData.js';
import { OovProviderPlugin } from './base.js';

type CounterEntry = {
	dictionaryForm: string;
	normalizedForm: string;
	posId: number;
	leftId: number;
	rightId: number;
	cost: number;
};

type AliasCandidate = CounterEntry & {
	surface: string;
	reading: string;
};

const NUMERIC_CONTEXT_PATTERN =
	/[0-9０-９〇一二三四五六七八九十百千万億兆]+(?:[.,，．][0-9０-９〇一二三四五六七八九十百千万億兆]+)*$/u;
const COUNTER_POS_PREFIX = ['接尾辞', '名詞的'] as const;

export class CounterAliasOovProviderPlugin extends OovProviderPlugin {
	private readonly aliasesBySurface = new Map<string, AliasCandidate[]>();
	private readonly encoder = new TextEncoder();
	private initialized = false;

	override setUp(grammar: Grammar, lexicon?: Lexicon): void {
		if (this.initialized) {
			return;
		}
		if (!lexicon) {
			throw new Error(
				'CounterAliasOovProviderPlugin requires the dictionary lexicon during setup',
			);
		}

		for (const [surface, specs] of this.collectAliases()) {
			const candidates: AliasCandidate[] = [];
			for (const { spec, alias } of specs) {
				if (this.hasExistingCounterEntry(lexicon, grammar, alias, spec)) {
					continue;
				}

				const canonical = this.lookupCanonicalEntry(lexicon, grammar, spec);
				if (!canonical) {
					continue;
				}

				candidates.push({
					...canonical,
					surface: alias.surface,
					reading: alias.reading,
				});
			}

			if (candidates.length > 0) {
				this.aliasesBySurface.set(surface, candidates);
			}
		}

		this.initialized = true;
	}

	provideOOV(
		inputText: InputText,
		offset: number,
		_otherWords: number,
		result: LatticeNodeImpl[],
	): number {
		const surface = this.surfaceAt(inputText, offset);
		if (!surface || !this.isNumericContext(inputText, offset)) {
			return 0;
		}

		const candidates = this.aliasesBySurface.get(surface);
		if (!candidates || candidates.length === 0) {
			return 0;
		}

		const length = inputText.getCodePointsOffsetLength(
			offset,
			[...surface].length,
		);

		for (const candidate of candidates) {
			const node = this.createNode();
			node.setParameter(candidate.leftId, candidate.rightId, candidate.cost);
			node.setWordInfo(
				new WordInfo(
					candidate.surface,
					length,
					candidate.posId,
					candidate.normalizedForm,
					candidate.dictionaryForm,
					candidate.reading,
				),
			);
			result.push(node);
		}

		return candidates.length;
	}

	private collectAliases(): Map<
		string,
		Array<{ spec: CounterSpec; alias: CounterAlias }>
	> {
		const aliases = new Map<
			string,
			Array<{ spec: CounterSpec; alias: CounterAlias }>
		>();

		for (const spec of this.allCounterSpecs()) {
			for (const alias of spec.aliases) {
				if (alias.surface === spec.canonicalSurface) {
					continue;
				}
				const values = aliases.get(alias.surface) ?? [];
				values.push({ spec, alias });
				aliases.set(alias.surface, values);
			}
		}

		return aliases;
	}

	private *allCounterSpecs(): Iterable<CounterSpec> {
		for (const spec of COUNTER_SPECS) {
			yield spec;
		}
	}

	private surfaceAt(inputText: InputText, offset: number): string | null {
		const maxSurfaceLength = 3;
		for (let codePoints = maxSurfaceLength; codePoints >= 1; codePoints--) {
			const length = inputText.getCodePointsOffsetLength(offset, codePoints);
			if (length === 0) {
				continue;
			}
			const surface = inputText.getSubstring(offset, offset + length);
			if (this.aliasesBySurface.has(surface)) {
				return surface;
			}
		}
		return null;
	}

	private isNumericContext(inputText: InputText, offset: number): boolean {
		const text = inputText.getText();
		const charIndex = inputText.modifiedOffset(offset);
		if (charIndex <= 0) {
			return false;
		}
		const prefix = text.slice(0, charIndex);
		return NUMERIC_CONTEXT_PATTERN.test(prefix);
	}

	private lookupCanonicalEntry(
		lexicon: Lexicon,
		grammar: Grammar,
		spec: CounterSpec,
	): CounterEntry | null {
		const encodedSurface = this.encoder.encode(spec.canonicalSurface);
		for (const [wordId, length] of lexicon.lookup(encodedSurface, 0)) {
			if (length !== encodedSurface.length) {
				continue;
			}
			const info = lexicon.getWordInfo(wordId);
			if (
				info.getSurface() !== spec.canonicalSurface ||
				info.getReadingForm() !== spec.canonicalReading
			) {
				continue;
			}
			const pos = grammar.getPartOfSpeechString(info.getPOSId()).toList();
			if (
				pos[0] !== COUNTER_POS_PREFIX[0] ||
				pos[1] !== COUNTER_POS_PREFIX[1]
			) {
				continue;
			}

			return {
				dictionaryForm: info.getDictionaryForm(),
				normalizedForm: info.getNormalizedForm(),
				posId: info.getPOSId(),
				leftId: lexicon.getLeftId(wordId),
				rightId: lexicon.getRightId(wordId),
				cost: lexicon.getCost(wordId),
			};
		}
		return null;
	}

	private hasExistingCounterEntry(
		lexicon: Lexicon,
		grammar: Grammar,
		alias: CounterAlias,
		spec: CounterSpec,
	): boolean {
		const encodedSurface = this.encoder.encode(alias.surface);
		for (const [wordId, length] of lexicon.lookup(encodedSurface, 0)) {
			if (length !== encodedSurface.length) {
				continue;
			}
			const info = lexicon.getWordInfo(wordId);
			if (
				info.getSurface() !== alias.surface ||
				info.getReadingForm() !== alias.reading
			) {
				continue;
			}
			const pos = grammar.getPartOfSpeechString(info.getPOSId()).toList();
			if (
				pos[0] !== COUNTER_POS_PREFIX[0] ||
				pos[1] !== COUNTER_POS_PREFIX[1]
			) {
				continue;
			}
			if (info.getNormalizedForm() === spec.canonicalSurface) {
				return true;
			}
		}
		return false;
	}
}
