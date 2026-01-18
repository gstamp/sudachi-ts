import { beforeEach, describe, expect, test } from 'bun:test';
import {
	DEFAULT_LIMIT,
	type NonBreakChecker,
	SentenceDetector,
} from '../../../src/sentdetect/sentenceDetector.js';

describe('SentenceDetector', () => {
	let detector: SentenceDetector;

	beforeEach(() => {
		detector = new SentenceDetector();
	});

	test('getEos', () => {
		expect(detector.getEos('あいう。えお。', null)).toBe(4);
		expect(detector.getEos('あいうえお', null)).toBe(-5);
		expect(detector.getEos('', null)).toBe(0);
		expect(detector.getEos('あいう。。えお。', null)).toBe(5);
		expect(detector.getEos('あ い うえお', null)).toBe(-7);
	});

	test('getEosWithLimit', () => {
		detector = new SentenceDetector(5);
		expect(detector.getEos('あい。うえお。', null)).toBe(3);
		expect(detector.getEos('あいうえおか', null)).toBe(-5);
		expect(detector.getEos('あいうえお。', null)).toBe(-5);
		expect(detector.getEos('あい うえお', null)).toBe(-3);
		expect(detector.getEos('あ い うえお', null)).toBe(-4);
	});

	test('getEosWithPeriod', () => {
		expect(detector.getEos('あいう.えお', null)).toBe(4);
		expect(detector.getEos('3.141', null)).toBe(-5);
		expect(detector.getEos('四百十．〇', null)).toBe(-5);
	});

	test('getEosWithManyPeriods', () => {
		const sentence = `あいうえお${'！'.repeat(4000)}`;
		expect(detector.getEos(sentence, null)).toBe(4005);
	});

	test('getEosWithParenthesis', () => {
		expect(detector.getEos('あ（いう。え）お', null)).toBe(-8);
		expect(detector.getEos('（あ（いう）。え）お', null)).toBe(-10);
		expect(detector.getEos('あ（いう）。えお', null)).toBe(6);
	});

	test('getEosWithProhibitedBOS', () => {
		expect(detector.getEos('あいう?えお', null)).toBe(4);
		expect(detector.getEos('あいう?)えお', null)).toBe(5);
		expect(detector.getEos('あいう?,えお', null)).toBe(5);
	});

	test('getEosWithContinuousPhrase', () => {
		expect(detector.getEos('あいう?です。', null)).toBe(7);
		expect(detector.getEos('あいう?って。', null)).toBe(7);
		expect(detector.getEos('あいう?という。', null)).toBe(8);
		expect(detector.getEos('あいう?の?です。', null)).toBe(4);

		expect(detector.getEos('1.と2.が。', null)).toBe(7);
		expect(detector.getEos('1.やb.が。', null)).toBe(7);
		expect(detector.getEos('1.の12.が。', null)).toBe(8);
	});

	test('getEosWithNonBreakWord', () => {
		class Checker implements NonBreakChecker {
			private text: string;

			constructor(text: string) {
				this.text = text;
			}

			hasNonBreakWord(eos: number): boolean {
				return this.text.slice(eos - 2).startsWith('な。な');
			}
		}

		const text = 'ばな。なです。';
		const checker = new Checker(text);
		expect(detector.getEos(text, checker)).toBe(7);
	});

	test('DEFAULT_LIMIT', () => {
		expect(DEFAULT_LIMIT).toBe(4096);
	});

	test('parenthesisLevel', () => {
		expect(detector.parenthesisLevel('（あいうえお）')).toBe(0);
		expect(detector.parenthesisLevel('（（あいうえお））')).toBe(0);
		expect(detector.parenthesisLevel('（（あいうえお')).toBe(2);
		expect(detector.parenthesisLevel('あいうえお））')).toBe(0);
		expect(detector.parenthesisLevel('（あ（いう）えお）')).toBe(0);
		expect(detector.parenthesisLevel('')).toBe(0);
	});

	test('prohibitedBOS', () => {
		expect(detector.prohibitedBOS('」')).toBe(1);
		expect(detector.prohibitedBOS('）')).toBe(1);
		expect(detector.prohibitedBOS('、')).toBe(1);
		expect(detector.prohibitedBOS('。）」')).toBe(3);
		expect(detector.prohibitedBOS('あいう')).toBe(0);
	});

	test('isContinuousPhrase', () => {
		expect(detector.isContinuousPhrase('あいう?です。', 4)).toBe(true);
		expect(detector.isContinuousPhrase('あいう。えお', 4)).toBe(false);
	});
});
