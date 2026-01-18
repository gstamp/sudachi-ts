import { CategoryType } from '../dictionary/categoryType.js';
import type { Grammar } from '../dictionary/grammar.js';
import type { InputText } from './inputText.js';
import type { InputTextBuilder } from './inputTextBuilder.js';

export class UTF8InputTextBuilder implements InputTextBuilder {
	private readonly originalText: string;
	private modifiedText: string;
	private modifiedToOriginal: number[];

	private readonly grammar: Grammar;

	constructor(text: string, grammar: Grammar) {
		this.grammar = grammar;
		this.originalText = text;
		this.modifiedText = text;
		this.modifiedToOriginal = this.buildModifiedToOriginal(text);
	}

	private buildModifiedToOriginal(text: string): number[] {
		const result: number[] = [];
		for (let i = 0; i < text.length; i++) {
			const char = text.charCodeAt(i);
			if (this.isHighSurrogate(char)) {
				i++;
				if (i < text.length) {
					const nextChar = text.charCodeAt(i);
					if (this.isLowSurrogate(nextChar)) {
						result.push(i);
					} else {
						throw new Error('invalid UTF-16 surrogate detected');
					}
				} else {
					throw new Error('invalid UTF-16 surrogate detected');
				}
			} else if (this.isLowSurrogate(char)) {
				throw new Error('invalid UTF-16 surrogate detected');
			} else {
				result.push(i);
			}
		}
		result.push(text.length);
		return result;
	}

	replace(begin: number, end: number, str: string): void {
		if (begin < 0) {
			throw new RangeError('begin is negative');
		}
		if (begin > this.modifiedText.length) {
			throw new RangeError('begin > length()');
		}
		if (begin > end) {
			throw new RangeError('begin > end');
		}
		if (begin === end) {
			throw new Error('begin == end');
		}

		if (end > this.modifiedText.length) {
			end = this.modifiedText.length;
		}

		const before = this.modifiedText.substring(0, begin);
		const after = this.modifiedText.substring(end);
		this.modifiedText = before + str + after;

		const modifiedBegin = this.modifiedToOriginal[begin];
		const modifiedEnd = this.modifiedToOriginal[end];
		const length = str.length;

		if (modifiedBegin !== undefined && modifiedEnd !== undefined) {
			if (end - begin > length) {
				this.modifiedToOriginal.splice(begin + length, end - begin);
			}

			this.modifiedToOriginal[begin] = modifiedBegin;
			for (let i = 1; i < length; i++) {
				if (begin + i < end) {
					this.modifiedToOriginal[begin + i] = modifiedEnd;
				} else {
					this.modifiedToOriginal.splice(begin + i, 0, modifiedEnd);
				}
			}
		}
	}

	getOriginalText(): string {
		return this.originalText;
	}

	getText(): string {
		return this.modifiedText;
	}

	build(): InputText {
		const modifiedStringText = this.getText();
		const byteText = new TextEncoder().encode(modifiedStringText);

		const length = byteText.length;
		const byteToModified = new Int32Array(length + 1);
		const byteToOriginal = new Int32Array(length + 1);

		let j = 0;
		for (let i = 0; i < this.modifiedText.length; i++) {
			const char = this.modifiedText.charCodeAt(i);
			if (this.isLowSurrogate(char)) {
				continue;
			}
			const codePoint = this.getCodePointAt(this.modifiedText, i);
			const utf8Length = this.getUtf8ByteLength(codePoint);
			for (let k = 0; k < utf8Length; k++) {
				byteToModified[j] = i;
				const val = this.modifiedToOriginal[i];
				if (val !== undefined) {
					byteToOriginal[j] = val;
				}
				j++;
			}
		}
		byteToModified[length] = modifiedStringText.length;
		const lastVal = this.modifiedToOriginal[this.modifiedToOriginal.length - 1];
		if (lastVal !== undefined) {
			byteToOriginal[length] = lastVal;
		}

		const charCategories = this.getCharCategoryTypes(modifiedStringText);
		const charCategoryContinuities = this.getCharCategoryContinuities(
			modifiedStringText,
			length,
			charCategories,
		);
		const canBowList = this.buildCanBowList(modifiedStringText, charCategories);

		return new UTF8InputText(
			this.grammar,
			this.originalText,
			modifiedStringText,
			byteText,
			byteToOriginal,
			byteToModified,
			this.modifiedToOriginal,
			charCategories,
			charCategoryContinuities,
			canBowList,
		);
	}

