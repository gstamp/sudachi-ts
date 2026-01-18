import type { InputTextBuilder } from '../../core/inputTextBuilder.js';
import { CategoryType } from '../../dictionary/categoryType.js';
import type { Grammar } from '../../dictionary/grammar.js';
import { InputTextPlugin } from '../inputText/base.js';

export class IgnoreYomiganaPlugin extends InputTextPlugin {
	private leftBracketSet: Set<number> = new Set();
	private rightBracketSet: Set<number> = new Set();
	private maxYomiganaLength: number = 4;
	private grammar: Grammar | null = null;

	override setUp(grammar: Grammar): void {
		this.grammar = grammar;
		const leftBracketString = this.settings.getStringList('leftBrackets');
		for (const s of leftBracketString) {
			if (s.length > 0) {
				this.leftBracketSet.add(s.codePointAt(0)!);
			}
		}
		const rightBracketString = this.settings.getStringList('rightBrackets');
		for (const s of rightBracketString) {
			if (s.length > 0) {
				this.rightBracketSet.add(s.codePointAt(0)!);
			}
		}
		this.maxYomiganaLength = this.settings.getInt('maxYomiganaLength', 4);
	}

	rewrite(builder: InputTextBuilder): void {
		const text = builder.getText();
		const n = text.length;
		let startBracketPoint = -1;
		let offset = 0;
		let hasYomigana = false;

		for (let i = 1; i < n; i++) {
			const cp = text.codePointAt(i)!;

			if (
				this.isKanji(text.codePointAt(i - 1)!) &&
				this.leftBracketSet.has(cp)
			) {
				startBracketPoint = i;
			} else if (hasYomigana && this.rightBracketSet.has(cp)) {
				builder.replace(
					startBracketPoint - 1 - offset,
					i + 1 - offset,
					text.substring(startBracketPoint - 1, startBracketPoint),
				);
				offset += i - startBracketPoint + 1;
				startBracketPoint = -1;
				hasYomigana = false;
			} else if (startBracketPoint !== -1) {
				if (
					(this.isHiragana(cp) || this.isKatakana(cp)) &&
					i - startBracketPoint <= this.maxYomiganaLength
				) {
					hasYomigana = true;
				} else {
					startBracketPoint = -1;
					hasYomigana = false;
				}
			}
		}
	}

	private isKanji(cp: number): boolean {
		if (!this.grammar) {
			return false;
		}
		const charCategory = this.grammar.getCharacterCategory();
		if (!charCategory) {
			return false;
		}
		return charCategory.getCategoryTypes(cp).has(CategoryType.KANJI);
	}

	private isHiragana(cp: number): boolean {
		if (!this.grammar) {
			return false;
		}
		const charCategory = this.grammar.getCharacterCategory();
		if (!charCategory) {
			return false;
		}
		return charCategory.getCategoryTypes(cp).has(CategoryType.HIRAGANA);
	}

	private isKatakana(cp: number): boolean {
		if (!this.grammar) {
			return false;
		}
		const charCategory = this.grammar.getCharacterCategory();
		if (!charCategory) {
			return false;
		}
		return charCategory.getCategoryTypes(cp).has(CategoryType.KATAKANA);
	}
}
