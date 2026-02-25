import { CategoryType as CategoryTypeEnum } from '../dictionary/categoryType.js';
import type { Grammar } from '../dictionary/grammar.js';
import type { Lexicon } from '../dictionary/lexicon.js';
import type { InputTextPlugin } from '../plugins/inputText/base.js';
import type { OovProviderPlugin } from '../plugins/oov/base.js';
import type { PathRewritePlugin } from '../plugins/pathRewrite/base.js';
import type { NonBreakChecker } from '../sentdetect/sentenceDetector.js';
import { SentenceDetector } from '../sentdetect/sentenceDetector.js';
import { addNth } from '../utils/wordMask.js';
import type { InputText } from './inputText.js';
import type { Lattice, LatticeNode } from './lattice.js';
import { LatticeImpl, type LatticeNodeImpl } from './lattice.js';
import { dumpLattice } from './latticeDump.js';
import type { Morpheme } from './morpheme.js';
import type { MorphemeList } from './morphemeList.js';
import { MorphemeList as MorphemeListImpl } from './morphemeList.js';
import { SentenceSplittingLazyAnalysis } from './sentenceSplittingLazyAnalysis.js';
import type { Tokenizer } from './tokenizer.js';
import { SplitMode } from './tokenizer.js';
import { UTF8InputTextBuilder } from './utf8InputText.js';

const LEADING_WHITESPACE_PATTERN = /^\s+/u;

export class JapaneseTokenizer implements Tokenizer {
	private readonly grammar: Grammar;
	private readonly lexicon: Lexicon;
	private readonly lattice: Lattice;
	private readonly allowEmptyMorpheme: boolean;
	private readonly sentenceDetector: SentenceDetector;
	private dumpOutput: WritableStream<string> | null = null;
	private readonly inputTextPlugins: InputTextPlugin[];
	private readonly oovProviderPlugins: OovProviderPlugin[];
	private readonly pathRewritePlugins: PathRewritePlugin[];
	private readonly defaultOovProvider: OovProviderPlugin | null;

	constructor(
		grammar: Grammar,
		lexicon: Lexicon,
		inputTextPlugins: InputTextPlugin[] = [],
		oovProviderPlugins: OovProviderPlugin[] = [],
		pathRewritePlugins: PathRewritePlugin[] = [],
		sentenceDetector?: SentenceDetector,
	) {
		this.grammar = grammar;
		this.lexicon = lexicon;
		this.inputTextPlugins = inputTextPlugins;
		this.oovProviderPlugins = oovProviderPlugins;
		this.pathRewritePlugins = pathRewritePlugins;
		this.lattice = new LatticeImpl(grammar);
		this.allowEmptyMorpheme = true;
		this.sentenceDetector = sentenceDetector ?? new SentenceDetector();
		this.defaultOovProvider =
			oovProviderPlugins.length > 0
				? (oovProviderPlugins[oovProviderPlugins.length - 1] ?? null)
				: null;
	}

	tokenize(text: string): MorphemeList;
	tokenize(mode: SplitMode, text: string): MorphemeList;
	tokenize(modeOrText: SplitMode | string, text?: string): MorphemeList {
		if (typeof modeOrText === 'string') {
			return this.tokenize(SplitMode.C, modeOrText);
		}
		const mode = modeOrText as SplitMode;
		const inputText = text as string;
		if (inputText === '') {
			const input = this.buildInputText(inputText);
			return new MorphemeListImpl(
				input,
				[],
				mode,
				this.allowEmptyMorpheme,
				this.grammar,
			);
		}
		const input = this.buildInputText(inputText);
		return this.tokenizeSentence(mode, input);
	}

