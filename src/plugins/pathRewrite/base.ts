import type { InputText } from '../../core/inputText.js';
import type { Lattice, LatticeNode } from '../../core/lattice.js';
import type { SplitMode } from '../../core/tokenizer.js';
import type { CategoryType } from '../../dictionary/categoryType.js';
import type { Grammar } from '../../dictionary/grammar.js';
import { WordInfo } from '../../dictionary/wordInfo.js';
import { Plugin } from '../base.js';

export abstract class PathRewritePlugin extends Plugin {
	setUp(_grammar: Grammar): void {}

	validateSplitMode(_mode: SplitMode): void {}

	abstract rewrite(
		text: InputText,
		path: LatticeNode[],
		lattice: Lattice,
	): void;

	public concatenate(
		path: LatticeNode[],
		begin: number,
		end: number,
		lattice: Lattice,
		normalizedForm: string | null = null,
	): LatticeNode {
		if (begin >= end) {
			throw new Error('begin >= end');
		}

		const b = path[begin]?.getBegin() ?? 0;
		const e = path[end - 1]?.getEnd() ?? 0;
		const posId = path[begin]?.getWordInfo().getPOSId() ?? 0;

		const surfaceParts: string[] = [];
		let length = 0;
		const normalizedFormParts: string[] = [];
		const dictionaryFormParts: string[] = [];
		const readingFormParts: string[] = [];

		for (let i = begin; i < end; i++) {
			const info = path[i]?.getWordInfo();
			if (!info) continue;
			surfaceParts.push(info.getSurface());
			length += info.getLength();
			if (normalizedForm === null) {
				normalizedFormParts.push(info.getNormalizedForm());
			}
			dictionaryFormParts.push(info.getDictionaryForm());
			readingFormParts.push(info.getReadingForm());
		}

		const wi = new WordInfo(
			surfaceParts.join(''),
			length,
			posId,
			normalizedForm === null ? normalizedFormParts.join('') : normalizedForm,
			dictionaryFormParts.join(''),
			readingFormParts.join(''),
		);

		const node = lattice.createNode();
		node.setRange(b ?? 0, e ?? 0);
		node.setWordInfo(wi);
		this.replaceNode(path, begin, end, node);
		return node;
	}

	public concatenateOov(
		path: LatticeNode[],
		begin: number,
		end: number,
		posId: number,
		lattice: Lattice,
	): LatticeNode {
		if (begin >= end) {
			throw new Error('begin >= end');
		}

		const b = path[begin]?.getBegin() ?? 0;
		const e = path[end - 1]?.getEnd() ?? 0;

		const n = lattice.getMinimumNode(b, e);
		if (n !== null) {
			this.replaceNode(path, begin, end, n);
			return n;
		}

		const surfaceParts: string[] = [];
		let length = 0;

		for (let i = begin; i < end; i++) {
			const info = path[i]?.getWordInfo();
			if (!info) continue;
			surfaceParts.push(info.getSurface());
			length += info.getLength();
		}

		const s = surfaceParts.join('');
		const wi = new WordInfo(s, length, posId, s, s, '');

		const node = lattice.createNode();
		node.setRange(b, e);
		node.setWordInfo(wi);
		node.setOOV();
		this.replaceNode(path, begin, end, node);
		return node;
	}

	public getCharCategoryTypes(
		text: InputText,
		node: LatticeNode,
	): Set<CategoryType> {
		return text.getCharCategoryTypes(node.getBegin(), node.getEnd());
	}

	private replaceNode(
		path: LatticeNode[],
		begin: number,
		end: number,
		node: LatticeNode,
	): void {
		path.splice(begin, end - begin, node);
	}
}
