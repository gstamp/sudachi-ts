import type { Grammar } from '../../dictionary/grammar.js';
import type { Lexicon } from '../../dictionary/lexicon.js';
import { Plugin } from '../base.js';

export abstract class EditConnectionCostPlugin extends Plugin {
	setUp(_grammar: Grammar, _lexicon?: Lexicon): void {}

	abstract edit(grammar: Grammar): void;

	public inhibitConnection(
		grammar: Grammar,
		left: number,
		right: number,
	): void {
		grammar.setConnectCost(left, right, grammar.INHIBITED_CONNECTION);
	}
}
