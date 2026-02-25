import type { InputText } from '../../core/inputText.js';
import type { Lattice, LatticeNode } from '../../core/lattice.js';
import { SplitMode } from '../../core/tokenizer.js';
import type { Grammar } from '../../dictionary/grammar.js';
import { WordInfo } from '../../dictionary/wordInfo.js';
import { PathRewritePlugin } from './base.js';

type ChunkType =
	| 'single_token'
	| 'compound_noun'
	| 'fixed_expression'
	| 'counter_phrase'
	| 'te_form'
	| 'suru_verb_te_form'
	| 'progressive_form'
	| 'suru_verb_progressive'
	| 'phrase';

type RuleConstraint = {
	surface?: string | string[];
	dictionaryForm?: string | string[];
	pos0?: string | string[];
	pos1?: string | string[];
	chunkType?: ChunkType | ChunkType[];
};

type SequenceRule = {
	name: string;
	priority: number;
	pattern: RuleConstraint[];
	resultType: ChunkType;
};

type ChunkToken = {
	surface: string;
	reading: string;
	dictionaryForm: string;
	normalizedForm: string;
	posId: number;
	chunkType: ChunkType;
	nodes: LatticeNode[];
};

type CounterPhonology = Record<string, Record<string, string>>;

/**
 * Token chunking plugin with an internal chunk pipeline.
 *
 * This plugin builds intermediate chunks, applies staged pattern/merge rules,
 * performs reading normalization (especially counters), and finally rehydrates
 * the rewritten path back to lattice nodes.
 */
export class TokenChunkerPlugin extends PathRewritePlugin {
	private grammar: Grammar | null = null;
	private enablePatternRules = true;
	private enableBroadRules = false;

	override setUp(grammar: Grammar): void {
		this.grammar = grammar;
		this.enablePatternRules = this.settings.getBoolean(
			'enablePatternRules',
			true,
		);
		this.enableBroadRules = this.settings.getBoolean('enableBroadRules', false);
	}

	override validateSplitMode(mode: SplitMode): void {
		if (mode !== SplitMode.C) {
			throw new Error(
				'TokenChunkerPlugin requires SplitMode.C. Use tokenizer.tokenize(text) or tokenizer.tokenize(SplitMode.C, text).',
			);
		}
	}

	rewrite(_text: InputText, path: LatticeNode[], lattice: Lattice): void {
		if (path.length === 0) {
			return;
		}

		let chunks = this.toInitialChunks(path);
		if (this.enablePatternRules) {
			chunks = this.applyInlineRubyExactStage(chunks);
			chunks = this.applyPatternStage(chunks);
			chunks = this.applyNumericExpressionStage(chunks);
			chunks = this.applyCounterStage(chunks);
			chunks = this.applyMergeStage(chunks);
			chunks = this.applyInlineRubyPrefixStage(chunks);
		}

		this.rehydratePath(path, chunks, lattice);
	}

	private toInitialChunks(path: LatticeNode[]): ChunkToken[] {
		return path.map((node) => {
			const wi = node.getWordInfo();
			return {
				surface: wi.getSurface(),
				reading: wi.getReadingForm(),
				dictionaryForm: wi.getDictionaryForm(),
				normalizedForm: wi.getNormalizedForm(),
				posId: wi.getPOSId(),
				chunkType: 'single_token',
				nodes: [node],
			};
		});
	}

	private applyPatternStage(chunks: ChunkToken[]): ChunkToken[] {
		const rules = [
			...SEQUENCE_RULES,
			...(this.enableBroadRules ? BROAD_SEQUENCE_RULES : []),
		].sort((a, b) => b.priority - a.priority);
		return this.applySequenceRules(chunks, rules);
	}

	private applySequenceRules(
		source: ChunkToken[],
		rules: SequenceRule[],
	): ChunkToken[] {
		const chunks = [...source];
		let matched = true;
		while (matched) {
			matched = false;
			for (let i = 0; i < chunks.length; i++) {
				for (const rule of rules) {
					const end = this.matchRuleAt(chunks, i, rule);
					if (end > i + 1) {
						const merged = this.mergeChunks(
							chunks.slice(i, end),
							rule.resultType,
						);
						chunks.splice(i, end - i, merged);
						matched = true;
						break;
					}
				}
				if (matched) {
					break;
				}
			}
		}
		return chunks;
	}

	private matchRuleAt(
		chunks: ChunkToken[],
		start: number,
		rule: SequenceRule,
	): number {
		const end = start + rule.pattern.length;
		if (end > chunks.length) {
			return -1;
		}
		for (let i = 0; i < rule.pattern.length; i++) {
			const chunk = chunks[start + i];
			const constraint = rule.pattern[i];
			if (!chunk || !constraint || !this.matchesConstraint(chunk, constraint)) {
				return -1;
			}
		}
		return end;
	}

	private matchesConstraint(
		chunk: ChunkToken,
		constraint: RuleConstraint,
	): boolean {
		if (
			constraint.surface !== undefined &&
			!this.matchesStringConstraint(chunk.surface, constraint.surface)
		) {
			return false;
		}
		if (
			constraint.dictionaryForm !== undefined &&
			!this.matchesStringConstraint(
				chunk.dictionaryForm,
				constraint.dictionaryForm,
			)
		) {
			return false;
		}
		if (
			constraint.chunkType !== undefined &&
			!this.matchesChunkTypeConstraint(chunk.chunkType, constraint.chunkType)
		) {
			return false;
		}
		if (constraint.pos0 !== undefined || constraint.pos1 !== undefined) {
			const pos = this.getPosById(chunk.posId);
			if (!pos) {
				return false;
			}
			if (
				constraint.pos0 !== undefined &&
				!this.matchesStringConstraint(pos[0] ?? '', constraint.pos0)
			) {
				return false;
			}
			if (
				constraint.pos1 !== undefined &&
				!this.matchesStringConstraint(pos[1] ?? '', constraint.pos1)
			) {
				return false;
			}
		}
		return true;
	}

	private matchesChunkTypeConstraint(
		value: ChunkType,
		constraint: ChunkType | ChunkType[],
	): boolean {
		if (Array.isArray(constraint)) {
			return constraint.includes(value);
		}
		return value === constraint;
	}

	private matchesStringConstraint(
		value: string,
		constraint: string | string[],
	): boolean {
		if (typeof constraint === 'string') {
			return value === constraint;
		}
		return constraint.includes(value);
	}

	private applyCounterStage(source: ChunkToken[]): ChunkToken[] {
		const chunks = [...source];
		for (let i = 0; i < chunks.length - 1; i++) {
			if (!this.isNumberChunk(chunks[i])) {
				continue;
			}

			let end = i;
			while (end + 1 < chunks.length && this.isNumberChunk(chunks[end + 1])) {
				end++;
			}

			const counterIndex = end + 1;
			if (
				counterIndex >= chunks.length ||
				!this.isCounterChunk(chunks[counterIndex])
			) {
				continue;
			}

			let suffixEnd = counterIndex;
			if (counterIndex + 1 < chunks.length) {
				const next = chunks[counterIndex + 1];
				if (next && COUNTER_SUFFIXES.has(next.surface)) {
					suffixEnd = counterIndex + 1;
				}
			}

			const merged = this.mergeCounterChunks(
				chunks.slice(i, suffixEnd + 1),
				chunks[suffixEnd + 1],
			);
			chunks.splice(i, suffixEnd - i + 1, merged);
		}
		return chunks;
	}

	private applyNumericExpressionStage(source: ChunkToken[]): ChunkToken[] {
		const chunks = [...source];
		let i = 0;
		while (i < chunks.length) {
			const start = this.consumeNumericExpression(chunks, i);
			if (start.endIndex - i >= 2) {
				const merged = this.mergeChunks(
					chunks.slice(i, start.endIndex),
					'compound_noun',
				);
				chunks.splice(i, start.endIndex - i, merged);
				i++;
				continue;
			}
			i++;
		}
		return chunks;
	}

