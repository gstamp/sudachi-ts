import type { InputText } from '../../core/inputText.js';
import type { LatticeNodeImpl } from '../../core/lattice.js';
import type { Grammar } from '../../dictionary/grammar.js';
import { POS } from '../../dictionary/pos.js';
import { WordInfo } from '../../dictionary/wordInfo.js';
import { hasNth } from '../../utils/wordMask.js';
import { OovProviderPlugin } from './base.js';

export class RegexOovProviderPlugin extends OovProviderPlugin {
	private pattern: RegExp | null = null;
	private posId: number = -1;
	private cost: number = 0;
	private leftId: number = 0;
	private rightId: number = 0;
	private maxLength: number = 32;
	private strictBoundaries: boolean = true;

	override setUp(grammar: Grammar): void {
		super.setUp(grammar);

		const regex = this.settings.getString('regex');
		if (!regex) {
			throw new Error('regex is required for RegexOovProviderPlugin');
		}

		let posList = this.settings.getStringList('oovPOS');
		if (posList.length === 0) {
			posList = this.settings.getStringList('pos');
		}
		while (posList.length < 6) {
			posList.push('');
		}
		const pos = new POS(...posList.slice(0, 6));

		const userPosMode =
			this.settings.getString(
				OovProviderPlugin.USER_POS,
				OovProviderPlugin.USER_POS_FORBID,
			) ?? OovProviderPlugin.USER_POS_FORBID;
		this.posId = this.posIdOf(grammar, pos, userPosMode);

		this.cost = this.checkedShort('cost');
		this.leftId = this.checkedShort('leftId');
		this.rightId = this.checkedShort('rightId');

		this.pattern = this.checkPattern(regex);

		this.maxLength = this.settings.getInt('maxLength', 32);
		this.strictBoundaries = this.isStrictContinuity();
	}

	provideOOV(
		inputText: InputText,
		offset: number,
		otherWords: number,
		result: LatticeNodeImpl[],
	): number {
		if (!this.pattern) {
			return 0;
		}

		if (this.strictBoundaries && offset > 0) {
			const currentContinuity =
				inputText.getCharCategoryContinuousLength(offset);
			const previousContinuity = inputText.getCharCategoryContinuousLength(
				offset - 1,
			);
			if (currentContinuity + 1 === previousContinuity) {
				return 0;
			}
		}

		const text = inputText.getText();
		const byteText = inputText.getByteText();
		const textLength = byteText.length;

		const regionStartChars = inputText.modifiedOffset(offset);
		const regionEndBytes = Math.min(offset + this.maxLength, textLength);
		const regionEndChars = inputText.modifiedOffset(regionEndBytes);

		this.pattern.lastIndex = 0;

		const matchResult = this.pattern.exec(
			text.slice(regionStartChars, regionEndChars),
		);

		if (!matchResult || matchResult.index !== 0) {
			return 0;
		}

		const matchedText = matchResult[0]!;
		const endChar = regionStartChars + matchedText.length;
		const oovLength = inputText.getCodePointsOffsetLength(
			offset,
			endChar - regionStartChars,
		);

		if (hasNth(otherWords, oovLength)) {
			if (oovLength > 63) {
				const byteEnd = offset + oovLength;
				for (const node of result) {
					if (node.end === byteEnd) {
						return 0;
					}
				}
			} else {
				return 0;
			}
		}

		const node = this.createNode();
		node.setParameter(this.leftId, this.rightId, this.cost);
		const info = new WordInfo(
			matchedText,
			oovLength,
			this.posId,
			matchedText,
			matchedText,
			'',
		);
		node.setWordInfo(info);
		result.push(node);
		return 1;
	}

	private checkedShort(name: string): number {
		const value = this.settings.getInt(name);
		const maxValue = 32767;
		if (value > maxValue) {
			throw new Error(
				`The value of parameter ${name} was larger than ${maxValue}`,
			);
		}
		return value;
	}

	private checkPattern(regex: string): RegExp {
		let pattern = regex;
		if (!pattern.startsWith('^')) {
			pattern = `^${pattern}`;
		}
		return new RegExp(pattern);
	}

	private isStrictContinuity(): boolean {
		const content = this.settings.getString('boundaries', 'strict');
		if (!content) {
			throw new Error('boundaries setting is missing or invalid');
		}
		const lower = content.toLowerCase();
		if (lower === 'strict') {
			return true;
		}
		if (lower === 'relaxed') {
			return false;
		}
		throw new Error(
			`allowed continuity values: [strict, relaxed], was ${content}`,
		);
	}
}
