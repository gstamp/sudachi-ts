import type { InputText } from '../../core/inputText.js';
import { LatticeNodeImpl } from '../../core/lattice.js';
import type { Grammar } from '../../dictionary/grammar.js';
import type { GrammarImpl } from '../../dictionary/grammarImpl.js';
import type { POS } from '../../dictionary/pos.js';
import { Plugin } from '../base.js';

export abstract class OovProviderPlugin extends Plugin {
	static readonly USER_POS = 'userPOS';
	static readonly USER_POS_FORBID = 'forbid';
	static readonly USER_POS_ALLOW = 'allow';

	setUp(_grammar: Grammar): void {}

	abstract provideOOV(
		inputText: InputText,
		offset: number,
		otherWords: number,
		result: LatticeNodeImpl[],
	): number;

	getOOV(
		inputText: InputText,
		offset: number,
		otherWords: number,
		result: LatticeNodeImpl[],
	): number {
		const oldSize = result.length;
		const numCreated = this.provideOOV(inputText, offset, otherWords, result);
		for (let i = 0; i < numCreated; i++) {
			const node = result[oldSize + i]!;
			node.begin = offset;
			node.end = offset + node.getWordInfo().getLength();
		}
		return numCreated;
	}

	protected createNode(): LatticeNodeImpl {
		const node = new LatticeNodeImpl(null, 0, 0, 0, -1);
		node.setOOV();
		return node;
	}

	protected posIdOf(grammar: Grammar, pos: POS, userPosMode: string): number {
		const posIdPresent = grammar.getPartOfSpeechId(pos.toList());
		const lowerMode = userPosMode.toLowerCase();

		if (lowerMode === OovProviderPlugin.USER_POS_FORBID) {
			if (posIdPresent >= 0) {
				return posIdPresent;
			}
			throw new Error(
				`POS ${pos.toString()} was not present in dictionary and OOV Plugin is forbidden to add new POS tags`,
			);
		} else if (lowerMode !== OovProviderPlugin.USER_POS_ALLOW) {
			throw new Error(
				`Unknown user POS mode: ${userPosMode}. Allowed values are: ${OovProviderPlugin.USER_POS_FORBID}, ${OovProviderPlugin.USER_POS_ALLOW}`,
			);
		}

		const grammarImpl = grammar as GrammarImpl;
		return grammarImpl.registerPOS(pos);
	}
}