	private consumeNumericExpression(
		chunks: ChunkToken[],
		index: number,
	): { endIndex: number } {
		let i = index;

		// If we're in the middle of a dotted sequence (e.g. 2 . 1 . 0),
		// do not start a new numeric merge from the later segment.
		if (
			this.isNumberChunk(chunks[i]) &&
			this.isNumericDotChunk(chunks[i - 1]) &&
			this.isNumberChunk(chunks[i - 2])
		) {
			return { endIndex: index };
		}

		if (this.isNumericSignChunk(chunks[i])) {
			if (!this.isNumberChunk(chunks[i + 1])) {
				return { endIndex: index };
			}
			// Avoid treating hyphens inside latin tokens (e.g. UTF-8) as numeric signs.
			if (this.isLatinTextChunk(chunks[i - 1])) {
				return { endIndex: index };
			}
			i++;
		}

		if (!this.isNumberChunk(chunks[i])) {
			return { endIndex: index };
		}

		let consumed = 0;
		let dotCount = 0;
		while (i < chunks.length) {
			if (this.isNumberChunk(chunks[i])) {
				consumed++;
				i++;
				continue;
			}
			if (
				this.isNumericCommaChunk(chunks[i]) &&
				this.isNumberChunk(chunks[i + 1])
			) {
				i++;
				continue;
			}
			if (
				this.isNumericDotChunk(chunks[i]) &&
				this.isNumberChunk(chunks[i + 1])
			) {
				dotCount++;
				if (dotCount > 1) {
					// Avoid partial merges for version-like tokens such as 2.1.0.
					return { endIndex: index };
				}
				i++;
				continue;
			}
			break;
		}

		if (consumed === 0) {
			return { endIndex: index };
		}
		return { endIndex: i };
	}

	private isNumberChunk(chunk: ChunkToken | undefined): boolean {
		if (!chunk) return false;
		const pos = this.getPosById(chunk.posId);
		if (!pos) return false;
		if (pos[0] === '名詞' && pos[1] === '数詞') {
			return true;
		}
		return NUMBER_SURFACE_PATTERN.test(chunk.surface);
	}

	private isNumericCommaChunk(chunk: ChunkToken | undefined): boolean {
		return Boolean(chunk && NUMERIC_COMMA_SURFACES.has(chunk.surface));
	}

	private isNumericDotChunk(chunk: ChunkToken | undefined): boolean {
		return Boolean(chunk && NUMERIC_DOT_SURFACES.has(chunk.surface));
	}

	private isNumericSignChunk(chunk: ChunkToken | undefined): boolean {
		return Boolean(chunk && NUMERIC_SIGN_SURFACES.has(chunk.surface));
	}

	private isLatinTextChunk(chunk: ChunkToken | undefined): boolean {
		return Boolean(chunk && LATIN_TEXT_PATTERN.test(chunk.surface));
	}

	private isCounterChunk(chunk: ChunkToken | undefined): boolean {
		if (!chunk) return false;
		return COUNTER_WORDS.has(chunk.surface);
	}

	private mergeCounterChunks(
		chunks: ChunkToken[],
		nextChunk: ChunkToken | undefined,
	): ChunkToken {
		const merged = this.mergeChunks(chunks, 'counter_phrase');
		if (chunks.length < 2) {
			return merged;
		}

		const coreCounter = chunks.find((c) => COUNTER_WORDS.has(c.surface));
		if (!coreCounter) {
			return merged;
		}

		const counterIndex = chunks.indexOf(coreCounter);
		if (counterIndex <= 0) {
			return merged;
		}

		const numberChunks = chunks.slice(0, counterIndex);
		const counterOrSuffix = chunks[chunks.length - 1];

		const numberReading = numberChunks.map((c) => c.reading).join('');
		const counterSurface = coreCounter.surface;
		const counterReading = coreCounter.reading;

		let normalizedReading = numberReading + counterReading;
		if (
			counterSurface === '日' &&
			(nextChunk === undefined || !this.isNumberChunk(nextChunk))
		) {
			for (const [prefix, replacement] of DAY_COUNTER_RULES) {
				if (numberReading === prefix) {
					normalizedReading = replacement;
					break;
				}
			}
		} else {
			const rules = COUNTER_PHONOLOGY[counterSurface];
			if (rules && numberReading in rules) {
				normalizedReading = rules[numberReading]!;
			}
		}

		if (counterOrSuffix && COUNTER_SUFFIXES.has(counterOrSuffix.surface)) {
			normalizedReading += counterOrSuffix.reading;
		}

		return {
			...merged,
			reading: normalizedReading,
		};
	}

	private applyMergeStage(source: ChunkToken[]): ChunkToken[] {
		const chunks = [...source];
		let i = 0;
		while (i < chunks.length - 1) {
			const current = chunks[i];
			const next = chunks[i + 1];
			const following = chunks[i + 2];
			if (!current || !next) {
				i++;
				continue;
			}
			if (this.shouldMergeAttributiveKana(current, next, following)) {
				const merged = this.mergeChunks([current, next], 'phrase');
				chunks.splice(i, 2, merged);
				continue;
			}

			if (
				(current.chunkType === 'te_form' ||
					current.chunkType === 'suru_verb_te_form') &&
				(next.chunkType === 'single_token' ||
					next.chunkType === 'phrase' ||
					next.chunkType === 'te_form') &&
				['いる', '居る', 'いく'].includes(next.dictionaryForm)
			) {
				const resultType: ChunkType =
					current.chunkType === 'suru_verb_te_form'
						? 'suru_verb_progressive'
						: 'progressive_form';
				const merged = this.mergeChunks([current, next], resultType);
				chunks.splice(i, 2, merged);
				continue;
			}
			if (
				current.surface.endsWith('んだ') &&
				(next.surface === 'よ' || next.surface === 'よっ')
			) {
				const merged = this.mergeChunks([current, next], 'fixed_expression');
				chunks.splice(i, 2, merged);
				continue;
			}

			i++;
		}
		return chunks;
	}

	private shouldMergeAttributiveKana(
		current: ChunkToken,
		next: ChunkToken,
		following: ChunkToken | undefined,
	): boolean {
		if (next.surface !== 'かな') {
			return false;
		}
		const nextPos = this.getPosById(next.posId);
		if (!nextPos || nextPos[0] !== '助詞' || nextPos[1] !== '終助詞') {
			return false;
		}

		const currentPos0 = this.getPosById(current.posId)?.[0] ?? '';
		if (!['名詞', '形状詞'].includes(currentPos0)) {
			return false;
		}
		if (!following) {
			return false;
		}

		const followingPos0 = this.getPosById(following.posId)?.[0] ?? '';
		return ['名詞', '代名詞'].includes(followingPos0);
	}

	private applyInlineRubyExactStage(source: ChunkToken[]): ChunkToken[] {
		const chunks = [...source];
		let i = 0;
		while (i < chunks.length - 1) {
			const current = chunks[i];
			const next = chunks[i + 1];
			if (!current || !next) {
				i++;
				continue;
			}
			if (this.shouldMergeInlineRubyExact(current, next)) {
				const merged = this.mergeChunks([current, next], 'phrase');
				chunks.splice(i, 2, merged);
				continue;
			}
			i++;
		}
		return chunks;
	}

	private applyInlineRubyPrefixStage(source: ChunkToken[]): ChunkToken[] {
		const chunks = [...source];
		let i = 0;
		while (i < chunks.length - 1) {
			const current = chunks[i];
			const next = chunks[i + 1];
			if (!current || !next) {
				i++;
				continue;
			}
			if (this.shouldMergeInlineRubyPrefix(current, next)) {
				const merged = this.mergeChunks([current, next], 'phrase');
				chunks.splice(i, 2, merged);
				continue;
			}
			i++;
		}
		return chunks;
	}

	private shouldMergeInlineRubyExact(
		current: ChunkToken,
		next: ChunkToken,
	): boolean {
		if (
			!KANJI_PATTERN.test(current.surface) ||
			!KANA_PATTERN.test(next.surface)
		) {
			return false;
		}
		if (
			current.chunkType !== 'single_token' ||
			next.chunkType !== 'single_token'
		) {
			return false;
		}
		const reading = this.toHiragana(this.readingPart(current));
		const nextSurface = this.toHiragana(next.surface);
		return reading.length >= 2 && reading === nextSurface;
	}