	private getCharCategoryTypes(text: string): Set<CategoryType>[] {
		if (text === '') {
			return [];
		}
		const charCategoryTypes: Set<CategoryType>[] = [];
		for (let i = 0; i < text.length; i++) {
			const char = text.charCodeAt(i);
			if (this.isLowSurrogate(char)) {
				const lastCat = charCategoryTypes[charCategoryTypes.length - 1];
				if (lastCat !== undefined) {
					charCategoryTypes.push(lastCat);
				}
				continue;
			}
			const codePoint = this.getCodePointAt(text, i);
			const types =
				this.grammar?.getCharacterCategory()?.getCategoryTypes(codePoint) ||
				new Set<CategoryType>();
			charCategoryTypes.push(types);
		}
		return charCategoryTypes;
	}

	private getCharCategoryContinuities(
		text: string,
		_byteLength: number,
		charCategories: Set<CategoryType>[],
	): number[] {
		if (text === '') {
			return [];
		}
		const charCategoryContinuities: number[] = [];
		for (let i = 0; i < charCategories.length; ) {
			const next = i + this.getCharCategoryContinuousLength(charCategories, i);
			let length = 0;
			for (let j = i; j < next; j = this.offsetByCodePoints(text, j, 1)) {
				const codePoint = this.getCodePointAt(text, j);
				length += this.getUtf8ByteLength(codePoint);
			}
			for (let k = length; k > 0; k--) {
				charCategoryContinuities.push(k);
			}
			i = next;
		}
		return charCategoryContinuities;
	}

	private getCharCategoryContinuousLength(
		charCategories: Set<CategoryType>[],
		offset: number,
	): number {
		let length: number;
		const continuousCategory = new Set(charCategories[offset]);
		for (length = 1; length < charCategories.length - offset; length++) {
			const currentCategories = charCategories[offset + length];
			if (currentCategories === undefined) {
				break;
			}
			const intersection = new Set(
				[...continuousCategory].filter((x) => currentCategories.has(x)),
			);
			if (intersection.size === 0) {
				return length;
			}
			continuousCategory.clear();
			for (const x of intersection) {
				continuousCategory.add(x);
			}
		}
		return length;
	}

	private buildCanBowList(
		text: string,
		charCategories: Set<CategoryType>[],
	): boolean[] {
		if (text === '') {
			return [];
		}
		const canBowList: boolean[] = [];
		for (let i = 0; i < charCategories.length; i++) {
			if (i === 0) {
				canBowList.push(true);
				continue;
			}

			const char = text.charCodeAt(i);
			if (this.isLowSurrogate(char)) {
				canBowList.push(false);
				continue;
			}

			const types = new Set(charCategories[i]);
			if (
				types.has(CategoryType.ALPHA) ||
				types.has(CategoryType.GREEK) ||
				types.has(CategoryType.CYRILLIC)
			) {
				const intersection = new Set(
					[...types].filter((x) => charCategories[i - 1]?.has(x)),
				);
				canBowList.push(intersection.size === 0);
				continue;
			}

			canBowList.push(true);
		}

		return canBowList;
	}

	private getUtf8ByteLength(cp: number): number {
		if (cp < 0) {
			return 0;
		} else if (cp <= 0x7f) {
			return 1;
		} else if (cp <= 0x7ff) {
			return 2;
		} else if (cp <= 0xffff) {
			return 3;
		} else if (cp <= 0x10ffff) {
			return 4;
		} else {
			return 0;
		}
	}

	private getCodePointAt(text: string, index: number): number {
		const char = text.charCodeAt(index);
		if (this.isHighSurrogate(char) && index + 1 < text.length) {
			const nextChar = text.charCodeAt(index + 1);
			if (this.isLowSurrogate(nextChar)) {
				return (char - 0xd800) * 0x400 + (nextChar - 0xdc00) + 0x10000;
			}
		}
		return char;
	}

	private offsetByCodePoints(
		text: string,
		index: number,
		codePointOffset: number,
	): number {
		let result = index;
		if (codePointOffset > 0) {
			for (let i = 0; i < codePointOffset; i++) {
				const char = text.charCodeAt(result);
				if (this.isHighSurrogate(char) && result + 1 < text.length) {
					const nextChar = text.charCodeAt(result + 1);
					if (this.isLowSurrogate(nextChar)) {
						result += 2;
					} else {
						result += 1;
					}
				} else {
					result += 1;
				}
			}
		} else if (codePointOffset < 0) {
			for (let i = 0; i < -codePointOffset; i++) {
				result--;
				if (result > 0) {
					const char = text.charCodeAt(result - 1);
					if (this.isLowSurrogate(char)) {
						result--;
					}
				}
			}
		}
		return result;
	}

