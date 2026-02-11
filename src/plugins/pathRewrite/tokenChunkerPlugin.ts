import type { InputText } from '../../core/inputText.js';
import type { Lattice, LatticeNode } from '../../core/lattice.js';
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
	private enableCompoundNouns = true;
	private minCompoundLength = 2;
	private excludedNounSubcategories = new Set(['数詞', '接尾']);

	override setUp(grammar: Grammar): void {
		this.grammar = grammar;
		this.enablePatternRules = this.settings.getBoolean(
			'enablePatternRules',
			true,
		);
		this.enableBroadRules = this.settings.getBoolean('enableBroadRules', false);
		this.enableCompoundNouns = this.settings.getBoolean(
			'enableCompoundNouns',
			true,
		);
		this.minCompoundLength = this.settings.getInt('minCompoundLength', 2);
		if (this.minCompoundLength < 2) {
			throw new Error('minCompoundLength must be >= 2');
		}

		const configured = this.settings.getStringList('excludedNounSubcategories');
		if (configured.length > 0) {
			this.excludedNounSubcategories = new Set(configured);
		}
	}

	rewrite(_text: InputText, path: LatticeNode[], lattice: Lattice): void {
		if (path.length === 0) {
			return;
		}

		let chunks = this.toInitialChunks(path);
		if (this.enablePatternRules) {
			chunks = this.applyPatternStage(chunks);
			chunks = this.applyNumericExpressionStage(chunks);
			chunks = this.applyCounterStage(chunks);
			chunks = this.applyMergeStage(chunks);
		}
		if (this.enableCompoundNouns) {
			chunks = this.applyCompoundNounStage(chunks);
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
			if (!current || !next) {
				i++;
				continue;
			}

			if (
				(current.chunkType === 'te_form' ||
					current.chunkType === 'suru_verb_te_form') &&
				(next.chunkType === 'single_token' || next.chunkType === 'phrase') &&
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

			i++;
		}
		return chunks;
	}

	private applyCompoundNounStage(source: ChunkToken[]): ChunkToken[] {
		const chunks = [...source];
		for (let i = 0; i < chunks.length; i++) {
			if (!this.isChunkableNoun(chunks[i])) {
				continue;
			}

			let end = i + 1;
			while (
				end < chunks.length &&
				this.isChunkableNoun(chunks[end]) &&
				this.canMergeAsCompoundNoun(chunks[end - 1], chunks[end])
			) {
				end++;
			}
			const length = end - i;
			if (length >= this.minCompoundLength) {
				const merged = this.mergeChunks(chunks.slice(i, end), 'compound_noun');
				chunks.splice(i, end - i, merged);
			}
		}
		return chunks;
	}

	private isChunkableNoun(chunk: ChunkToken | undefined): boolean {
		if (!chunk) {
			return false;
		}
		if (chunk.chunkType !== 'single_token') {
			return false;
		}
		const pos = this.getPosById(chunk.posId);
		if (!pos || pos[0] !== '名詞') {
			return false;
		}
		if (COMPOUND_NOUN_SYMBOL_SURFACES.has(chunk.surface)) {
			return false;
		}
		return !this.excludedNounSubcategories.has(pos[1] ?? '');
	}

	private canMergeAsCompoundNoun(
		left: ChunkToken | undefined,
		right: ChunkToken | undefined,
	): boolean {
		if (!left || !right) {
			return false;
		}
		if (
			COMPOUND_NOUN_BLOCKED_RIGHT_SURFACES.has(right.surface) ||
			COMPOUND_NOUN_BLOCKED_LEFT_SURFACES.has(left.surface)
		) {
			return false;
		}
		return true;
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

const COMPOUND_NOUN_SYMBOL_SURFACES = new Set([
	'%',
	'％',
	'¥',
	'￥',
	',',
	'，',
	'.',
	'．',
	'/',
]);

const COMPOUND_NOUN_BLOCKED_RIGHT_SURFACES = new Set([
	'以上',
	'以下',
	'未満',
	'以内',
	'程度',
	'くらい',
	'ぐらい',
	'ほど',
]);

const COMPOUND_NOUN_BLOCKED_LEFT_SURFACES = new Set([
	'%',
	'％',
	'¥',
	'￥',
	'まま',
]);

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
		name: 'suru_masu',
		priority: 101,
		resultType: 'phrase',
		pattern: [
			{ surface: 'し', dictionaryForm: ['する', '為る'], pos0: '動詞' },
			{ surface: 'ます', pos0: '助動詞' },
		],
	},
	{
		name: 'verb_desiderative_takatta',
		priority: 100,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['たい', 'たかっ'], pos0: ['助動詞', '形容詞'] },
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
		name: 'colloquial_te_ru',
		priority: 97,
		resultType: 'progressive_form',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['て', 'で'], pos0: '助詞', pos1: '接続助詞' },
			{ surface: 'る', pos0: '助動詞' },
		],
	},
	{
		name: 'verb_te_nai',
		priority: 97,
		resultType: 'phrase',
		pattern: [
			{ pos0: '動詞' },
			{ surface: ['て', 'で'], pos0: '助詞', pos1: '接続助詞' },
			{ surface: 'ない', pos0: '助動詞' },
		],
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
		name: 'verb_chau',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ pos0: '動詞' }, { surface: ['ちゃう', 'じゃう'] }],
	},
	{
		name: 'verb_nakya',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ pos0: '動詞' }, { surface: 'なきゃ' }],
	},
	{
		name: 'verb_nakucha',
		priority: 96,
		resultType: 'phrase',
		pattern: [{ pos0: '動詞' }, { surface: 'なく' }, { surface: 'ちゃ' }],
	},
	{
		name: 'n_ja_nai',
		priority: 96,
		resultType: 'phrase',
		pattern: [
			{ surface: 'ん' },
			{ surface: 'じゃ', pos0: '助詞' },
			{ surface: 'ない', pos0: '助動詞' },
		],
	},
	{
		name: 'noun_or_pronoun_ja_nai',
		priority: 95,
		resultType: 'phrase',
		pattern: [
			{ pos0: ['名詞', '代名詞'] },
			{ surface: 'じゃ', pos0: '助詞' },
			{ surface: 'ない', pos0: '助動詞' },
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
		name: 'fixed_datte',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'だ' }, { surface: 'って' }],
	},
	{
		name: 'fixed_dakara',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'だ' }, { surface: 'から' }],
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
		name: 'adjective_nai',
		priority: 94,
		resultType: 'phrase',
		pattern: [{ pos0: '形容詞' }, { surface: 'ない', pos0: '助動詞' }],
	},
	{
		name: 'adjective_wa_nai',
		priority: 94,
		resultType: 'phrase',
		pattern: [
			{ pos0: '形容詞' },
			{ surface: 'は', pos0: '助詞' },
			{ surface: 'ない', pos0: '助動詞' },
		],
	},
	{
		name: 'fixed_kousan_small_tsu',
		priority: 94,
		resultType: 'fixed_expression',
		pattern: [{ surface: '降参' }, { surface: 'っ' }],
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
		pattern: [{ surface: 'です' }, { surface: 'よ', pos0: '助詞' }],
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
		name: 'noun_particle',
		priority: 75,
		resultType: 'phrase',
		pattern: [
			{ pos0: '名詞' },
			{ surface: ['など', 'なんか', 'なんて'], pos0: '助詞' },
		],
	},
	{
		name: 'pronoun_no',
		priority: 74,
		resultType: 'phrase',
		pattern: [{ pos0: '代名詞' }, { surface: 'の', pos0: '助詞' }],
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
		name: 'fixed_toshitomo',
		priority: 72,
		resultType: 'fixed_expression',
		pattern: [{ surface: 'と' }, { surface: '共に' }],
	},
	{
		name: 'fixed_tashika_ni',
		priority: 72,
		resultType: 'fixed_expression',
		pattern: [{ surface: '確か' }, { surface: 'に' }],
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