	private shouldMergeInlineRubyPrefix(
		current: ChunkToken,
		next: ChunkToken,
	): boolean {
		if (
			!KANJI_PATTERN.test(current.surface) ||
			!KANA_PATTERN.test(next.surface)
		) {
			return false;
		}
		const reading = this.toHiragana(this.readingPart(current));
		const nextSurface = this.toHiragana(next.surface);
		if (reading.length < 2 || !nextSurface.startsWith(reading)) {
			const currentPos0 = this.getPosById(current.posId)?.[0] ?? '';
			if (
				KANJI_ONLY_PATTERN.test(current.surface) &&
				current.surface.length <= 2 &&
				next.surface.length >= 3 &&
				HIRAGANA_PATTERN.test(next.surface) &&
				!['接尾辞', '助詞', '助動詞', '補助記号'].includes(currentPos0) &&
				(next.chunkType === 'phrase' ||
					next.chunkType === 'te_form' ||
					next.chunkType === 'progressive_form')
			) {
				// Guard against false positives like 「口とらえて」 by requiring
				// at least partial kana overlap between current reading and next surface.
				const nextPrefix = nextSurface.slice(0, 3);
				const hasReadingOverlap = [...new Set(reading)].some((kana) =>
					nextPrefix.includes(kana),
				);
				if (!hasReadingOverlap) {
					return false;
				}
				return true;
			}
			return false;
		}
		return (
			next.chunkType === 'phrase' ||
			next.chunkType === 'te_form' ||
			next.chunkType === 'progressive_form' ||
			next.chunkType === 'single_token'
		);
	}

	private toHiragana(value: string): string {
		return value.replace(/[ァ-ヶ]/g, (ch) =>
			String.fromCharCode(ch.charCodeAt(0) - 0x60),
		);
	}

	private getPosById(posId: number): string[] | null {
		if (!this.grammar || posId < 0) {
			return null;
		}
		try {
			return this.grammar.getPartOfSpeechString(posId).toList();
		} catch {
			return null;
		}
	}

	private mergeChunks(chunks: ChunkToken[], chunkType: ChunkType): ChunkToken {
		const first = chunks[0]!;
		const surface = chunks.map((c) => c.surface).join('');
		const reading = chunks.map((c) => this.readingPart(c)).join('');
		const normalizedForm = chunks.map((c) => c.normalizedForm).join('');
		const nodes = chunks.flatMap((c) => c.nodes);

		return {
			surface,
			reading,
			normalizedForm,
			dictionaryForm: first.dictionaryForm,
			posId: first.posId,
			chunkType,
			nodes,
		};
	}

	private readingPart(chunk: ChunkToken): string {
		if (this.isNumericCommaChunk(chunk)) {
			return '';
		}
		if (this.isNumericDotChunk(chunk)) {
			return 'テン';
		}
		if (this.isNumericSignChunk(chunk)) {
			if (chunk.surface === '+' || chunk.surface === '＋') {
				return 'プラス';
			}
			return 'マイナス';
		}
		if (!chunk.reading || chunk.reading === '*') {
			return chunk.surface;
		}
		return chunk.reading;
	}

	private rehydratePath(
		path: LatticeNode[],
		chunks: ChunkToken[],
		lattice: Lattice,
	): void {
		const rewritten: LatticeNode[] = [];
		for (const chunk of chunks) {
			const node = this.chunkToNode(chunk, lattice);
			rewritten.push(node);
		}
		path.splice(0, path.length, ...rewritten);
	}

	private chunkToNode(chunk: ChunkToken, lattice: Lattice): LatticeNode {
		const firstNode = chunk.nodes[0]!;
		const lastNode = chunk.nodes[chunk.nodes.length - 1]!;

		const begin = firstNode.getBegin();
		const end = lastNode.getEnd();
		const headwordLength = chunk.nodes.reduce(
			(sum, n) => sum + n.getWordInfo().getLength(),
			0,
		);

		const wi = new WordInfo(
			chunk.surface,
			headwordLength,
			chunk.posId,
			chunk.normalizedForm,
			chunk.dictionaryForm,
			chunk.reading,
		);

		const node = lattice.createNode();
		node.setRange(begin, end);
		node.setWordInfo(wi);
		node.setWordId(firstNode.getWordId());
		node.setDictionaryId(firstNode.getDictionaryId());
		if (chunk.nodes.some((n) => n.isOOV())) {
			node.setOOV();
		}
		return node;
	}
}

const NUMBER_SURFACE_PATTERN = /^[0-9０-９一二三四五六七八九十百千万億兆]+$/;
const NUMERIC_COMMA_SURFACES = new Set([',', '，']);
const NUMERIC_DOT_SURFACES = new Set(['.', '．']);
const NUMERIC_SIGN_SURFACES = new Set(['-', '−', '－', '+', '＋']);
const LATIN_TEXT_PATTERN = /^[A-Za-zＡ-Ｚａ-ｚ][A-Za-zＡ-Ｚａ-ｚ0-9０-９]*$/;
const KANJI_PATTERN = /\p{Script=Han}/u;
const KANJI_ONLY_PATTERN = /^[\p{Script=Han}々〆ヵヶ]+$/u;
const KANA_PATTERN = /^[ぁ-ゖァ-ヺー]+$/u;
const HIRAGANA_PATTERN = /^[ぁ-ゖー]+$/u;

const COUNTER_WORDS = new Set([
	'本',
	'匹',
	'枚',
	'個',
	'人',
	'歳',
	'才',
	'つ',
	'年',
	'ヶ月',
	'カ月',
	'月',
	'週',
	'日',
	'時間',
	'分',
	'秒',
	'円',
	'回',
	'階',
	'番',
	'号',
]);

const COUNTER_SUFFIXES = new Set([
	'後',
	'間',
	'目',
	'以内',
	'以上',
	'未満',
	'程度',
	'くらい',
	'頃',
	'前',
]);

const DAY_COUNTER_RULES: Array<[string, string]> = [
	['イチ', 'ツイタチ'],
	['ニ', 'フツカ'],
	['サン', 'ミッカ'],
	['ヨン', 'ヨッカ'],
	['ゴ', 'イツカ'],
	['ロク', 'ムイカ'],
	['ナナ', 'ナノカ'],
	['ハチ', 'ヨウカ'],
	['キュウ', 'ココノカ'],
	['ジュウ', 'トウカ'],
	['ニジュウ', 'ハツカ'],
];

const COUNTER_PHONOLOGY: CounterPhonology = {
	本: {
		イチ: 'イッポン',
		ニ: 'ニホン',
		サン: 'サンボン',
		ヨン: 'ヨンホン',
		ゴ: 'ゴホン',
		ロク: 'ロッポン',
		ナナ: 'ナナホン',
		ハチ: 'ハッポン',
		キュウ: 'キュウホン',
	},
	匹: {
		イチ: 'イッピキ',
		ニ: 'ニヒキ',
		サン: 'サンピキ',
		ヨン: 'ヨンヒキ',
		ゴ: 'ゴヒキ',
		ロク: 'ロッピキ',
		ナナ: 'ナナヒキ',
		ハチ: 'ハッピキ',
		キュウ: 'キュウヒキ',
	},
	分: {
		イチ: 'イップン',
		ニ: 'ニフン',
		サン: 'サンプン',
		ヨン: 'ヨンプン',
		ゴ: 'ゴフン',
		ロク: 'ロップン',
		ナナ: 'ナナフン',
		ハチ: 'ハップン',
		キュウ: 'キュウフン',
	},
	階: {
		イチ: 'イッカイ',
		ニ: 'ニカイ',
		サン: 'サンガイ',
		ヨン: 'ヨンカイ',
		ゴ: 'ゴカイ',
		ロク: 'ロッカイ',
		ナナ: 'ナナカイ',
		ハチ: 'ハッカイ',
		キュウ: 'キュウカイ',
	},
	回: {
		イチ: 'イッカイ',
		ニ: 'ニカイ',
		サン: 'サンカイ',
		ヨン: 'ヨンカイ',
		ゴ: 'ゴカイ',
		ロク: 'ロッカイ',
		ナナ: 'ナナカイ',
		ハチ: 'ハッカイ',
		キュウ: 'キュウカイ',
	},
};

