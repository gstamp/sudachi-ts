import type { Grammar } from '../../dictionary/grammar.js';
import { EditConnectionCostPlugin } from '../connection/base.js';

export class InhibitConnectionPlugin extends EditConnectionCostPlugin {
	private inhibitedPairs: number[][] = [];

	override setUp(_grammar: Grammar): void {
		this.inhibitedPairs = this.settings.getIntListList('inhibitedPair');
	}

	edit(grammar: Grammar): void {
		for (const pair of this.inhibitedPairs) {
			if (pair.length < 2) {
				continue;
			}
			this.inhibitConnection(grammar, pair[0]!, pair[1]!);
		}
	}
}
