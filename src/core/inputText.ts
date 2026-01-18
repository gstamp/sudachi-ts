import type { CategoryType } from '../dictionary/categoryType.js';

export interface InputText {
	getText(): string;

	getOriginalText(): string;

	getSubstring(begin: number, end: number): string;

	slice(begin: number, end: number): InputText;

	getOriginalIndex(index: number): number;

	textIndexToOriginalTextIndex(index: number): number;

	getCharCategoryTypes(index: number): Set<CategoryType>;

	getCharCategoryTypes(begin: number, end: number): Set<CategoryType>;

	getCharCategoryContinuousLength(index: number): number;

	getCodePointsOffsetLength(index: number, codePointOffset: number): number;

	codePointCount(begin: number, end: number): number;

	canBow(index: number): boolean;

	getWordCandidateLength(index: number): number;

	getNextInOriginal(index: number): number;

	modifiedOffset(index: number): number;

	getByteText(): Uint8Array;
}