const COLLOQUIAL_SEQUENCE_RULES: SequenceRule[] = [
	{
		name: 'quotative_tte_itteru',
		priority: 102,
		resultType: 'phrase',
		pattern: [
			{ surface: 'って', pos0: '助詞' },
			{ dictionaryForm: '言う', pos0: '動詞' },
			{ surface: ['て', 'で'], pos0: '助詞', pos1: '接続助詞' },
			{ surface: 'る', pos0: '助動詞' },
		],
	},
	{
		name: 'quotative_tte_itteru_compact',
		priority: 102,
		resultType: 'phrase',
		pattern: [
			{ surface: 'って', pos0: '助詞' },
			{ dictionaryForm: '言う', pos0: '動詞' },
			{ surface: ['てる', 'でる'] },
		],
	},
	{
		name: 'quotative_tte_itteru_single_verb',
		priority: 102,
		resultType: 'phrase',
		pattern: [
			{ surface: 'って', pos0: '助詞' },
			{ surface: ['言ってる', 'いってる'] },
		],
	},
	{
		name: 'quotative_tte_itteta',
		priority: 102,
		resultType: 'phrase',
		pattern: [
			{ surface: 'って', pos0: '助詞' },
			{ dictionaryForm: '言う', pos0: '動詞' },
			{ surface: ['て', 'で'], pos0: '助詞' },
			{ surface: 'た' },
		],
	},
	{
		name: 'quotative_tte_itteta_surface',
		priority: 102,
		resultType: 'phrase',
		pattern: [
			{ surface: 'って' },
			{ surface: ['言っ', 'いっ'] },
			{ surface: 'て' },
			{ surface: 'た' },
		],
	},
	{
		name: 'quotative_tte_itteta_compact',
		priority: 102,
		resultType: 'phrase',
		pattern: [
			{ surface: 'って', pos0: '助詞' },
			{ dictionaryForm: '言う', pos0: '動詞' },
			{ surface: ['てた', 'でた'] },
		],
	},
	{
		name: 'quotative_tte_itteta_single_verb',
		priority: 102,
		resultType: 'phrase',
		pattern: [
			{ surface: 'って', pos0: '助詞' },
			{ surface: ['言ってた', 'いってた'] },
		],
	},
	{
		name: 'suru_masu',
		priority: 101,
		resultType: 'phrase',
		pattern: [
			{ surface: 'し', dictionaryForm: ['する', '為る'], pos0: '動詞' },
			{ surface: 'ます', pos0: '助動詞' },
		],
	},
	{
		name: 'verb_masu_past',
		priority: 101,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'まし', dictionaryForm: 'ます', pos0: '助動詞' },
			{ surface: 'た', pos0: '助動詞' },
		],
	},
	{
		name: 'noun_suru_past',
		priority: 101,
		resultType: 'phrase',
		pattern: [
			{ pos0: '名詞' },
			{ surface: 'し', dictionaryForm: ['する', '為る'], pos0: '動詞' },
			{ surface: 'た', pos0: '助動詞' },
		],
	},
	{
		name: 'noun_suru_past_compact',
		priority: 101,
		resultType: 'phrase',
		pattern: [
			{ pos0: '名詞' },
			{ surface: 'した', dictionaryForm: ['する', '為る'], pos0: '動詞' },
		],
	},
	{
		name: 'noun_suru_progressive_past',
		priority: 101,
		resultType: 'phrase',
		pattern: [
			{ pos0: '名詞' },
			{ surface: 'し', dictionaryForm: ['する', '為る'], pos0: '動詞' },
			{ surface: ['て', 'で'] },
			{ surface: 'た' },
		],
	},
	{
		name: 'noun_suru_progressive_past_compact',
		priority: 101,
		resultType: 'phrase',
		pattern: [{ pos0: '名詞' }, { surface: ['してた', 'している', 'してる'] }],
	},
	{
		name: 'noun_suru_te_masu',
		priority: 101,
		resultType: 'phrase',
		pattern: [
			{ pos0: '名詞' },
			{ surface: 'し', dictionaryForm: ['する', '為る'], pos0: '動詞' },
			{ surface: ['て', 'で'] },
			{ surface: 'ます', pos0: '助動詞' },
		],
	},
	{
		name: 'noun_suru_te_masu_compact',
		priority: 101,
		resultType: 'phrase',
		pattern: [{ pos0: '名詞' }, { surface: 'してます' }],
	},
	{
		name: 'suru_te_masu',
		priority: 101,
		resultType: 'phrase',
		pattern: [
			{
				surface: 'し',
				dictionaryForm: ['する', '為る'],
				pos0: '動詞',
			},
			{ surface: ['て', 'で'] },
			{ surface: 'ます' },
		],
	},
	{
		name: 'suru_te_masu_compact',
		priority: 101,
		resultType: 'phrase',
		pattern: [
			{
				surface: 'し',
				dictionaryForm: ['する', '為る'],
				pos0: '動詞',
			},
			{ surface: 'てます' },
		],
	},
	{
		name: 'emphatic_tto_shita',
		priority: 101,
		resultType: 'phrase',
		pattern: [
			{ pos0: ['副詞', '名詞', '形容詞', '感動詞'] },
			{ surface: 'っと' },
			{ surface: 'し', dictionaryForm: ['する', '為る'], pos0: '動詞' },
			{ surface: 'た', pos0: '助動詞' },
		],
	},
	{
		name: 'emphatic_small_tsu_to_shita',
		priority: 101,
		resultType: 'phrase',
		pattern: [
			{ pos0: ['副詞', '名詞', '形容詞', '感動詞'] },
			{ surface: 'と' },
			{ surface: 'し', dictionaryForm: ['する', '為る'], pos0: '動詞' },
			{ surface: 'た', pos0: '助動詞' },
		],
	},
	{
		name: 'emphatic_small_tsu_to_shitai',
		priority: 101,
		resultType: 'phrase',
		pattern: [
			{ pos0: ['副詞', '名詞', '形容詞', '感動詞'] },
			{ surface: 'と' },
			{ surface: 'したい' },
		],
	},
	{
		name: 'verb_desiderative_ta_katta',
		priority: 100,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'た', pos0: '助動詞' },
			{ surface: 'かっ', pos0: ['助動詞', '形容詞'] },
			{ surface: 'た', pos0: '助動詞' },
		],
	},
	{
		name: 'verb_desiderative_takatta',
		priority: 100,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'たかっ', pos0: ['助動詞', '形容詞'] },
			{ surface: 'た', pos0: '助動詞' },
		],
	},
	{
		name: 'verb_desiderative_tai',
		priority: 99,
		resultType: 'phrase',
		pattern: [{ pos0: '動詞' }, { surface: 'たい', pos0: '助動詞' }],
	},
	{
		name: 'morau_potential_past',
		priority: 99,
		resultType: 'phrase',
		pattern: [{ surface: ['貰え', 'もらえ'] }, { surface: 'た' }],
	},
	{
		name: 'morau_potential_negative',
		priority: 99,
		resultType: 'phrase',
		pattern: [{ surface: ['貰え', 'もらえ'] }, { surface: 'ない' }],
	},
	{
		name: 'verb_ta_tte',
		priority: 98,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'た', pos0: '助動詞' },
			{ surface: 'って', pos0: '助詞' },
		],
	},
	{
		name: 'verb_tatte',
		priority: 98,
		resultType: 'phrase',
		pattern: [{ pos0: '動詞' }, { surface: 'たって' }],
	},
	{
		name: 'colloquial_te_ru',
		priority: 97,
		resultType: 'progressive_form',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['て', 'で'], pos0: '助詞', pos1: '接続助詞' },
			{ surface: 'る' },
		],
	},
	{
		name: 'colloquial_te_ru_compact',
		priority: 97,
		resultType: 'progressive_form',
		pattern: [{ pos0: '動詞' }, { surface: ['てる', 'でる'] }],
	},
	{
		name: 'colloquial_te_ta',
		priority: 97,
		resultType: 'progressive_form',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['て', 'で'], pos0: '助詞', pos1: '接続助詞' },
			{ surface: 'た' },
		],
	},
	{
		name: 'colloquial_te_ta_aux_teru',
		priority: 97,
		resultType: 'progressive_form',
		pattern: [
			{ pos0: '動詞' },
			{
				surface: ['て', 'で'],
				dictionaryForm: ['てる', 'でる'],
				pos0: '助動詞',
			},
			{ surface: 'た', pos0: '助動詞' },
		],
	},
	{
		name: 'colloquial_te_ta_compact',
		priority: 97,
		resultType: 'progressive_form',
		pattern: [{ pos0: '動詞' }, { surface: ['てた', 'でた'] }],
	},
	{
		name: 'colloquial_de_ta_loose',
		priority: 97,
		resultType: 'progressive_form',
		pattern: [{ pos0: '動詞' }, { surface: 'で' }, { surface: 'た' }],
	},
	{
		name: 'verb_te_nai',
		priority: 97,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['て', 'で'], pos0: '助詞', pos1: '接続助詞' },
			{ surface: 'ない' },
		],
	},
	{
		name: 'verb_te_nai_te_loose',
		priority: 97,
		resultType: 'phrase',
		pattern: [{ pos0: '動詞' }, { surface: 'て' }, { surface: 'ない' }],
	},
	{
		name: 'verb_te_nai_compact',
		priority: 97,
		resultType: 'phrase',
		pattern: [{ pos0: '動詞' }, { surface: ['てない', 'でない'] }],
	},
	{
		name: 'verb_te_n',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['て', 'で'], pos0: '助詞', pos1: '接続助詞' },
			{ surface: 'ん' },
		],
	},
	{
		name: 'verb_causative_te_ta',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{
				surface: ['せ', 'させ'],
				dictionaryForm: ['せる', 'させる'],
				pos0: ['助動詞', '動詞'],
			},
			{ surface: ['て', 'で'], pos0: '助詞', pos1: '接続助詞' },
			{ surface: 'た', pos0: '助動詞' },
		],
	},
	{
		name: 'verb_past_n_da',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'ん', pos0: '助詞' },
			{ surface: 'だ', pos0: '助動詞' },
		],
	},
	{
		name: 'verb_past_n_da_compact',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ pos0: '動詞' }, { surface: 'んだ' }],
	},
	{
		name: 'verb_te_irare_nai',
		priority: 98,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['て', 'で'] },
			{ surface: 'い', dictionaryForm: ['いる', '居る'], pos0: '動詞' },
			{
				surface: ['られ', 'れ'],
				dictionaryForm: ['られる', 'れる'],
				pos0: ['助動詞', '動詞'],
			},
			{ surface: 'ない' },
		],
	},
	{
		name: 'verb_te_rare_nai',
		priority: 98,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['て', 'で'] },
			{
				surface: ['られ', 'れ'],
				dictionaryForm: ['られる', 'れる'],
				pos0: ['助動詞', '動詞'],
			},
			{ surface: 'ない' },
		],
	},
	{
		name: 'verb_kire_nai',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'きれ', dictionaryForm: 'きれる', pos0: '動詞' },
			{ surface: 'ない' },
		],
	},
	{
		name: 'verb_te_n_compact',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ pos0: '動詞' }, { surface: ['てん', 'でん'] }],
	},
	{
		name: 'verb_chau',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ pos0: '動詞' }, { surface: ['ちゃう', 'じゃう'] }],
	},
	{
		name: 'suru_cha',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{
				surface: 'し',
				dictionaryForm: ['する', '為る'],
				pos0: '動詞',
			},
			{ surface: ['ちゃ', 'ちゃっ'] },
		],
	},
	{
		name: 'suru_chatta',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{
				surface: 'し',
				dictionaryForm: ['する', '為る'],
				pos0: '動詞',
			},
			{ surface: 'ちゃっ' },
			{ surface: 'た', pos0: '助動詞' },
		],
	},
	{
		name: 'verb_nakya',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ pos0: '動詞' }, { surface: 'なきゃ' }],
	},
	{
		name: 'verb_nakya_ikenai',
		priority: 97,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'なきゃ' },
			{
				surface: ['いけ', '行け'],
				dictionaryForm: ['いける', '行ける'],
				pos0: '動詞',
			},
			{ surface: 'ない' },
		],
	},
	{
		name: 'verb_nakya_naranai',
		priority: 97,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'なきゃ' },
			{ surface: 'なら', dictionaryForm: 'なる', pos0: '動詞' },
			{ surface: 'ない' },
		],
	},
	{
		name: 'verb_nakucha',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ pos0: '動詞' }, { surface: 'なく' }, { surface: 'ちゃ' }],
	},
	{
		name: 'verb_nakucha_ikenai',
		priority: 97,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'なく' },
			{ surface: 'ちゃ' },
			{
				surface: ['いけ', '行け'],
				dictionaryForm: ['いける', '行ける'],
				pos0: '動詞',
			},
			{ surface: 'ない' },
		],
	},
	{
		name: 'verb_nakucha_naranai',
		priority: 97,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'なく' },
			{ surface: 'ちゃ' },
			{ surface: 'なら', dictionaryForm: 'なる', pos0: '動詞' },
			{ surface: 'ない' },
		],
	},
	{
		name: 'verb_negative_past',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['ない', 'なかっ', 'なかった'] },
			{ surface: ['た'], pos0: '助動詞' },
		],
	},
	{
		name: 'verb_negative_past_compact',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ pos0: '動詞' }, { surface: 'なかった' }],
	},
	{
		name: 'verb_naku_natte_shimau',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'なく' },
			{ surface: 'なっ', dictionaryForm: 'なる', pos0: '動詞' },
			{ surface: 'て', pos0: '助詞', pos1: '接続助詞' },
			{ surface: 'しまう', dictionaryForm: ['しまう', '仕舞う'], pos0: '動詞' },
		],
	},
	{
		name: 'verb_nakutewa_ikenai',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'なく' },
			{ surface: 'て', pos0: '助詞', pos1: '接続助詞' },
			{ surface: 'は', pos0: '助詞' },
			{
				surface: ['いけ', '行け'],
				dictionaryForm: ['いける', '行ける'],
				pos0: '動詞',
			},
			{ surface: 'ない' },
		],
	},
	{
		name: 'verb_nakutewa_naranai',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'なく' },
			{ surface: 'て', pos0: '助詞', pos1: '接続助詞' },
			{ surface: 'は', pos0: '助詞' },
			{ surface: 'なら', dictionaryForm: 'なる', pos0: '動詞' },
			{ surface: 'ない' },
		],
	},
	{
		name: 'verb_nakutewa_naranai_compact',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'なく' },
			{ surface: 'て', pos0: '助詞', pos1: '接続助詞' },
			{ surface: 'は', pos0: '助詞' },
			{ surface: 'ならない' },
		],
	},
	{
		name: 'verb_tewa_ikenai_compact',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['ては', 'では'] },
			{
				surface: ['いけ', '行け'],
				dictionaryForm: ['いける', '行ける'],
				pos0: '動詞',
			},
			{ surface: 'ない' },
		],
	},
	{
		name: 'verb_tewa_ikenai',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['て', 'で'] },
			{ surface: 'は', pos0: '助詞' },
			{
				surface: ['いけ', '行け'],
				dictionaryForm: ['いける', '行ける'],
				pos0: '動詞',
			},
			{ surface: 'ない' },
		],
	},
	{
		name: 'verb_nakereba_naranai',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'なけれ' },
			{ surface: 'ば', pos0: '助詞' },
			{ surface: 'なら', dictionaryForm: 'なる', pos0: '動詞' },
			{ surface: 'ない' },
		],
	},
	{
		name: 'verb_nakereba_ikenai',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'なけれ' },
			{ surface: 'ば', pos0: '助詞' },
			{
				surface: ['いけ', '行け'],
				dictionaryForm: ['いける', '行ける'],
				pos0: '動詞',
			},
			{ surface: 'ない' },
		],
	},
	{
		name: 'verb_naito_ikenai',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'ない' },
			{ surface: 'と', pos0: '助詞' },
			{
				surface: ['いけ', '行け'],
				dictionaryForm: ['いける', '行ける'],
				pos0: '動詞',
			},
			{ surface: 'ない' },
		],
	},
	{
		name: 'verb_naito_naranai',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'ない' },
			{ surface: 'と', pos0: '助詞' },
			{ surface: 'なら', dictionaryForm: 'なる', pos0: '動詞' },
			{ surface: 'ない' },
		],
	},
	{
		name: 'verb_naito_naranai_compact',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'ない' },
			{ surface: 'と', pos0: '助詞' },
			{ surface: 'ならない' },
		],
	},
	{
		name: 'verb_you_ni_naru',
		priority: 95,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'よう' },
			{ surface: 'に' },
			{ surface: 'なる', dictionaryForm: 'なる', pos0: '動詞' },
		],
	},
	{
		name: 'verb_temo_ii',
		priority: 95,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['ても', 'でも'] },
			{ surface: 'いい' },
		],
	},
	{
		name: 'verb_nakutemo_ii_compact',
		priority: 95,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['なくても', 'なくったって'] },
			{ surface: 'いい' },
		],
	},
	{
		name: 'verb_nakutemo_ii',
		priority: 95,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'なく' },
			{ surface: 'て' },
			{ surface: 'も', pos0: '助詞' },
			{ surface: 'いい' },
		],
	},
	{
		name: 'te_form_mo_ii',
		priority: 95,
		resultType: 'phrase',
		pattern: [{ chunkType: 'te_form' }, { surface: 'も' }, { surface: 'いい' }],
	},
	{
		name: 'verb_ba_ii',
		priority: 95,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'ば', pos0: '助詞' },
			{ surface: 'いい' },
		],
	},
	{
		name: 'ja_ire_nai',
		priority: 95,
		resultType: 'phrase',
		pattern: [
			{ pos0: ['名詞', '代名詞', '形容詞', '形状詞'] },
			{ surface: 'じゃ' },
			{ surface: ['いれ', 'いられ'], pos0: ['動詞', '助動詞'] },
			{ surface: 'ない' },
		],
	},
	{
		name: 'adjective_past_n_da',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '形容詞' },
			{ surface: 'た', pos0: '助動詞' },
			{ surface: 'ん' },
			{ surface: 'だ' },
		],
	},
	{
		name: 'adjective_past_n_da_compact',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ pos0: '形容詞' }, { surface: 'たんだ' }],
	},
	{
		name: 'verb_past',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ pos0: '動詞' }, { surface: 'た', pos0: '助動詞' }],
	},
	{
		name: 'verb_tara_compact',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ pos0: '動詞' }, { surface: 'たら' }],
	},
	{
		name: 'verb_tara',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'た', pos0: '助動詞' },
			{ surface: 'ら', pos0: '助詞' },
		],
	},
	{
		name: 'verb_aux_reru_split_ru',
		priority: 97,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{
				surface: ['れ', 'られ'],
				dictionaryForm: ['れる', 'られる'],
				pos0: ['助動詞', '動詞'],
			},
			{ surface: 'る', pos0: ['助動詞', '動詞'] },
		],
	},
	{
		name: 'verb_aux_reru_split',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{
				surface: ['れ', 'られ'],
				dictionaryForm: ['れる', 'られる'],
				pos0: ['助動詞', '動詞'],
			},
		],
	},
	{
		name: 'verb_aux_reru',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['れる', 'られる'], pos0: ['助動詞', '動詞'] },
		],
	},
	{
		name: 'verb_negative_nonpast',
		priority: 89,
		resultType: 'phrase',
		pattern: [{ pos0: '動詞' }, { surface: 'ない' }],
	},
	{
		name: 'noun_suru_volitional',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '名詞' },
			{ surface: 'し', dictionaryForm: ['する', '為る'], pos0: '動詞' },
			{ surface: ['よう', 'う'], pos0: '助動詞' },
		],
	},
	{
		name: 'noun_suru_volitional_compact',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: '名詞' },
			{
				surface: 'しよう',
				dictionaryForm: ['する', '為る'],
				pos0: '動詞',
			},
		],
	},
	{
		name: 'copula_datta_ra',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: ['名詞', '代名詞', '形容詞'] },
			{ surface: ['だ', 'だっ', 'だった'] },
			{ surface: 'た' },
			{ surface: 'ら' },
		],
	},
	{
		name: 'copula_dapp_tara',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: ['名詞', '代名詞', '形容詞'] },
			{ surface: 'だっ' },
			{ surface: 'たら' },
		],
	},
	{
		name: 'copula_dattara_compact',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: ['名詞', '代名詞', '形容詞'] },
			{ surface: ['だったら', 'だった'] },
			{ surface: 'ら' },
		],
	},
	{
		name: 'copula_dattara_single',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ pos0: ['名詞', '代名詞', '形容詞'] }, { surface: 'だったら' }],
	},
	{
		name: 'copula_datta',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ pos0: ['名詞', '代名詞', '形容詞'] },
			{ surface: ['だ', 'だっ'] },
			{ surface: 'た' },
		],
	},
	{
		name: 'copula_datta_compact',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ pos0: ['名詞', '代名詞', '形容詞'] }, { surface: 'だった' }],
	},
	{
		name: 'copula_datta_standalone',
		priority: 95,
		resultType: 'phrase',
		pattern: [{ surface: 'だっ' }, { surface: 'た' }],
	},
	{
		name: 'ja_nakute',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ surface: 'じゃ' }, { surface: 'なく' }, { surface: 'て' }],
	},
	{
		name: 'ja_nakute_compact',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ surface: 'じゃなくて' }],
	},
	{
		name: 'noun_ja_nakute',
		priority: 95,
		resultType: 'phrase',
		pattern: [{ pos0: ['名詞', '代名詞'] }, { surface: 'じゃなくて' }],
	},
	{
		name: 'noun_ja_nakute_split',
		priority: 95,
		resultType: 'phrase',
		pattern: [
			{ pos0: ['名詞', '代名詞'] },
			{ surface: 'じゃ' },
			{ surface: 'なく' },
			{ surface: 'て' },
		],
	},
	{
		name: 'noun_ni_sareta',
		priority: 95,
		resultType: 'phrase',
		pattern: [
			{ pos0: '名詞' },
			{ surface: 'に' },
			{ surface: 'され' },
			{ surface: 'た', pos0: '助動詞' },
		],
	},
	{
		name: 'noun_ni_sa_re_ta',
		priority: 95,
		resultType: 'phrase',
		pattern: [
			{ pos0: '名詞' },
			{ surface: 'に' },
			{ surface: 'さ', dictionaryForm: ['する', '為る'], pos0: '動詞' },
			{ surface: 'れ', dictionaryForm: 'れる', pos0: '助動詞' },
			{ surface: 'た', pos0: '助動詞' },
		],
	},
	{
		name: 'noun_ni_sareta_compact',
		priority: 95,
		resultType: 'phrase',
		pattern: [{ pos0: '名詞' }, { surface: 'に' }, { surface: 'された' }],
	},
	{
		name: 'noun_ni_sarete',
		priority: 95,
		resultType: 'phrase',
		pattern: [{ pos0: '名詞' }, { surface: 'に' }, { surface: 'されて' }],
	},
	{
		name: 'noun_ni_saremasu_yo',
		priority: 95,
		resultType: 'phrase',
		pattern: [
			{ pos0: '名詞' },
			{ surface: 'に' },
			{ surface: 'され' },
			{ surface: 'ます', pos0: '助動詞' },
			{ surface: 'よ' },
		],
	},
	{
		name: 'noun_ni_saremasu',
		priority: 95,
		resultType: 'phrase',
		pattern: [
			{ pos0: '名詞' },
			{ surface: 'に' },
			{ surface: 'され' },
			{ surface: 'ます', pos0: '助動詞' },
		],
	},
	{
		name: 'n_ja_nai',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ surface: 'ん' }, { surface: 'じゃ' }, { surface: 'ない' }],
	},
	{
		name: 'nan_ja_nai',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ surface: ['なん', '何'] },
			{ surface: 'じゃ' },
			{ surface: 'ない' },
		],
	},
	{
		name: 'nan_ja_nai_compact',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ surface: ['なん', '何'] }, { surface: 'じゃない' }],
	},
	{
		name: 'ja_nai',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ surface: 'じゃ' }, { surface: 'ない' }],
	},
	{
		name: 'dewa_nai',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ surface: 'で' }, { surface: 'は' }, { surface: 'ない' }],
	},
	{
		name: 'noun_or_pronoun_ja_nai',
		priority: 95,
		resultType: 'phrase',
		pattern: [
			{ pos0: ['名詞', '代名詞'] },
			{ surface: 'じゃ' },
			{ surface: 'ない' },
		],
	},
	{
		name: 'fixed_hou_ga_ii',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: '方' }, { surface: 'が' }, { surface: 'いい' }],
	},
	{
		name: 'fixed_da_mon',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'だ' }, { surface: 'もん' }],
	},
	{
		name: 'fixed_nande',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: ['なん', '何'] }, { surface: 'で' }],
	},
	{
		name: 'fixed_nanka',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: ['なん', '何'] }, { surface: 'か', pos0: '助詞' }],
	},
	{
		name: 'fixed_datte',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'だ' }, { surface: 'って' }],
	},
	{
		name: 'fixed_dakara',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'だ' }, { surface: ['から', 'からっ'] }],
	},
	{
		name: 'fixed_na_n_da_kedo',
		priority: 95,
		resultType: 'fixed_expression',
		pattern: [
			{ surface: 'な', dictionaryForm: 'だ', pos0: '助動詞' },
			{ surface: 'ん', pos0: '助詞' },
			{ surface: 'だ', pos0: '助動詞' },
			{ surface: 'けど', pos0: '助詞' },
		],
	},
	{
		name: 'fixed_na_n_dakedo',
		priority: 95,
		resultType: 'fixed_expression',
		pattern: [
			{ surface: 'な', dictionaryForm: 'だ', pos0: '助動詞' },
			{ surface: 'ん', pos0: '助詞' },
			{ surface: 'だけど' },
		],
	},
	{
		name: 'fixed_nan_dakedo',
		priority: 95,
		resultType: 'fixed_expression',
		pattern: [{ surface: ['なん', '何'] }, { surface: 'だけど' }],
	},
	{
		name: 'fixed_dakedo',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'だ' }, { surface: 'けど' }],
	},
	{
		name: 'fixed_sore_ni',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'それ' }, { surface: 'に' }],
	},
	{
		name: 'fixed_ni_naranai',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [
			{ surface: 'に', pos0: '助詞' },
			{ surface: 'なら', dictionaryForm: 'なる', pos0: '動詞' },
			{ surface: 'ない', pos0: '助動詞' },
		],
	},
	{
		name: 'fixed_mokkai',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'もっ' }, { surface: 'かい' }],
	},
	{
		name: 'fixed_mou_ikkai_variants',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [
			{ surface: ['もう', 'もー'] },
			{ surface: ['一', 'いっ'] },
			{ surface: ['回', 'かい'] },
		],
	},
	{
		name: 'fixed_mou_ikkai_compact',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: ['もう', 'もー'] }, { surface: '一回' }],
	},
	{
		name: 'fixed_mou_ikkai_split_kai',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [
			{ surface: ['もう', 'もー'] },
			{ surface: 'いっ' },
			{ surface: 'か' },
			{ surface: 'い' },
		],
	},
	{
		name: 'fixed_tsumannai',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'つまん' }, { surface: 'ない' }],
	},
	{
		name: 'fixed_tsumaranai',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'つまら' }, { surface: 'ない' }],
	},
	{
		name: 'fixed_wake_nai',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'わけ' }, { surface: 'ない' }],
	},
	{
		name: 'fixed_nicchu',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [
			{ surface: '日', pos0: '接尾辞' },
			{ surface: '中', pos0: '接尾辞' },
		],
	},
	{
		name: 'adjective_nai',
		priority: 94,
		resultType: 'phrase',
		pattern: [{ pos0: '形容詞' }, { surface: 'ない' }],
	},
	{
		name: 'adjective_wa_nai',
		priority: 94,
		resultType: 'phrase',
		pattern: [
			{ pos0: '形容詞' },
			{ surface: 'は', pos0: '助詞' },
			{ surface: 'ない' },
		],
	},
	{
		name: 'fixed_kousan_small_tsu',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: '降参' }, { surface: 'っ' }],
	},
	{
		name: 'fixed_otousan_small_tsu',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [
			{ surface: 'お' },
			{ surface: '父' },
			{ surface: 'さ' },
			{ surface: 'んっ' },
		],
	},
	{
		name: 'fixed_chii',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [
			{ surface: '血', pos0: '名詞' },
			{ surface: 'い', pos0: '助詞' },
		],
	},
	{
		name: 'adjective_i_small_tsu',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ pos0: '形容詞' }, { surface: 'いっ' }],
	},
	{
		name: 'fixed_gucha_gucha',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'ぐちゃ' }, { surface: 'ぐちゃ' }],
	},
	{
		name: 'fixed_desu_yo',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'です' }, { surface: 'よ' }],
	},
	{
		name: 'fixed_n_da_yo',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'ん' }, { surface: 'だ' }, { surface: 'よ' }],
	},
	{
		name: 'fixed_nan_da_yo',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [
			{ surface: ['なん', '何'] },
			{ surface: 'だ' },
			{ surface: 'よ' },
		],
	},
	{
		name: 'fixed_n_da_yo_compact',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'ん' }, { surface: 'だよ' }],
	},
	{
		name: 'fixed_nda_yo',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'んだ' }, { surface: 'よ' }],
	},
	{
		name: 'fixed_de_su_yo',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'で' }, { surface: 'す' }, { surface: 'よ' }],
	},
	{
		name: 'fixed_ja_n',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'じゃ' }, { surface: 'ん' }],
	},
	{
		name: 'fixed_desho',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'で' }, { surface: 'しょ' }],
	},
	{
		name: 'fixed_doushiyo',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'どう' }, { surface: ['しよ', 'しよう'] }],
	},
	{
		name: 'fixed_sentence_ending_kana',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [
			{ surface: 'か', pos0: '助詞' },
			{ surface: 'な', pos0: '助詞' },
		],
	},
	{
		name: 'fixed_yada',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [
			{ surface: 'や', pos0: '形状詞' },
			{ surface: 'だ', pos0: '助動詞' },
		],
	},
];