	private isHighSurrogate(char: number): boolean {
		return char >= 0xd800 && char <= 0xdbff;
	}

	private isLowSurrogate(char: number): boolean {
		return char >= 0xdc00 && char <= 0xdfff;
	}
}

export class UTF8InputText implements InputText {
	private readonly originalText: string;
	private readonly modifiedText: string;
	private readonly bytes: Uint8Array;
	private readonly byteToOriginal: Int32Array;
	private readonly byteToModified: Int32Array;
	private readonly modifiedToOriginal: readonly number[];
	private readonly charCategories: readonly Set<CategoryType>[];
	private readonly charCategoryContinuities: readonly number[];
	private readonly canBowList: readonly boolean[];

	constructor(
		_grammar: Grammar | null,
		originalText: string,
		modifiedText: string,
		bytes: Uint8Array,
		byteToOriginal: Int32Array,
		byteToModified: Int32Array,
		modifiedToOriginal: readonly number[],
		charCategories: readonly Set<CategoryType>[],
		charCategoryContinuities: readonly number[],
		canBowList: readonly boolean[],
	) {
		this.originalText = originalText;
		this.modifiedText = modifiedText;
		this.bytes = bytes;
		this.byteToOriginal = byteToOriginal;
		this.byteToModified = byteToModified;
		this.modifiedToOriginal = modifiedToOriginal;
		this.charCategories = charCategories;
		this.charCategoryContinuities = charCategoryContinuities;
		this.canBowList = canBowList;
	}

	getText(): string {
		return this.modifiedText;
	}

	getOriginalText(): string {
		return this.originalText;
	}

	getSubstring(begin: number, end: number): string {
		if (begin < 0) {
			throw new RangeError('begin is negative');
		}
		if (end > this.bytes.length) {
			throw new RangeError('end > byte length');
		}
		if (begin > end) {
			throw new RangeError('begin > end');
		}

		const beginVal = this.byteToModified[begin];
		const endVal = this.byteToModified[end];
		if (beginVal !== undefined && endVal !== undefined) {
			return this.modifiedText.substring(beginVal, endVal);
		}
		return '';
	}

	slice(begin: number, end: number): InputText {
		if (begin < 0) {
			throw new RangeError('begin is negative');
		}
		if (end > this.modifiedText.length) {
			throw new RangeError('end > modified text length');
		}
		if (begin > end) {
			throw new RangeError('begin > end');
		}

		const byteBegin = this.getCodePointsOffsetLength(0, begin);
		const length = this.getCodePointsOffsetLength(byteBegin, end - begin);
		const byteEnd = byteBegin + length;

		const byteBeginVal = this.byteToOriginal[byteBegin];
		const byteEndVal = this.byteToOriginal[byteEnd];
		let originalText = '';
		if (byteBeginVal !== undefined && byteEndVal !== undefined) {
			originalText = this.originalText.substring(byteBeginVal, byteEndVal);
		}
		const modifiedText = this.modifiedText.substring(begin, end);
		const bytes = this.bytes.slice(byteBegin, byteEnd);

		const byteToOriginal = new Int32Array(length + 1);
		for (let i = 0; i < length + 1; i++) {
			const val1 = this.byteToOriginal[byteBegin + i];
			const val2 = this.byteToOriginal[byteBegin];
			if (val1 !== undefined && val2 !== undefined) {
				byteToOriginal[i] = val1 - val2;
			}
		}

		const byteToModified = new Int32Array(length + 1);
		for (let i = 0; i < length + 1; i++) {
			const val = this.byteToModified[byteBegin + i];
			if (val !== undefined) {
				byteToModified[i] = val - begin;
			}
		}

		const modifiedToOriginal: number[] = [];
		for (let i = 0; i < end + 1; i++) {
			const val1 = this.modifiedToOriginal[i];
			const val2 = this.modifiedToOriginal[begin];
			if (val1 !== undefined && val2 !== undefined) {
				modifiedToOriginal.push(val1 - val2);
			}
		}

		const charCategories = this.charCategories.slice(begin, end);
		const charCategoryContinuities = [
			...this.charCategoryContinuities.slice(byteBegin, byteEnd),
		];
		if (charCategoryContinuities[length - 1] !== 1) {
			let i = length - 1;
			let len = 1;
			while (i >= 0 && charCategoryContinuities[i] !== 1) {
				charCategoryContinuities[i] = len++;
				i--;
			}
		}

		const canBowList = this.canBowList.slice(begin, end);

		return new UTF8InputText(
			null,
			originalText,
			modifiedText,
			bytes,
			byteToOriginal,
			byteToModified,
			modifiedToOriginal,
			charCategories,
			charCategoryContinuities,
			canBowList,
		);
	}

