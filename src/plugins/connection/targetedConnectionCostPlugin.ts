import type { Grammar } from '../../dictionary/grammar.js';
import type { Lexicon } from '../../dictionary/lexicon.js';
import { EditConnectionCostPlugin } from './base.js';

interface EntryTarget {
	surface: string;
	pos: string[];
	reading: string;
}

interface ConnectionRule {
	left: EntryTarget;
	right: EntryTarget;
	cost: number;
}

interface ResolvedRule {
	leftRightId: number;
	rightLeftId: number;
	cost: number;
}

export class TargetedConnectionCostPlugin extends EditConnectionCostPlugin {
	private rules: ResolvedRule[] = [];

	override setUp(grammar: Grammar, lexicon?: Lexicon): void {
		if (!lexicon) {
			throw new Error(
				'TargetedConnectionCostPlugin requires the lexicon during setup',
			);
		}

		const rawRules = this.settings.toObject().rules;
		if (!Array.isArray(rawRules) || rawRules.length === 0) {
			throw new Error('rules is undefined');
		}

		this.rules = rawRules.map((rule, index) =>
			this.resolveRule(grammar, lexicon, rule, index + 1),
		);
	}

	edit(grammar: Grammar): void {
		for (const rule of this.rules) {
			grammar.setConnectCost(rule.leftRightId, rule.rightLeftId, rule.cost);
		}
	}

	private resolveRule(
		grammar: Grammar,
		lexicon: Lexicon,
		rule: unknown,
		ruleIndex: number,
	): ResolvedRule {
		const parsedRule = this.requireConnectionRule(rule, ruleIndex);
		const leftWordId = this.resolveWordId(
			grammar,
			lexicon,
			parsedRule.left,
			'rule',
			ruleIndex,
			'left',
		);
		const rightWordId = this.resolveWordId(
			grammar,
			lexicon,
			parsedRule.right,
			'rule',
			ruleIndex,
			'right',
		);

		return {
			leftRightId: lexicon.getRightId(leftWordId),
			rightLeftId: lexicon.getLeftId(rightWordId),
			cost: parsedRule.cost,
		};
	}

	private resolveWordId(
		grammar: Grammar,
		lexicon: Lexicon,
		target: EntryTarget,
		ruleLabel: string,
		ruleIndex: number,
		side: 'left' | 'right',
	): number {
		if (typeof target.surface !== 'string' || target.surface === '') {
			throw new Error(
				`${ruleLabel} ${ruleIndex} ${side} surface must be a non-empty string`,
			);
		}
		if (typeof target.reading !== 'string' || target.reading === '') {
			throw new Error(
				`${ruleLabel} ${ruleIndex} ${side} reading must be a non-empty string`,
			);
		}
		const pos = this.normalizePos(target.pos, ruleLabel, ruleIndex, side);
		const posId = grammar.getPartOfSpeechId(pos);
		if (posId < 0) {
			throw new Error(
				`${ruleLabel} ${ruleIndex} ${side} POS ${pos.join(',')} was not found in the loaded grammar`,
			);
		}

		const wordId = lexicon.getWordId(target.surface, posId, target.reading);
		if (wordId < 0) {
			throw new Error(
				`${ruleLabel} ${ruleIndex} ${side} entry ${target.surface} (${pos.join(',')} / ${target.reading}) was not found in the loaded lexicon`,
			);
		}
		return wordId;
	}

	private normalizePos(
		pos: unknown,
		ruleLabel: string,
		ruleIndex: number,
		side: 'left' | 'right',
	): string[] {
		if (!Array.isArray(pos) || pos.length === 0) {
			throw new Error(
				`${ruleLabel} ${ruleIndex} ${side} pos must be a non-empty string list`,
			);
		}

		const normalized = pos.map((item) => {
			if (typeof item !== 'string') {
				throw new Error(
					`${ruleLabel} ${ruleIndex} ${side} pos must contain only strings`,
				);
			}
			return item;
		});

		while (normalized.length < 6) {
			normalized.push('*');
		}

		return normalized.slice(0, 6);
	}

	private requireConnectionRule(
		rule: unknown,
		ruleIndex: number,
	): ConnectionRule {
		if (typeof rule !== 'object' || rule === null) {
			throw new Error(`rule ${ruleIndex} must be an object`);
		}

		const obj = rule as Record<string, unknown>;
		const left = obj.left;
		const right = obj.right;
		const cost = obj.cost;

		if (typeof cost !== 'number') {
			throw new Error(`rule ${ruleIndex} cost must be a number`);
		}

		return {
			left: this.requireEntryTarget(left, ruleIndex, 'left'),
			right: this.requireEntryTarget(right, ruleIndex, 'right'),
			cost,
		};
	}

	private requireEntryTarget(
		value: unknown,
		ruleIndex: number,
		side: 'left' | 'right',
	): EntryTarget {
		if (typeof value !== 'object' || value === null) {
			throw new Error(`rule ${ruleIndex} ${side} must be an object`);
		}

		const obj = value as Record<string, unknown>;
		const surface = obj.surface;
		const pos = obj.pos;
		const reading = obj.reading;

		if (typeof surface !== 'string') {
			throw new Error(`rule ${ruleIndex} ${side} surface must be a string`);
		}
		if (!Array.isArray(pos)) {
			throw new Error(`rule ${ruleIndex} ${side} pos must be a string list`);
		}
		if (typeof reading !== 'string') {
			throw new Error(`rule ${ruleIndex} ${side} reading must be a string`);
		}

		return {
			surface,
			pos: pos as string[],
			reading,
		};
	}
}