const VERB_SEQUENCE_RULES: SequenceRule[] = [
	{
		name: 'suru_verb_progressive',
		priority: 100,
		resultType: 'suru_verb_progressive',
		pattern: [
			{ pos0: '名詞' },
			{ surface: 'し', dictionaryForm: ['する', '為る'], pos0: '動詞' },
			{ surface: 'て', pos0: '助詞', pos1: '接続助詞' },
			{ surface: 'い', dictionaryForm: ['いる', '居る'], pos0: '動詞' },
			{ surface: ['る', 'た'], pos0: '助動詞' },
		],
	},
	{
		name: 'suru_verb_te_form',
		priority: 95,
		resultType: 'suru_verb_te_form',
		pattern: [
			{ pos0: '名詞' },
			{ surface: 'し', dictionaryForm: ['する', '為る'], pos0: '動詞' },
			{ surface: ['て', 'で'], pos0: '助詞', pos1: '接続助詞' },
		],
	},
	{
		name: 'compound_progressive_past',
		priority: 91,
		resultType: 'progressive_form',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['て', 'で'], pos0: '助詞', pos1: '接続助詞' },
			{ dictionaryForm: ['いる', '居る'], pos0: '動詞' },
			{ surface: 'た', pos0: '助動詞' },
		],
	},
	{
		name: 'progressive_form',
		priority: 90,
		resultType: 'progressive_form',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['て', 'で'], pos0: '助詞', pos1: '接続助詞' },
			{ dictionaryForm: ['いる', '居る'], pos0: '動詞' },
		],
	},
	{
		name: 'te_form',
		priority: 80,
		resultType: 'te_form',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['て', 'で'], pos0: '助詞', pos1: '接続助詞' },
		],
	},
];