	modifiedOffset(index: number): number {
		const val = this.byteToModified[index];
		if (val !== undefined) {
			return val;
		}
		return 0;
	}

	getOriginalIndex(index: number): number {
		const val = this.byteToOriginal[index];
		if (val !== undefined) {
			return val;
		}
		return 0;
	}

	getCharCategoryTypes(index: number): Set<CategoryType>;
	getCharCategoryTypes(begin: number, end: number): Set<CategoryType>;
	getCharCategoryTypes(indexOrBegin: number, end?: number): Set<CategoryType> {
		if (end === undefined) {
			const idx = this.byteToModified[indexOrBegin];
			if (idx !== undefined) {
				const cat = this.charCategories[idx];
				if (cat !== undefined) {
					return cat;
				}
			}
			return new Set();
		}

		const beginIdx = indexOrBegin;
		if (beginIdx + this.getCharCategoryContinuousLength(beginIdx) < end) {
			return new Set();
		}
		const b = this.byteToModified[beginIdx];
		const e = this.byteToModified[end];
		if (b !== undefined && e !== undefined) {
			const cat = this.charCategories[b];
			if (cat !== undefined) {
				const continuousCategory = new Set(cat);
				for (let i = b + 1; i < e; i++) {
					const intersection = new Set(
						[...continuousCategory].filter((x) =>
							this.charCategories[i]?.has(x),
						),
					);
					if (intersection.size === 0) {
						break;
					}
					continuousCategory.clear();
					for (const x of intersection) {
						continuousCategory.add(x);
					}
				}
				return continuousCategory;
			}
		}
		return new Set();
	}

	getCodePointsOffsetLength(index: number, codePointOffset: number): number {
		let length = 0;
		const idxVal = this.byteToModified[index];
		if (idxVal === undefined) {
			return 0;
		}
		const target = idxVal + codePointOffset;
		for (let i = index; i < this.bytes.length; i++) {
			const bmVal = this.byteToModified[i];
			if (bmVal !== undefined && bmVal >= target) {
				return length;
			}
			length++;
		}
		return length;
	}

	codePointCount(begin: number, end: number): number {
		const beginVal = this.byteToModified[begin];
		const endVal = this.byteToModified[end];
		if (beginVal !== undefined && endVal !== undefined) {
			return endVal - beginVal;
		}
		return 0;
	}

	canBow(index: number): boolean {
		const modifiedIndex = this.byteToModified[index];
		if (modifiedIndex === undefined) {
			return false;
		}
		const canBowVal = this.canBowList[modifiedIndex];
		return this.isCharAlignment(index) && (canBowVal ?? false);
	}

	getWordCandidateLength(index: number): number {
		for (let i = index + 1; i < this.bytes.length; i++) {
			if (this.canBow(i)) {
				return i - index;
			}
		}
		return this.bytes.length - index;
	}

	private isCharAlignment(index: number): boolean {
		const byteVal = this.bytes[index];
		if (byteVal === undefined) {
			return false;
		}
		return (byteVal & 0xc0) !== 0x80;
	}

	getNextInOriginal(index: number): number {
		const o = this.modifiedToOriginal[index + 1];
		while (
			index + 1 < this.modifiedText.length + 1 &&
			this.modifiedToOriginal[index + 1] === o
		) {
			index++;
		}
		return index;
	}

	textIndexToOriginalTextIndex(index: number): number {
		const val = this.modifiedToOriginal[index];
		if (val !== undefined) {
			return val;
		}
		return 0;
	}

	getByteText(): Uint8Array {
		return this.bytes;
	}

	getCharCategoryContinuousLength(index: number): number {
		const bmVal = this.byteToModified[index];
		if (bmVal === undefined) {
			return 0;
		}
		const cat = this.charCategories[bmVal];
		if (cat !== undefined) {
			const continuousCategory = new Set(cat);
			for (
				let length = 1;
				length < this.charCategories.length - index;
				length++
			) {
				const currentCategories = this.charCategories[index + length];
				if (currentCategories === undefined) {
					break;
				}
				const intersection = new Set(
					[...continuousCategory].filter((x) => currentCategories.has(x)),
				);
				if (intersection.size === 0) {
					return length;
				}
				continuousCategory.clear();
				for (const x of intersection) {
					continuousCategory.add(x);
				}
			}
		}
		return 0;
	}
}
