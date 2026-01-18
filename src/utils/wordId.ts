export const MAX_WORD_ID = 0x0fffffff;
export const MAX_DIC_ID = 0xe;

export function makeUnchecked(dic: number, word: number): number {
	const dicPart = dicIdMask(dic);
	return dicPart | word;
}

export function make(dic: number, word: number): number {
	if (word > MAX_WORD_ID) {
		throw new RangeError(`wordId is too large: ${word}`);
	}
	if (dic > MAX_DIC_ID) {
		throw new RangeError(`dictionaryId is too large: ${dic}`);
	}
	return makeUnchecked(dic, word);
}

export function dic(wordId: number): number {
	return wordId >>> 28;
}

export function word(wordId: number): number {
	return wordId & MAX_WORD_ID;
}

export function dicIdMask(dicId: number): number {
	return dicId << 28;
}

export function applyMask(wordId: number, dicIdMask: number): number {
	return (wordId & MAX_WORD_ID) | dicIdMask;
}