const PHRASE_SEQUENCE_RULES: SequenceRule[] = [
	{
		name: 'na_adjective_attributive',
		priority: 75,
		resultType: 'phrase',
		pattern: [
			{ pos0: '形状詞' },
			{ surface: 'な', dictionaryForm: 'だ', pos0: '助動詞' },
		],
	},
	{
		name: 'noun_teki_suffix',
		priority: 75,
		resultType: 'phrase',
		pattern: [{ pos0: '名詞' }, { surface: '的', pos0: '接尾辞' }],
	},
	{
		name: 'noun_particle',
		priority: 75,
		resultType: 'phrase',
		pattern: [
			{ pos0: '名詞' },
			{ surface: ['など', 'なんか', 'なんて'], pos0: '助詞' },
		],
	},
	{
		name: 'suru_verb_te_mo',
		priority: 74,
		resultType: 'phrase',
		pattern: [
			{ chunkType: 'suru_verb_te_form' },
			{ surface: 'も', pos0: '助詞' },
		],
	},
	{
		name: 'pronoun_no',
		priority: 74,
		resultType: 'phrase',
		pattern: [{ pos0: '代名詞' }, { surface: 'の', pos0: '助詞' }],
	},
	{
		name: 'nanimo',
		priority: 74,
		resultType: 'phrase',
		pattern: [
			{ surface: '何', pos0: '代名詞' },
			{ surface: 'も', pos0: '助詞' },
		],
	},
	{
		name: 'tame_ni',
		priority: 73,
		resultType: 'phrase',
		pattern: [
			{ surface: ['ため', '為'], pos0: '名詞' },
			{ surface: 'に', pos0: '助詞' },
		],
	},
	{
		name: 'postposition_ni_tsuite_plus_particle',
		priority: 73,
		resultType: 'phrase',
		pattern: [
			{ surface: 'について' },
			{ surface: ['は', 'も', 'の', 'が', 'を', 'に', 'から', 'まで'] },
		],
	},
	{
		name: 'verb_made',
		priority: 73,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'まで', pos0: '助詞', pos1: '副助詞' },
		],
	},
	{
		name: 'postposition_ni_tsuite',
		priority: 73,
		resultType: 'phrase',
		pattern: [
			{ surface: 'に', pos0: '助詞' },
			{ surface: 'つい', dictionaryForm: 'つく', pos0: '動詞' },
			{ surface: 'て', pos0: '助詞', pos1: '接続助詞' },
		],
	},
	{
		name: 'quotative_to_iu_no_wa',
		priority: 73,
		resultType: 'phrase',
		pattern: [
			{ surface: 'と', pos0: '助詞' },
			{ dictionaryForm: 'いう', pos0: '動詞' },
			{ surface: 'の', pos0: '助詞' },
			{ surface: 'は', pos0: '助詞' },
		],
	},
	{
		name: 'quotative_to_iu_koto_wa',
		priority: 73,
		resultType: 'phrase',
		pattern: [
			{ surface: 'と', pos0: '助詞' },
			{ dictionaryForm: 'いう', pos0: '動詞' },
			{ surface: 'こと', pos0: '名詞' },
			{ surface: ['は', 'が', 'を', 'も'], pos0: '助詞' },
		],
	},
	{
		name: 'quotative_to_iu',
		priority: 73,
		resultType: 'phrase',
		pattern: [
			{ surface: 'と', pos0: '助詞' },
			{ dictionaryForm: 'いう', pos0: '動詞' },
		],
	},
	{
		name: 'quotative_to_itta_ra',
		priority: 73,
		resultType: 'phrase',
		pattern: [
			{ surface: 'と', pos0: '助詞' },
			{ dictionaryForm: '言う', pos0: '動詞' },
			{ surface: 'たら' },
		],
	},
	{
		name: 'quotative_to_itta_ra_split',
		priority: 73,
		resultType: 'phrase',
		pattern: [
			{ surface: 'と', pos0: '助詞' },
			{ dictionaryForm: '言う', pos0: '動詞' },
			{ surface: 'た', pos0: '助動詞' },
			{ surface: 'ら', pos0: '助詞' },
		],
	},
	{
		name: 'fixed_no_wa',
		priority: 73,
		resultType: 'phrase',
		pattern: [
			{ surface: 'の', pos0: '助詞' },
			{ surface: 'は', pos0: '助詞' },
		],
	},
];