	tokenizeSentences(text: string): Iterable<MorphemeList>;
	tokenizeSentences(mode: SplitMode, text: string): Iterable<MorphemeList>;
	tokenizeSentences(
		modeOrText: SplitMode | string,
		text?: string,
	): Iterable<MorphemeList> {
		if (typeof modeOrText === 'string') {
			return this.tokenizeSentences(SplitMode.C, modeOrText);
		}
		const mode = modeOrText as SplitMode;
		const inputText = text as string;
		if (inputText === '') {
			return [];
		}

		const sentences: MorphemeList[] = [];
		let remaining = inputText;

		while (remaining.length > 0) {
			const leadingWhitespace = remaining.match(LEADING_WHITESPACE_PATTERN);
			if (leadingWhitespace) {
				remaining = remaining.slice(leadingWhitespace[0].length);
				if (remaining.length === 0) {
					break;
				}
			}

			const checker: NonBreakChecker = {
				hasNonBreakWord: (eos: number): boolean => {
					const bytes = this.buildInputText(
						remaining.slice(0, eos),
					).getByteText();
					const results = this.lexicon.lookup(bytes, bytes.length - 1);
					const result = results.next();
					return !result.done;
				},
			};

			const eos = this.sentenceDetector.getEos(remaining, checker);
			const sentenceText =
				eos >= 0 ? remaining.slice(0, eos) : remaining.slice(0, Math.abs(eos));
			const input = this.buildInputText(sentenceText);
			sentences.push(this.tokenizeSentence(mode, input));

			remaining =
				eos >= 0 ? remaining.slice(eos) : remaining.slice(Math.abs(eos));

			if (eos < 0 && Math.abs(eos) >= remaining.length) {
				break;
			}
		}

		return sentences;
	}

	lazyTokenizeSentences(
		input: ReadableStream<string> | AsyncIterable<string>,
	): AsyncIterable<Morpheme[]>;
	lazyTokenizeSentences(
		mode: SplitMode,
		input: ReadableStream<string> | AsyncIterable<string>,
	): AsyncIterable<Morpheme[]>;
	async *lazyTokenizeSentences(
		modeOrInput: SplitMode | ReadableStream<string> | AsyncIterable<string>,
		input?: ReadableStream<string> | AsyncIterable<string>,
	): AsyncIterable<Morpheme[]> {
		let mode: SplitMode;
		let inputStream: ReadableStream<string> | AsyncIterable<string>;

		if (typeof modeOrInput === 'object') {
			mode = SplitMode.C;
			inputStream = modeOrInput as
				| ReadableStream<string>
				| AsyncIterable<string>;
		} else {
			mode = modeOrInput as SplitMode;
			inputStream = input as ReadableStream<string> | AsyncIterable<string>;
		}

		if (inputStream instanceof ReadableStream) {
			const lazyAnalysis = new SentenceSplittingLazyAnalysis(
				mode,
				this.grammar,
				this.lexicon,
				inputStream,
				(m, input) => this.tokenizeSentence(m, input),
			);
			yield* lazyAnalysis;
		} else if (inputStream) {
			for await (const chunk of inputStream as AsyncIterable<string>) {
				const sentences = this.tokenizeSentences(mode, chunk);
				for (const sentence of sentences) {
					yield [...sentence];
				}
			}
		}
	}

	setDumpOutput(output: WritableStream<string>): void {
		this.dumpOutput = output;
	}

	dumpInternalStructures(text: string): string {
		const input = this.buildInputText(text);
		this.buildLattice(input);
		const path = this.lattice.getBestPath();
		const dump = dumpLattice(this.lattice, input, path) as any;

		const rewrittenPath = this.splitPath(path, SplitMode.A);
		dump.rewrittenPath = rewrittenPath.map((node) => ({
			begin: node.getBegin(),
			end: node.getEnd(),
			surface: input.getSubstring(node.getBegin(), node.getEnd()),
			wordId: node.getWordId(),
			dictionaryId: node.getDictionaryId(),
			isOOV: node.isOOV(),
			leftId: node.getLeftId(),
			rightId: node.getRightId(),
			cost: node.getCost(),
			totalCost: node.getTotalCost(),
			isConnectedToBOS: node.isConnectedToBOS(),
		}));

		this.lattice.clear();

		const json = JSON.stringify(dump, null, 2);
		if (this.dumpOutput) {
			const writer = this.dumpOutput.getWriter();
			writer.write(json);
			writer.close();
		}
		return json;
	}

	buildInputText(text: string): InputText {
		const builder = new UTF8InputTextBuilder(text, this.grammar);
		for (const plugin of this.inputTextPlugins) {
			plugin.rewrite(builder);
		}
		return builder.build();
	}

