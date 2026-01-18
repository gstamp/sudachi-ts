const PERIODS = '。？！♪…\\?\\!';
const DOT = '\\.．';
const CDOT = '・';
const COMMA = ',，、';
const BR_TAG = '(<br>|<BR>){2,}';
const ALPHABET_OR_NUMBER =
	'a-zA-Z0-9ａ-ｚＡ-Ｚ０-９〇一二三四五六七八九十百千万億兆';
const SENTENCE_BREAKER_PATTERN = new RegExp(
	`([${PERIODS}]|${CDOT}{3,}|((?<![${ALPHABET_OR_NUMBER}])[${DOT}](?![${ALPHABET_OR_NUMBER}${COMMA}]))([${DOT}${PERIODS}])*|${BR_TAG})`,
	'g',
);

const OPEN_PARENTHESIS = '\\(\\{｛\\[（「【『［≪〔"';
const CLOSE_PARENTHESIS = '\\)\\}\\]）」｝】』］〕≫"';

const ITEMIZE_HEADER = `([${ALPHABET_OR_NUMBER}])([${DOT}])`;
const ITEMIZE_HEADER_PATTERN = new RegExp(`^${ITEMIZE_HEADER}$`);

const PARENTHESIS_PATTERN = new RegExp(
	`([${OPEN_PARENTHESIS}])|([${CLOSE_PARENTHESIS}])`,
	'g',
);

const PROHIBITED_BOS_PATTERN = new RegExp(
	`^([${CLOSE_PARENTHESIS}${COMMA}${PERIODS}])+`,
);

const QUOTE_MARKER_PATTERN = new RegExp(
	`(！|？|\\!|\\?|[${CLOSE_PARENTHESIS}])(と|っ|です)`,
);
const EOS_ITEMIZE_HEADER_PATTERN = new RegExp(`${ITEMIZE_HEADER}$`);

export const DEFAULT_LIMIT = 4096;

export interface NonBreakChecker {
	hasNonBreakWord(eos: number): boolean;
}

export class SentenceDetector {
	private limit: number;

	constructor(limit: number = -1) {
		this.limit = limit > 0 ? limit : DEFAULT_LIMIT;
	}

	getEos(input: string, checker: NonBreakChecker | null): number {
		if (input.length === 0) {
			return 0;
		}

		const s = input.length > this.limit ? input.slice(0, this.limit) : input;
		SENTENCE_BREAKER_PATTERN.lastIndex = 0;
		let match: RegExpExecArray | null = SENTENCE_BREAKER_PATTERN.exec(s);
		while (match !== null) {
			const eos = match.index + match[0].length;
			if (this.parenthesisLevel(s.slice(0, eos)) === 0) {
				let adjustedEos = eos;
				if (eos < s.length) {
					adjustedEos += this.prohibitedBOS(s.slice(eos));
				}
				if (ITEMIZE_HEADER_PATTERN.test(s.slice(0, eos))) {
					match = SENTENCE_BREAKER_PATTERN.exec(s);
					continue;
				}
				if (eos < s.length && this.isContinuousPhrase(s, eos)) {
					match = SENTENCE_BREAKER_PATTERN.exec(s);
					continue;
				}
				if (checker?.hasNonBreakWord(eos)) {
					match = SENTENCE_BREAKER_PATTERN.exec(s);
					continue;
				}
				return adjustedEos;
			}
			match = SENTENCE_BREAKER_PATTERN.exec(s);
		}

		if (input.length > this.limit) {
			const spaces = s.match(/^.+\s+/);
			if (spaces) {
				return -spaces[0].length;
			}
		}

		return -Math.min(input.length, this.limit);
	}

	parenthesisLevel(s: string): number {
		PARENTHESIS_PATTERN.lastIndex = 0;
		let level = 0;
		let match: RegExpExecArray | null = PARENTHESIS_PATTERN.exec(s);
		while (match !== null) {
			if (match[1]) {
				level++;
			} else {
				level--;
			}
			if (level < 0) {
				level = 0;
			}
			match = PARENTHESIS_PATTERN.exec(s);
		}
		return level;
	}

	prohibitedBOS(s: string): number {
		const match = s.match(PROHIBITED_BOS_PATTERN);
		return match ? match[0].length : 0;
	}

	isContinuousPhrase(s: string, eos: number): boolean {
		QUOTE_MARKER_PATTERN.lastIndex = 0;
		const match = QUOTE_MARKER_PATTERN.exec(s);
		if (match && match.index === eos - 1) {
			return true;
		}

		const c = s[eos];
		EOS_ITEMIZE_HEADER_PATTERN.lastIndex = 0;
		const hasItemizeHeader = EOS_ITEMIZE_HEADER_PATTERN.test(s.slice(0, eos));
		return (c === 'と' || c === 'や' || c === 'の') && hasItemizeHeader;
	}
}