const FIXED_SEQUENCE_RULES: SequenceRule[] = [
	{
		name: 'fixed_wake_ga_nai',
		priority: 72,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'わけ' }, { surface: 'が' }, { surface: 'ない' }],
	},
	{
		name: 'fixed_hazu_ga_nai',
		priority: 72,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'はず' }, { surface: 'が' }, { surface: 'ない' }],
	},
	{
		name: 'fixed_shikata_ga_nai',
		priority: 72,
		resultType: 'fixed_expression',
		pattern: [{ surface: '仕方' }, { surface: 'が' }, { surface: 'ない' }],
	},
	{
		name: 'fixed_kamo_shirenai',
		priority: 72,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'かも' }, { surface: 'しれ' }, { surface: 'ない' }],
	},
	{
		name: 'fixed_kamo_shirenai_split',
		priority: 72,
		resultType: 'fixed_expression',
		pattern: [
			{ surface: 'か' },
			{ surface: 'も' },
			{ surface: 'しれ' },
			{ surface: 'ない' },
		],
	},
	{
		name: 'fixed_toshitomo',
		priority: 72,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'と' }, { surface: '共に' }],
	},
	{
		name: 'fixed_sorede',
		priority: 72,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'それ' }, { surface: ['で', 'でっ'] }],
	},
	{
		name: 'fixed_nanto',
		priority: 72,
		resultType: 'fixed_expression',
		pattern: [{ surface: ['なん', '何'] }, { surface: 'と' }],
	},
	{
		name: 'fixed_souieba',
		priority: 72,
		resultType: 'fixed_expression',
		pattern: [
			{ surface: 'そう' },
			{ surface: ['いえ', '言え'] },
			{ surface: 'ば' },
		],
	},
	{
		name: 'fixed_tashika_ni',
		priority: 72,
		resultType: 'fixed_expression',
		pattern: [{ surface: '確か' }, { surface: 'に' }],
	},
	{
		name: 'fixed_honto_ni',
		priority: 72,
		resultType: 'fixed_expression',
		pattern: [{ surface: ['ホント', 'ほんと', '本当'] }, { surface: 'に' }],
	},
	{
		name: 'fixed_zaruwo_enai',
		priority: 72,
		resultType: 'fixed_expression',
		pattern: [
			{ pos0: '動詞' },
			{ surface: 'ざる' },
			{ surface: 'を', pos0: '助詞' },
			{ surface: '得', dictionaryForm: '得る', pos0: '動詞' },
			{ surface: 'ない' },
		],
	},
	{
		name: 'fixed_node',
		priority: 72,
		resultType: 'phrase',
		pattern: [{ surface: 'の' }, { surface: 'で' }],
	},
	{
		name: 'fixed_dewa_naku',
		priority: 72,
		resultType: 'phrase',
		pattern: [{ surface: 'で' }, { surface: 'は' }, { surface: 'なく' }],
	},
	{
		name: 'fixed_dewa',
		priority: 72,
		resultType: 'phrase',
		pattern: [
			{ surface: 'で', pos0: '助詞' },
			{ surface: 'は', pos0: '助詞' },
		],
	},
	{
		name: 'fixed_dewa_nakute',
		priority: 72,
		resultType: 'phrase',
		pattern: [
			{ surface: 'で' },
			{ surface: 'は' },
			{ surface: 'なく' },
			{ surface: 'て' },
		],
	},
	{
		name: 'fixed_dake_de_naku',
		priority: 72,
		resultType: 'phrase',
		pattern: [{ surface: 'だけ' }, { surface: 'で' }, { surface: 'なく' }],
	},
	{
		name: 'fixed_dake_dewa_naku',
		priority: 72,
		resultType: 'phrase',
		pattern: [
			{ surface: 'だけ' },
			{ surface: 'で' },
			{ surface: 'は' },
			{ surface: 'なく' },
		],
	},
	{
		name: 'fixed_dake_dewa_nakute',
		priority: 72,
		resultType: 'phrase',
		pattern: [
			{ surface: 'だけ' },
			{ surface: 'で' },
			{ surface: 'は' },
			{ surface: 'なく' },
			{ surface: 'て' },
		],
	},
];

const SEQUENCE_RULES: SequenceRule[] = [
	...COLLOQUIAL_SEQUENCE_RULES,
	...VERB_SEQUENCE_RULES,
	...PHRASE_SEQUENCE_RULES,
	...FIXED_SEQUENCE_RULES,
];

const BROAD_SEQUENCE_RULES: SequenceRule[] = [
	{
		name: 'noun_with_de',
		priority: 63,
		resultType: 'phrase',
		pattern: [{ pos0: '名詞' }, { surface: 'で', pos0: '助詞' }],
	},
	{
		name: 'adverb_with_ni',
		priority: 63,
		resultType: 'phrase',
		pattern: [{ pos0: '副詞' }, { surface: 'に', pos0: '助詞' }],
	},
];