	private tokenizeSentence(mode: SplitMode, input: InputText): MorphemeList {
		for (const plugin of this.pathRewritePlugins) {
			plugin.validateSplitMode(mode);
		}

		this.buildLattice(input);
		const path = this.lattice.getBestPath();

		for (const plugin of this.pathRewritePlugins) {
			plugin.rewrite(input, path, this.lattice);
		}

		this.lattice.clear();

		if (mode !== SplitMode.C) {
			const newPath = this.splitPath(path, mode);
			return new MorphemeListImpl(
				input,
				newPath,
				mode,
				this.allowEmptyMorpheme,
				this.grammar,
			);
		}

		return new MorphemeListImpl(
			input,
			path,
			mode,
			this.allowEmptyMorpheme,
			this.grammar,
		);
	}

	private buildLattice(input: InputText): void {
		const bytes = input.getByteText();
		this.lattice.resize(bytes.length);

		for (let byteBoundary = 0; byteBoundary < bytes.length; byteBoundary++) {
			if (!input.canBow(byteBoundary) || !this.hasPreviousNode(byteBoundary)) {
				continue;
			}

			let wordMask = 0;
			for (const [wordId, length] of this.lexicon.lookup(bytes, byteBoundary)) {
				const end = byteBoundary + length;
				if (end < bytes.length && !input.canBow(end)) {
					continue;
				}

				const node = this.createNode(wordId);
				this.lattice.insert(byteBoundary, end, node);
				wordMask = addNth(wordMask, length);
			}

			if (
				!input.getCharCategoryTypes(byteBoundary).has(CategoryTypeEnum.NOOOVBOW)
			) {
				for (const plugin of this.oovProviderPlugins) {
					const nodeList: LatticeNodeImpl[] = [];
					wordMask = this.provideOovs(
						plugin,
						input,
						nodeList,
						byteBoundary,
						wordMask,
					);
					for (const node of nodeList) {
						this.lattice.insert(node.getBegin(), node.getEnd(), node);
					}
				}
			}

			if (wordMask === 0 && this.defaultOovProvider) {
				const nodeList: LatticeNodeImpl[] = [];
				wordMask = this.provideOovs(
					this.defaultOovProvider,
					input,
					nodeList,
					byteBoundary,
					wordMask,
				);
				for (const node of nodeList) {
					this.lattice.insert(node.getBegin(), node.getEnd(), node);
				}
			}

			if (wordMask === 0) {
				throw new Error(
					`failed to find any morpheme candidate at boundary ${byteBoundary}`,
				);
			}
		}

		this.lattice.connectEosNode();
	}

	private hasPreviousNode(index: number): boolean {
		return (this.lattice as LatticeImpl).hasPreviousNode(index);
	}

	private provideOovs(
		plugin: OovProviderPlugin,
		input: InputText,
		unkNodes: LatticeNodeImpl[],
		boundary: number,
		wordMask: number,
	): number {
		const initialSize = unkNodes.length;
		const created = plugin.getOOV(input, boundary, wordMask, unkNodes);
		if (created === 0) {
			return wordMask;
		}
		for (let i = initialSize; i < initialSize + created; ++i) {
			const node = unkNodes[i]!;
			wordMask = addNth(wordMask, node.getEnd() - node.getBegin());
		}
		return wordMask;
	}

	private createNode(wordId: number): LatticeNode {
		const node = this.lattice.createNode();
		const dictId = wordId >>> 28;
		const realWordId = wordId & 0x0fffffff;

		node.setWordId(realWordId);
		node.setDictionaryId(dictId);
		node.setWordInfo(this.lexicon.getWordInfo(wordId));
		node.setParameter(
			this.lexicon.getLeftId(wordId),
			this.lexicon.getRightId(wordId),
			this.lexicon.getCost(wordId),
		);
		return node;
	}

	private splitPath(path: LatticeNode[], mode: SplitMode): LatticeNode[] {
		const newPath: LatticeNode[] = [];
		for (const node of path) {
			this.appendSplits(node, mode, newPath);
		}
		return newPath;
	}

	private appendSplits(
		node: LatticeNode,
		mode: SplitMode,
		list: LatticeNode[],
	): void {
		const info = node.getWordInfo();
		const split =
			mode === SplitMode.A
				? info.getAunitSplit()
				: mode === SplitMode.B
					? info.getBunitSplit()
					: [];

		if (split.length <= 1) {
			list.push(node);
			return;
		}

		let offset = node.getBegin();
		for (const wordId of split) {
			const newNode = this.createNode(wordId);
			const length = newNode.getWordInfo().getLength();
			newNode.setRange(offset, offset + length);
			list.push(newNode);
			offset += length;
		}
	}
}
