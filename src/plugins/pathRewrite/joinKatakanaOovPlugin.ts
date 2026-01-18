import type { InputText } from '../../core/inputText.js';
import type { Lattice, LatticeNode } from '../../core/lattice.js';
import { CategoryType } from '../../dictionary/categoryType.js';
import type { Grammar } from '../../dictionary/grammar.js';
import { PathRewritePlugin } from '../pathRewrite/base.js';

export class JoinKatakanaOovPlugin extends PathRewritePlugin {
	private oovPosId: number = 0;
	private minLength: number = 1;

	override setUp(grammar: Grammar): void {
		const pos = this.settings.getStringList('oovPOS');
		if (pos.length === 0) {
			throw new Error('oovPOS is undefined');
		}
		this.oovPosId = grammar.getPartOfSpeechId(pos);
		if (this.oovPosId < 0) {
			throw new Error('oovPOS is invalid');
		}
		this.minLength = this.settings.getInt('minLength', 1);
		if (this.minLength < 0) {
			throw new Error('minLength is negative');
		}
	}

	rewrite(text: InputText, path: LatticeNode[], lattice: Lattice): void {
		for (let i = 0; i < path.length; i++) {
			const node = path[i]!;

			if (
				(node.isOOV() || this.isShorter(this.minLength, text, node)) &&
				this.isKatakanaNode(text, node)
			) {
				let begin = i - 1;
				for (; begin >= 0; begin--) {
					if (!this.isKatakanaNode(text, path[begin]!)) {
						begin++;
						break;
					}
				}
				if (begin < 0) {
					begin = 0;
				}

				let end = i + 1;
				for (; end < path.length; end++) {
					if (!this.isKatakanaNode(text, path[end]!)) {
						break;
					}
				}

				while (begin !== end && !this.canOovBowNode(text, path[begin]!)) {
					begin++;
				}

				if (end - begin > 1) {
					this.concatenateOov(path, begin, end, this.oovPosId, lattice);
					i = begin + 1;
				}
			}
		}
	}

	private isKatakanaNode(text: InputText, node: LatticeNode): boolean {
		return this.getCharCategoryTypes(text, node).has(CategoryType.KATAKANA);
	}

	private isShorter(
		length: number,
		text: InputText,
		node: LatticeNode,
	): boolean {
		return text.codePointCount(node.getBegin(), node.getEnd()) < length;
	}

	private canOovBowNode(text: InputText, node: LatticeNode): boolean {
		return !text
			.getCharCategoryTypes(node.getBegin())
			.has(CategoryType.NOOOVBOW);
	}
}
