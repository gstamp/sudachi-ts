import type { Grammar } from '../dictionary/grammar.js';
import type { InputText } from './inputText.js';
import type { LatticeNode } from './lattice.js';
import type { Morpheme } from './morpheme.js';
import { MorphemeImpl } from './morpheme.js';
import type { SplitMode } from './tokenizer.js';

export class MorphemeList {
	private readonly _path: LatticeNode[];
	private readonly _grammar: Grammar | null;
	private readonly _inputText: InputText;

	constructor(
		inputText: InputText,
		path: LatticeNode[],
		_mode: SplitMode,
		_allowEmptyMorpheme = true,
		grammar: Grammar | null = null,
	) {
		this._inputText = inputText;
		this._path = path;
		this._grammar = grammar;
	}

	get(index: number): Morpheme {
		const node = this._path[index]!;
		const wordInfo = node.getWordInfo();
		const surface = wordInfo.getSurface();
		return new MorphemeImpl(
			this._inputText.getOriginalIndex(node.getBegin()),
			this._inputText.getOriginalIndex(node.getEnd()),
			surface,
			wordInfo,
			node.getWordId(),
			node.getDictionaryId(),
			this._grammar,
		);
	}

	size(): number {
		return this._path.length;
	}

	split(_mode: SplitMode): MorphemeList {
		return this;
	}

	getInternalCost(): number {
		if (this._path.length === 0) return 0;
		const first = this._path[0]?.getPathCost() ?? 0;
		const last = this._path[this._path.length - 1]?.getPathCost() ?? 0;
		return last - first;
	}

	[Symbol.iterator](): Iterator<Morpheme> {
		let index = 0;
		return {
			next: (): IteratorResult<Morpheme> => {
				if (index < this._path.length) {
					return { value: this.get(index++), done: false };
				}
				return { value: undefined as unknown as Morpheme, done: true };
			},
		};
	}
}
