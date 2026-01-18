import type { InputText } from '../../core/inputText.js';
import type { LatticeNodeImpl } from '../../core/lattice.js';
import type { Grammar } from '../../dictionary/grammar.js';
import { POS } from '../../dictionary/pos.js';
import { WordInfo } from '../../dictionary/wordInfo.js';
import { OovProviderPlugin } from './base.js';

export class SimpleOovProviderPlugin extends OovProviderPlugin {
	private oovPOSId: number = 0;
	private leftId: number = 0;
	private rightId: number = 0;
	private cost: number = 0;

	override setUp(grammar: Grammar): void {
		const posList = this.settings.getStringList('oovPOS');
		while (posList.length < 6) {
			posList.push('');
		}
		const pos = new POS(...posList.slice(0, 6));
		this.leftId = this.settings.getInt('leftId');
		this.rightId = this.settings.getInt('rightId');
		this.cost = this.settings.getInt('cost');
		const userPosMode =
			this.settings.getString(
				OovProviderPlugin.USER_POS,
				OovProviderPlugin.USER_POS_FORBID,
			) ?? OovProviderPlugin.USER_POS_FORBID;
		this.oovPOSId = this.posIdOf(grammar, pos, userPosMode);
	}

	provideOOV(
		inputText: InputText,
		_offset: number,
		otherWords: number,
		result: LatticeNodeImpl[],
	): number {
		if (otherWords === 0) {
			const node = this.createNode();
			node.setParameter(this.leftId, this.rightId, this.cost);
			const length = inputText.getWordCandidateLength(0);
			const s = inputText.getSubstring(0, length);
			const info = new WordInfo(s, length, this.oovPOSId, s, s, '');
			node.setWordInfo(info);
			result.push(node);
			return 1;
		}
		return 0;
	}
}
